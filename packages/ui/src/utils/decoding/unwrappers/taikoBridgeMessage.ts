import { isAddress, getAddress, type Address, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";
import { isKnownBridge } from "../knownContracts";

// Taiko IBridge.Message field order:
// (id,fee,gasLimit,from,srcChainId,srcOwner,destChainId,destOwner,to,value,data)
const FIELDS = ["id","fee","gasLimit","from","srcChainId","srcOwner","destChainId","destOwner","to","value","data"] as const;

type MessageView = { destChainId: bigint; to: string; value: bigint; data: Hex };

/** Read a tuple field from viem's decode, whether it returned an object (named) or an array. */
function readMessage(value: unknown): MessageView | null {
  if (value == null) return null;
  const get = (name: (typeof FIELDS)[number]) => {
    if (Array.isArray(value)) return value[FIELDS.indexOf(name)];
    return (value as Record<string, unknown>)[name];
  };
  const destChainId = get("destChainId");
  const to = get("to");
  const data = get("data");
  const valueField = get("value");
  if (typeof destChainId !== "bigint" || typeof to !== "string" || typeof data !== "string") return null;
  if (!isAddress(to)) return null;
  if (destChainId <= 0n) return null;
  return { destChainId, to, value: typeof valueField === "bigint" ? valueField : 0n, data: data as Hex };
}

// A trusted bridge `sendMessage((tuple))`: verified ABI AND the call target is a known
// bridge contract. The address bind stops a foreign contract that merely exposes a
// sendMessage((tuple)) signature from being labeled a "Bridge message".
function isSendMessage(node: DecodedNode): boolean {
  return (
    node.trust === "verified" &&
    node.functionName === "sendMessage" &&
    node.params[0]?.type?.startsWith("tuple") === true &&
    isKnownBridge(node.to)
  );
}

/** Extract the routed Message, or null if it can't be trusted. */
function extractMessage(node: DecodedNode): MessageView | null {
  if (isSendMessage(node)) {
    return readMessage(node.params[0]?.value);
  }
  return null;
}

// NOTE: onMessageInvocation(bytes) is intentionally NOT handled here. Its payload is
// `8-byte executionId + abi.encode((address,uint256,bytes)[])` — an Action array, NOT an
// IBridge.Message — and is decoded by delegateControllerCall (the sole onMessageInvocation
// handler). A real bridge sendMessage's Message.data is emitted below as a child RawCall and
// decoded independently; if that child is itself an onMessageInvocation call, delegateControllerCall
// unwraps it then.
export const taikoBridgeMessage: Unwrapper = {
  id: "taiko-bridge-message",
  match: (node) => isSendMessage(node) && extractMessage(node) !== null,
  apply: async (node) => {
    const msg = extractMessage(node);
    if (!msg) return { summary: null, children: [] };
    const child: RawCall = {
      chainId: Number(msg.destChainId),
      to: getAddress(msg.to as Address),
      value: msg.value,
      data: msg.data,
    };
    return { summary: `Bridge message → chain ${msg.destChainId}`, children: [child] };
  },
};
