import { decodeAbiParameters, parseAbiParameters, getAddress, isAddress, size, type Hex } from "viem";
import type { RawCall } from "../types";

const ACTION_TUPLE = parseAbiParameters("(address,uint256,bytes)[]");

/**
 * Decode a bytes blob as an OSx-style `(address,uint256,bytes)[]` into RawCalls.
 * Returns null on any failure (empty / too short / malformed / non-address
 * target) — never guesses. Chain-agnostic: callers set `chainId` if needed.
 */
export function decodeActionTupleArray(blob: Hex): RawCall[] | null {
  try {
    if (!blob || blob === "0x" || size(blob) < 64) return null;
    const [arr] = decodeAbiParameters(ACTION_TUPLE, blob) as unknown as [Array<[string, bigint, Hex]>];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (!arr.every((t) => isAddress(t[0]))) return null;
    return arr.map((t) => ({ to: getAddress(t[0]), value: t[1], data: t[2] }));
  } catch {
    return null;
  }
}
