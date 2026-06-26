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
  summary: string | null;
  children: DecodedNode[];
  error?: string;
  truncated?: "depth" | "cycle";
};

export type AbiResolution = {
  abi: AbiFunction[];
  trust: TrustLevel; // "verified" | "bytecode" | "unknown"
  isProxy: boolean;
  implementation: Address | null;
};

export type RawCall = { to: Address; value: bigint; data: Hex };

export type DecodeCtx = {
  loadAbi: (address: Address) => Promise<AbiResolution>;
  loadSignature: (selector: Hex) => Promise<AbiFunction | null>;
  loadToken: (address: Address) => Promise<{ decimals: number; symbol: string } | null>;
  depth: number;
  maxDepth: number;
  seen: Set<string>;
};

export type Unwrapper = {
  id: string;
  match: (node: DecodedNode) => boolean;
  apply: (node: DecodedNode, ctx: DecodeCtx) => Promise<{ summary: string | null; children: RawCall[] }>;
};
