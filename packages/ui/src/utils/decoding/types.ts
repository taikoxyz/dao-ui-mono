import type { Address, Hex, AbiFunction } from "viem";
import type { EvmValue } from "@/utils/types";

export type TrustLevel = "verified" | "bytecode" | "signature-db" | "unknown";

export type DecodedParam = {
  name: string;
  type: string;
  value: EvmValue;
  formatted?: string;
  /** ABI internalType (e.g. "struct IBridge.Message"), when available from a verified ABI. */
  internalType?: string;
  /** Decoded sub-params for a `tuple` type, so struct fields render with names + types. */
  components?: DecodedParam[];
};

export type EmbeddedCall = { path: string; selector: Hex; signature: string | null };

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
  /** Unverified: selector-prefixed bytes found in params, labeled from the 4-byte DB. Never arg values. */
  embeddedCalls?: EmbeddedCall[];
  children: DecodedNode[];
  error?: string;
  truncated?: "depth" | "cycle" | "budget";
  /**
   * True when this node is degraded because a fetch actually THREW (network/RPC/
   * Etherscan outage), not because the contract is genuinely unverified/unknown.
   * The hook reads this to refetch (staleTime 0) instead of caching a transient
   * failure as a clean "unknown". Propagated up the tree: any retryable child
   * flags its parent. A clean unknown (non-contract, verified-but-empty) is NOT
   * retryable.
   */
  retryable?: boolean;
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
  /**
   * True when the empty/degraded result came from a fetch that THREW (network/RPC/
   * Etherscan outage) rather than a clean unverified/non-contract answer. Lets the
   * caller mark the decode stale-and-refetchable instead of caching it as success.
   */
  retryable?: boolean;
};

export type RawCall = { to: Address; value: bigint; data: Hex; chainId?: number };

export type DecodeCtx = {
  loadAbi: (address: Address, chainId: number) => Promise<AbiResolution>;
  loadSignature: (selector: Hex) => Promise<AbiFunction | null>;
  /** Token metadata on a specific chain — a bridged L2 token reads from its own chain. */
  loadToken: (address: Address, chainId: number) => Promise<{ decimals: number; symbol: string } | null>;
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
