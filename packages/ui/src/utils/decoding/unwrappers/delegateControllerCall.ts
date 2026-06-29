import { size, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";
import { decodeActionTupleArray } from "./actionArray";

// Taiko contracts that expose onMessageInvocation(bytes) with the
// `executionId + Action[]` payload (verified-source confirmed).
const DELEGATE_NAMES = new Set(["DelegateController", "DelegateOwner"]);

/**
 * Decode a DelegateController onMessageInvocation payload into its actions, or
 * null if it isn't one we can trust+validate. `_data` = 8-byte executionId then
 * abi.encode((address,uint256,bytes)[]).
 */
function extractActions(node: DecodedNode): RawCall[] | null {
  if (node.functionName !== "onMessageInvocation") return null;
  if (node.params[0]?.type !== "bytes") return null;
  if (node.trust !== "verified") return null;
  if (!node.name || !DELEGATE_NAMES.has(node.name)) return null;
  const data = node.params[0].value as Hex;
  if (!data || size(data) < 8) return null;
  return decodeActionTupleArray(slice(data, 8));
}

// match() and apply() both decode; cache per node to avoid doing it twice.
const cache = new WeakMap<DecodedNode, RawCall[] | null>();
function actionsFor(node: DecodedNode): RawCall[] | null {
  if (cache.has(node)) return cache.get(node) ?? null;
  const result = extractActions(node);
  cache.set(node, result);
  return result;
}

export const delegateControllerCall: Unwrapper = {
  id: "delegate-controller-call",
  match: (node) => actionsFor(node) !== null,
  apply: async (node) => {
    const actions = actionsFor(node) ?? [];
    const children: RawCall[] = actions.map((c) => ({ ...c, chainId: node.chainId }));
    return { summary: `Executes ${children.length} action(s)`, children };
  },
};
