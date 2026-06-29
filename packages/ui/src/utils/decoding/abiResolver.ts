import { Address, PublicClient, isAddressEqual, type AbiFunction } from "viem";
import { whatsabi } from "@shazow/whatsabi";
import { getImplementation } from "@/utils/proxies";
import { ADDRESS_ZERO, isAddress, isContract } from "@/utils/evm";
import { PUB_CHAIN, PUB_ETHERSCAN_API_KEY } from "@/constants";
import type { AbiResolution } from "./types";

export { loadSignature } from "./signatureLookup";

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

/**
 * Verified ABI + name for an address on another chain, via Etherscan v2 (HTTP
 * only — no RPC, so no proxy-slot resolution). Never guesses: a contract that
 * isn't verified on that chain returns an `unknown` resolution. Never throws.
 */
export async function loadVerifiedAbiFrom(chainId: number, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
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
    return empty;
  }
}

/** Verified contract name for an address via Etherscan, or null if unverified/unavailable. */
async function verifiedName(address: Address): Promise<string | null> {
  try {
    const result = await etherscanLoader().getContract(address);
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
    return { ...empty, isProxy, implementation };
  }
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
