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

/**
 * What the L2 execution card should render once extraction has settled.
 *
 * Order matters: a failure to read the L1 receipt must be reported before the
 * "this proposal has no L2 leg" bail-out. An executed proposal has its actions
 * cleared from the contract, so `detectedFromActions` is false in exactly the
 * situation where the error is worth showing — checking the bail-out first
 * swallowed it and rendered nothing at all.
 */
export type L2ExtractionView = "error" | "no-message" | "waiting" | "hidden" | "ready";

export function getL2ExtractionView({
  extractError,
  noMessageFound,
  hasMessage,
  detectedFromActions,
}: {
  extractError: string | null;
  noMessageFound: boolean;
  hasMessage: boolean;
  detectedFromActions: boolean;
}): L2ExtractionView {
  if (extractError) return "error";
  // Checked after extractError and ahead of everything below it: a message that
  // was actually extracted outranks noMessageFound, so a stale flag from an
  // earlier attempt can never hide a message we now hold. extractError keeps
  // priority because the two cannot coexist — the extraction effect clears both
  // when it starts an attempt and again once one produces a message.
  if (hasMessage) return "ready";
  // The actions promised a bridge sendMessage bound for L2, but the executed
  // transaction emitted no MessageSent — there is nothing to prove on L2.
  if (noMessageFound && detectedFromActions) return "no-message";
  if (!detectedFromActions) return "hidden";
  // The actions declare an L2 leg but extraction has produced neither a message
  // nor a verdict yet. Never "ready": that renders the execute card around a
  // null message, and executeL2 no-ops on !message — the dead button this
  // helper exists to prevent.
  return "waiting";
}
