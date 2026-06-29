import { decodeAbiParameters, parseAbiParameters, isAddress, getAddress, type Address, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";

// Taiko IBridge.Message tuple (field order confirmed against on-chain proposals).
const MESSAGE_TUPLE = parseAbiParameters(
  "(uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes)",
);
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

function isSendMessage(node: DecodedNode): boolean {
  return node.functionName === "sendMessage" && node.params[0]?.type?.startsWith("tuple") === true;
}
function isOnMessageInvocation(node: DecodedNode): boolean {
  return node.functionName === "onMessageInvocation" && node.params[0]?.type === "bytes";
}

/** Extract the routed Message from either shape, or null if it can't be trusted. */
function extractMessage(node: DecodedNode): MessageView | null {
  if (isSendMessage(node)) {
    return readMessage(node.params[0]?.value);
  }
  if (isOnMessageInvocation(node)) {
    const bytes = node.params[0]?.value as Hex | undefined;
    if (!bytes || bytes === "0x") return null;
    try {
      const [decoded] = decodeAbiParameters(MESSAGE_TUPLE, bytes);
      return readMessage(decoded);
    } catch {
      return null;
    }
  }
  return null;
}

export const taikoBridgeMessage: Unwrapper = {
  id: "taiko-bridge-message",
  match: (node) => (isSendMessage(node) || isOnMessageInvocation(node)) && extractMessage(node) !== null,
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
