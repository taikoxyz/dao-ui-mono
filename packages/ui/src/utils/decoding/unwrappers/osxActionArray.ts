import { decodeAbiParameters, parseAbiParameters, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";
import { decodeActionTuples } from "./actionArray";
import { isKnownExecutor } from "../knownContracts";

type ActionArray = { calls: RawCall[]; truncated: boolean };

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

function decodeActionArray(node: DecodedNode): ActionArray | null {
  for (const blob of candidateBlobs(node)) {
    const result = decodeActionTuples(blob);
    if (result) return result;
  }
  return null;
}

// `match()` and `apply()` both need the decoded array; cache per node so the ABI
// decode runs once rather than twice for every batch call.
const cache = new WeakMap<DecodedNode, ActionArray | null>();

export function extractActionArray(node: DecodedNode): ActionArray | null {
  if (cache.has(node)) return cache.get(node) ?? null;
  const result = decodeActionArray(node);
  cache.set(node, result);
  return result;
}

// Identity gate: only confidently expand execute(bytes) when the target is a
// known DAO executor — recognized by verified contract name ("DAO" /
// "TaikoDAOController") or the configured DAO address. Standard proposals route
// execute() through the TaikoDAOController (0x75Ba…, a DIFFERENT address from the
// OSx DAO at PUB_DAO_ADDRESS), so a DAO-address-only gate wrongly collapses real
// batches to raw calldata; the verified-name gate handles it deployment-agnostically.
// The cross-chain L2 executor path (DelegateController/DelegateOwner) is handled by
// delegateControllerCall. See isKnownExecutor for the tests/unconfigured fallback.
export const osxActionArray: Unwrapper = {
  id: "osx-action-array",
  match: (node) => extractActionArray(node) !== null && isKnownExecutor(node),
  apply: async (node) => {
    const result = extractActionArray(node);
    const children = result?.calls ?? [];
    // Source array was longer than MAX_ACTION_ELEMENTS — surface honestly so the
    // UI shows the cap and signals there were more (never silently fewer).
    if (result?.truncated) node.truncated = "budget";
    return { summary: `Executes ${children.length} sub-action(s)`, children };
  },
};
