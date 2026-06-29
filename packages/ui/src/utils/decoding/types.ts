import type { Address, Hex, AbiFunction } from "viem";
import type { EvmValue } from "@/utils/types";

export type TrustLevel = "verified" | "bytecode" | "signature-db" | "unknown";

export type DecodedParam = {
  name: string;
  type: string;
  value: EvmValue;
  formatted?: string;
};

export type DecodedNode = {
  to: Address;
  value: bigint;
  data: Hex;
  selector: Hex | null;
  functionName: string | null;
  signature: string | null;
  params: DecodedParam[];
  trust: TrustLevel;
  isProxy: boolean;
  implementation: Address | null;
  /** Chain id where this call executes (app chain unless an envelope routed it cross-chain). */
  chainId: number;
  /** Verified contract name of the call target (implementation, for proxies). Verified sources only. */
  name?: string;
  /** Verified name of the proxy contract itself, when the target is a proxy. */
  proxyName?: string;
  summary: string | null;
  children: DecodedNode[];
  error?: string;
  truncated?: "depth" | "cycle" | "budget";
};

export type AbiResolution = {
  abi: AbiFunction[];
  trust: TrustLevel; // "verified" | "bytecode" | "unknown"
  isProxy: boolean;
  implementation: Address | null;
  /** Verified contract name of the resolved target (implementation, for proxies). */
  name?: string;
  /** Verified name of the proxy contract itself, when `isProxy`. */
  proxyName?: string;
};

export type RawCall = { to: Address; value: bigint; data: Hex; chainId?: number };

export type DecodeCtx = {
  loadAbi: (address: Address, chainId: number) => Promise<AbiResolution>;
  loadSignature: (selector: Hex) => Promise<AbiFunction | null>;
  loadToken: (address: Address) => Promise<{ decimals: number; symbol: string } | null>;
  /** App/default chain id; a call without an explicit chainId resolves here. */
  chainId: number;
  depth: number;
  maxDepth: number;
  seen: Set<string>;
  // Total decoded sub-nodes allowed across the whole tree (breadth guard against a
  // hostile action array fanning out unbounded RPC calls). Shared by reference so
  // siblings draw from one pool. Defaults applied in decodeAction when omitted.
  maxNodes?: number;
  nodeCount?: { value: number };
};

export type Unwrapper = {
  id: string;
  match: (node: DecodedNode) => boolean;
  apply: (node: DecodedNode, ctx: DecodeCtx) => Promise<{ summary: string | null; children: RawCall[] }>;
};
