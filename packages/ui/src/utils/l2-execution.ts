import { decodeFunctionData } from "viem";
import { type RawAction } from "./types";

// The Taiko bridge `Message` struct, mirrored from the MessageSent event so the
// derived `sendMessage` selector (0x1bdb0037) matches on-chain calldata exactly.
const bridgeMessageComponents = [
  { name: "id", type: "uint64" },
  { name: "fee", type: "uint64" },
  { name: "gasLimit", type: "uint32" },
  { name: "from", type: "address" },
  { name: "srcChainId", type: "uint64" },
  { name: "srcOwner", type: "address" },
  { name: "destChainId", type: "uint64" },
  { name: "destOwner", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "data", type: "bytes" },
] as const;

export const bridgeSendMessageAbi = [
  {
    type: "function",
    name: "sendMessage",
    stateMutability: "payable",
    inputs: [{ name: "_message", type: "tuple", components: bridgeMessageComponents }],
    outputs: [
      { name: "msgHash_", type: "bytes32" },
      { name: "message_", type: "tuple", components: bridgeMessageComponents },
    ],
  },
] as const;

/**
 * A cross-chain L2 leg is specifically a `sendMessage` call to the bridge
 * destined for Taiko L2 — the thing that emits MessageSent and needs a follow-up
 * L2 execution. Merely targeting the bridge (e.g. L1-only governance on the
 * bridge itself) or having the bridge address appear somewhere in calldata does
 * NOT require an L2 execution, so those must not be flagged.
 */
export function isBridgeL2Send(action: RawAction, bridgeAddress: string, l2ChainId: number): boolean {
  if (!bridgeAddress) return false;
  if (action.to.toLowerCase() !== bridgeAddress.toLowerCase()) return false;

  try {
    const { functionName, args } = decodeFunctionData({ abi: bridgeSendMessageAbi, data: action.data });
    if (functionName !== "sendMessage") return false;
    const message = args[0] as { destChainId: bigint };
    return Number(message.destChainId) === l2ChainId;
  } catch {
    // Not a sendMessage call (e.g. a governance call on the bridge) — no L2 leg.
    return false;
  }
}

export function hasL2LegFromActions(actions: RawAction[], bridgeAddress: string, l2ChainId: number): boolean {
  return actions.some((action) => isBridgeL2Send(action, bridgeAddress, l2ChainId));
}

export function shouldRenderL2ExecutionCard({
  hasL2Leg,
  isExtracting,
  shouldCheckExecutedProposal,
}: {
  hasL2Leg: boolean;
  isExtracting: boolean;
  shouldCheckExecutedProposal: boolean;
}) {
  return hasL2Leg || isExtracting || shouldCheckExecutedProposal;
}

export function getConfirmedL2MessageOutcome(messageStatus?: number) {
  if (messageStatus === 2) return "success";
  if (messageStatus === 3) return "failed";

  return "pending";
}
