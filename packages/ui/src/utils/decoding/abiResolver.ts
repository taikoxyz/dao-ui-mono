import { Address, PublicClient, isAddressEqual, type AbiFunction } from "viem";
import { whatsabi } from "@shazow/whatsabi";
import { getImplementation } from "@/utils/proxies";
import { ADDRESS_ZERO, isAddress, isContract } from "@/utils/evm";
import { PUB_CHAIN, PUB_ETHERSCAN_API_KEY } from "@/constants";
import type { AbiResolution } from "./types";

export { loadSignature } from "./signatureLookup";

function etherscanLoader() {
  return new whatsabi.loaders.EtherscanABILoader({
    apiKey: PUB_ETHERSCAN_API_KEY,
    baseURL: `https://api.etherscan.io/v2/api?chainid=${PUB_CHAIN.id}`,
  });
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
    });
    const abi = toFunctionItems(loaded.abi as any[]);
    // whatsabi sets hasCode/verified metadata; treat presence of named, typed inputs as "verified".
    const trust = loaded.abiLoadedFrom ? "verified" : "bytecode";
    return { abi, trust, isProxy, implementation };
  } catch {
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
