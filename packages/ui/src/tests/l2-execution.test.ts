import { describe, expect, test } from "bun:test";
import { encodeFunctionData, toFunctionSelector, type Address, type Hex } from "viem";
import {
  bridgeSendMessageAbi,
  getConfirmedL2MessageOutcome,
  hasL2LegFromActions,
  isBridgeL2Send,
  shouldRenderL2ExecutionCard,
} from "../utils/l2-execution";
import { type RawAction } from "../utils/types";

const BRIDGE: Address = "0xd60247c6848B7Ca29eDdF63AA924E53dB6Ddd8EC";
const OTHER: Address = "0x0000000000000000000000000000000000000001";
const TAIKO_L2 = 167000;

const message = (destChainId: bigint) => ({
  id: 0n,
  fee: 0n,
  gasLimit: 1_000_000,
  from: OTHER,
  srcChainId: 1n,
  srcOwner: OTHER,
  destChainId,
  destOwner: OTHER,
  to: OTHER,
  value: 0n,
  data: "0x" as Hex,
});

const sendMessageData = (destChainId: bigint) =>
  encodeFunctionData({ abi: bridgeSendMessageAbi, functionName: "sendMessage", args: [message(destChainId)] });

const action = (to: Address, data: Hex): RawAction => ({ to, value: 0n, data });

// A governance call on the bridge itself (L1-only) — not a cross-chain send.
const pauseAbi = [{ type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] }] as const;
const pauseData = encodeFunctionData({ abi: pauseAbi, functionName: "pause", args: [] });

describe("isBridgeL2Send", () => {
  test("the derived sendMessage selector matches the deployed Taiko bridge", () => {
    expect(
      toFunctionSelector(
        "function sendMessage((uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes))"
      )
    ).toBe("0x1bdb0037");
    expect(sendMessageData(BigInt(TAIKO_L2)).slice(0, 10)).toBe("0x1bdb0037");
  });

  test("detects a real sendMessage to Taiko L2", () => {
    expect(isBridgeL2Send(action(BRIDGE, sendMessageData(BigInt(TAIKO_L2))), BRIDGE, TAIKO_L2)).toBe(true);
  });

  test("ignores an L1-only governance call on the bridge (the false-positive that shipped)", () => {
    expect(isBridgeL2Send(action(BRIDGE, pauseData), BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("ignores a sendMessage bound for a different chain", () => {
    expect(isBridgeL2Send(action(BRIDGE, sendMessageData(999n)), BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("ignores a sendMessage sent to a non-bridge target", () => {
    expect(isBridgeL2Send(action(OTHER, sendMessageData(BigInt(TAIKO_L2))), BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("ignores an unrelated call that merely embeds the bridge address in its calldata", () => {
    const embedded = ("0xdeadbeef" + BRIDGE.slice(2).toLowerCase().padStart(64, "0")) as Hex;
    expect(isBridgeL2Send(action(OTHER, embedded), BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("is inert when no bridge address is configured", () => {
    expect(isBridgeL2Send(action(BRIDGE, sendMessageData(BigInt(TAIKO_L2))), "", TAIKO_L2)).toBe(false);
  });
});

describe("hasL2LegFromActions", () => {
  test("is false for an empty action list", () => {
    expect(hasL2LegFromActions([], BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("is false for an L1-only proposal", () => {
    expect(hasL2LegFromActions([action(BRIDGE, pauseData), action(OTHER, "0x")], BRIDGE, TAIKO_L2)).toBe(false);
  });

  test("is true when any action is a bridge send to L2", () => {
    const actions = [action(OTHER, "0x"), action(BRIDGE, sendMessageData(BigInt(TAIKO_L2)))];
    expect(hasL2LegFromActions(actions, BRIDGE, TAIKO_L2)).toBe(true);
  });
});

describe("shouldRenderL2ExecutionCard", () => {
  test("keeps the card visible while an executed proposal with a tx hash is still being checked", () => {
    expect(
      shouldRenderL2ExecutionCard({
        hasL2Leg: false,
        isExtracting: false,
        shouldCheckExecutedProposal: true,
      })
    ).toBe(true);
  });

  test("hides the card when there is no detected L2 leg and no active check", () => {
    expect(
      shouldRenderL2ExecutionCard({
        hasL2Leg: false,
        isExtracting: false,
        shouldCheckExecutedProposal: false,
      })
    ).toBe(false);
  });
});

describe("getConfirmedL2MessageOutcome", () => {
  test("treats DONE as a success", () => {
    expect(getConfirmedL2MessageOutcome(2)).toBe("success");
  });

  test("treats FAILED as a failure", () => {
    expect(getConfirmedL2MessageOutcome(3)).toBe("failed");
  });

  test("treats all other statuses as pending bridge processing", () => {
    expect(getConfirmedL2MessageOutcome(0)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(1)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(4)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(undefined)).toBe("pending");
  });
});
