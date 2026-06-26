import { decodeAbiParameters, parseAbiParameters, getAddress, isAddress, size, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";

const ACTION_TUPLE = parseAbiParameters("(address,uint256,bytes)[]");
const EXECUTE_BYTES = "0x09c5eabe";
const EXECUTE_BYTES_SIGNATURE = "execute(bytes)";

function isExecuteBytes(node: DecodedNode): boolean {
  if (node.signature) return node.signature === EXECUTE_BYTES_SIGNATURE;
  return node.selector === EXECUTE_BYTES;
}

function candidateBlobs(node: DecodedNode): Hex[] {
  if (!isExecuteBytes(node)) return [];

  const fromParams = node.params.filter((p) => p.type === "bytes").map((p) => p.value as Hex);
  if (fromParams.length) return fromParams;
  // execute(bytes) whose ABI may not have decoded params: pull the single bytes arg directly.
  if (node.selector === EXECUTE_BYTES && node.data.length > 10) {
    try {
      return [decodeAbiParameters(parseAbiParameters("bytes"), slice(node.data, 4))[0] as Hex];
    } catch {
      return [];
    }
  }
  return [];
}

function decodeActionArray(node: DecodedNode): RawCall[] | null {
  for (const blob of candidateBlobs(node)) {
    if (!blob || blob === "0x" || size(blob) < 64) continue;
    try {
      const [arr] = decodeAbiParameters(ACTION_TUPLE, blob) as unknown as [Array<[string, bigint, Hex]>];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      if (!arr.every((t) => isAddress(t[0]))) continue;
      return arr.map((t) => ({ to: getAddress(t[0]), value: t[1], data: t[2] }));
    } catch {
      continue;
    }
  }
  return null;
}

// `match()` and `apply()` both need the decoded array; cache per node so the ABI
// decode runs once rather than twice for every batch call.
const cache = new WeakMap<DecodedNode, RawCall[] | null>();

export function extractActionArray(node: DecodedNode): RawCall[] | null {
  if (cache.has(node)) return cache.get(node) ?? null;
  const result = decodeActionArray(node);
  cache.set(node, result);
  return result;
}

export const osxActionArray: Unwrapper = {
  id: "osx-action-array",
  match: (node) => extractActionArray(node) !== null,
  apply: async (node) => {
    const children = extractActionArray(node) ?? [];
    return { summary: `Executes ${children.length} sub-action(s)`, children };
  },
};
