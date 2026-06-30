import { decodeAbiParameters, parseAbiParameters, getAddress, isAddress, size, type Hex } from "viem";
import type { RawCall } from "../types";

const ACTION_TUPLE = parseAbiParameters("(address,uint256,bytes)[]");

/**
 * DoS breadth cap: the most sub-actions we expand from a single action array.
 * Each expanded element drives a recursive decode (RPC + Etherscan fetch), so a
 * hostile blob declaring thousands of elements must not fan out unbounded. When
 * the source array exceeds this, callers surface `truncated` so the UI stays
 * honest (shows the cap, signals there were more) rather than silently dropping.
 */
export const MAX_ACTION_ELEMENTS = 64;

/**
 * Decode a bytes blob as an OSx-style `(address,uint256,bytes)[]`. Returns the
 * RawCalls (capped to MAX_ACTION_ELEMENTS) plus whether the source was longer,
 * or null on any failure (empty / too short / malformed / non-address target) —
 * never guesses. Chain-agnostic: callers set `chainId` if needed.
 */
export function decodeActionTuples(blob: Hex): { calls: RawCall[]; truncated: boolean } | null {
  try {
    if (!blob || blob === "0x" || size(blob) < 64) return null;
    const [arr] = decodeAbiParameters(ACTION_TUPLE, blob) as unknown as [Array<[string, bigint, Hex]>];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (!arr.every((t) => isAddress(t[0]))) return null;
    const truncated = arr.length > MAX_ACTION_ELEMENTS;
    const limited = truncated ? arr.slice(0, MAX_ACTION_ELEMENTS) : arr;
    return { calls: limited.map((t) => ({ to: getAddress(t[0]), value: t[1], data: t[2] })), truncated };
  } catch {
    return null;
  }
}

/**
 * Convenience wrapper returning just the (capped) RawCalls, or null on failure.
 * Used where the caller doesn't need the truncation signal.
 */
export function decodeActionTupleArray(blob: Hex): RawCall[] | null {
  return decodeActionTuples(blob)?.calls ?? null;
}
