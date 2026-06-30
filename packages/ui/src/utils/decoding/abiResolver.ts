import { Address, PublicClient, createPublicClient, http, isAddressEqual, type AbiFunction, type Chain } from "viem";
import { taiko } from "viem/chains";
import { whatsabi } from "@shazow/whatsabi";
import { getImplementation } from "@/utils/proxies";
import { ADDRESS_ZERO, isAddress, isContract } from "@/utils/evm";
import { PUB_CHAIN, PUB_ETHERSCAN_API_KEY, PUB_TAIKO_RPC } from "@/constants";
import type { AbiResolution } from "./types";

/**
 * Canonical react-query key for a resolved ABI. Shared by `useAbi` and
 * `useActionTree` so the same contract's ABI (whatsabi autoload + Etherscan +
 * proxy RPC reads) is cached once. Address is lowercased so a checksummed and a
 * lowercase reference to the same contract collapse to one cache entry.
 */
export function abiQueryKey(chainId: number | undefined, address: Address | undefined) {
  return ["abi", chainId, (address ?? "").toLowerCase()] as const;
}

function etherscanLoader(chainId: number = PUB_CHAIN.id) {
  return new whatsabi.loaders.EtherscanABILoader({
    apiKey: PUB_ETHERSCAN_API_KEY,
    baseURL: `https://api.etherscan.io/v2/api?chainid=${chainId}`,
  });
}

// Chains we will attempt cross-chain VERIFIED resolution for via Etherscan v2.
// Keep explicit: the app chain plus Taiko mainnet (the bridge destination).
const VERIFIED_ABI_CHAINS = new Set<number>([PUB_CHAIN.id, 1, 167000]);

export function isVerifiedAbiChainSupported(chainId: number): boolean {
  return VERIFIED_ABI_CHAINS.has(chainId);
}

// Chains we resolve proxy-aware (RPC slot read + verified impl ABI). The app
// chain is handled by loadAbiWith; this is for cross-chain targets only.
const CHAIN_RESOLVERS: Record<number, { chain: Chain; rpcUrl: string }> = {
  167000: { chain: taiko, rpcUrl: PUB_TAIKO_RPC },
};

const clientCache = new Map<number, PublicClient>();

/** Memoized read-only viem client for a registry chain, or null if unsupported. */
export function chainClient(chainId: number): PublicClient | null {
  const entry = CHAIN_RESOLVERS[chainId];
  if (!entry) return null;
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const client = createPublicClient({ chain: entry.chain, transport: http(entry.rpcUrl) }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}

/**
 * Proxy-aware verified resolution on another chain: read the EIP-1967
 * implementation slot over that chain's RPC, then fetch the implementation's
 * verified ABI + name from Etherscan v2. Verified-source only; never throws.
 * Exported for testing (the client is injected).
 */
export async function loadVerifiedViaRpc(
  chainId: number,
  address: Address,
  client: PublicClient,
): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
  try {
    const implementation = await resolveImplementation(client, address);
    const target = implementation ?? address;
    const isProxy = !!implementation;
    const result = await etherscanLoader(chainId).getContract(target);
    if (!result.ok) return { ...empty, isProxy, implementation };
    const proxyName = isProxy ? ((await verifiedName(address, chainId)) ?? undefined) : undefined;
    return {
      abi: toFunctionItems(result.abi as any[]),
      trust: "verified",
      isProxy,
      implementation,
      name: result.name || undefined,
      proxyName,
    };
  } catch {
    // A fetch/RPC actually threw (outage) — degraded, but transient: refetchable.
    return { ...empty, retryable: true };
  }
}

/**
 * Verified ABI + name for an address on another chain. For a chain in the
 * resolver registry, resolves proxy-aware (RPC slot read + verified impl ABI);
 * otherwise HTTP-only Etherscan v2. Never guesses; never throws.
 */
export async function loadVerifiedAbiFrom(chainId: number, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
  const client = chainClient(chainId);
  if (client) return loadVerifiedViaRpc(chainId, address, client);
  try {
    const result = await etherscanLoader(chainId).getContract(address);
    if (!result.ok) return empty;
    return {
      abi: toFunctionItems(result.abi as any[]),
      trust: "verified",
      isProxy: false,
      implementation: null,
      name: result.name || undefined,
    };
  } catch {
    // A fetch actually threw (Etherscan outage) — degraded, but transient: refetchable.
    return { ...empty, retryable: true };
  }
}

/** Verified contract name for an address via Etherscan, or null if unverified/unavailable. */
async function verifiedName(address: Address, chainId: number = PUB_CHAIN.id): Promise<string | null> {
  try {
    const result = await etherscanLoader(chainId).getContract(address);
    return result.ok && result.name ? result.name : null;
  } catch {
    return null;
  }
}

export async function resolveImplementation(publicClient: PublicClient, address: Address): Promise<Address | null> {
  try {
    const impl = await getImplementation(publicClient, address);
    if (!impl || isAddressEqual(impl, ADDRESS_ZERO)) return null;
    return impl;
  } catch {
    return null;
  }
}

function toFunctionItems(abi: any[]): AbiFunction[] {
  const items: AbiFunction[] = [];
  for (const item of abi) {
    if (item.type !== "function") continue;
    items.push({
      name: (item.name as string) ?? "(unknown function)",
      inputs: item.inputs ?? [],
      outputs: item.outputs ?? [],
      stateMutability: item.stateMutability ?? "payable",
      type: "function",
    });
  }
  return items;
}

export async function loadAbiWith(publicClient: PublicClient, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;

  const implementation = await resolveImplementation(publicClient, address);
  const target = implementation ?? address;
  const isProxy = !!implementation;

  if (!(await isContract(target, publicClient))) return { ...empty, isProxy, implementation };

  // Etherscan verified source first; whatsabi (bytecode) as fallback.
  try {
    const loaded = await whatsabi.autoload(target, {
      provider: publicClient,
      abiLoader: etherscanLoader(),
      followProxies: false,
      enableExperimentalMetadata: true,
      loadContractResult: true,
    });
    const abi = toFunctionItems(loaded.abi as any[]);
    // A loaded ABI source (e.g. Etherscan verified source) means "verified";
    // otherwise whatsabi guessed the selectors from bytecode.
    const trust = loaded.abiLoadedFrom ? "verified" : "bytecode";
    // Name only from a verified source; never surface a guessed name.
    const name = trust === "verified" && loaded.contractResult?.ok ? (loaded.contractResult.name || undefined) : undefined;
    // For a proxy, also resolve the proxy contract's own verified name (one extra call).
    const proxyName = isProxy ? ((await verifiedName(address)) ?? undefined) : undefined;
    return { abi, trust, isProxy, implementation, name, proxyName };
  } catch (err) {
    console.warn(`abiResolver: whatsabi autoload failed for ${target}`, err);
    // autoload threw (RPC/Etherscan outage) — degraded, but transient: refetchable.
    return { ...empty, isProxy, implementation, retryable: true };
  }
}

/**
 * Shared app-chain ABI fetch keyed by `abiQueryKey`. The SINGLE queryFn used by
 * both `useAbi` and `useActionTree` for the app chain so a contract's ABI is
 * resolved once and cached once regardless of which hook fetches it first.
 * Intentionally SIDE-EFFECT FREE — the "Cannot fetch" alert lives in useAbi's
 * component body (a useEffect), not here, so whether the alert fires can't depend
 * on cache ordering. Returns the clean empty resolution for a missing client or
 * an invalid/partial address (no fetch, no alert).
 */
export async function fetchAbiResolution(
  publicClient: PublicClient | undefined,
  address: Address,
): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!publicClient || !isAddress(address)) return empty;
  return loadAbiWith(publicClient, address);
}

export async function loadTokenWith(
  publicClient: PublicClient,
  address: Address,
): Promise<{ decimals: number; symbol: string } | null> {
  try {
    const erc20Abi = [
      { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
      { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
    ] as const;
    const [decimals, symbol] = await Promise.all([
      publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    ]);
    return { decimals: Number(decimals), symbol: symbol as string };
  } catch {
    return null;
  }
}
