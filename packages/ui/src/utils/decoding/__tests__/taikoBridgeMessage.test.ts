import { describe, it, expect } from "vitest";
import type { Hex } from "viem";
import { taikoBridgeMessage } from "../unwrappers/taikoBridgeMessage";
import { TAIKO_L2_BRIDGE_ADDRESS } from "@/constants";
import type { DecodedNode } from "../types";

const MESSAGE = "(uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes)";

// A known bridge contract (deterministic L2 precompile) — passes the isKnownBridge identity gate.
const BRIDGE = TAIKO_L2_BRIDGE_ADDRESS;
// A foreign contract that is NOT a known bridge.
const NOT_BRIDGE = "0x4EBeC8a624ac6f01Bb6C7F13947E6Af3727319CA" as const;

// Distinct value per Message field so a same-type field swap (address↔address, uint↔uint)
// is actually caught instead of silently passing. IBridge.Message field order is:
//   (id, fee, gasLimit, from, srcChainId, srcOwner, destChainId, destOwner, to, value, data)
const FROM = "0x1111111111111111111111111111111111111111" as const;
const SRC_OWNER = "0x2222222222222222222222222222222222222222" as const;
const DEST_OWNER = "0x3333333333333333333333333333333333333333" as const;
const TARGET = "0x4444444444444444444444444444444444444444" as const; // Message.to (cross-chain target)
const INNER = "0x3659cfe60000000000000000000000007e83af941fdcf90eb44ed7dc8754a201b156e0ba" as Hex; // upgradeTo(0x7e83…)

// Independently-stated expected constants (NOT reused to build the fixture below).
const EXPECT_DEST_CHAIN = 167000;
const EXPECT_VALUE = 99n;

// Message in IBridge.Message order with distinct, non-zero values per slot.
// id=11, fee=22, gasLimit=33, from, srcChainId=44, srcOwner, destChainId=167000, destOwner, to, value=99, data
const MESSAGE_ARRAY = [11n, 22n, 33, FROM, 44n, SRC_OWNER, 167000n, DEST_OWNER, TARGET, 99n, INNER] as const;

// Named-object form of the same message (exercises readMessage's object branch).
const MESSAGE_OBJECT = {
  id: 11n, fee: 22n, gasLimit: 33, from: FROM, srcChainId: 44n, srcOwner: SRC_OWNER,
  destChainId: 167000n, destOwner: DEST_OWNER, to: TARGET, value: 99n, data: INNER,
} as const;

function sendMessageNode(opts: { to: string; value: unknown; trust?: DecodedNode["trust"] }): DecodedNode {
  return {
    to: opts.to as Hex, value: 0n, data: "0x" as Hex, chainId: 1, selector: "0x1bdb0037",
    functionName: "sendMessage", signature: "sendMessage(" + MESSAGE + ")",
    params: [{ name: "_message", type: "tuple", value: opts.value as any }],
    trust: opts.trust ?? "verified", isProxy: false, implementation: null, summary: null, children: [],
  };
}

describe("taikoBridgeMessage", () => {
  it("matches a verified sendMessage on a known bridge and emits the cross-chain child (array form)", async () => {
    const node = sendMessageNode({ to: BRIDGE, value: MESSAGE_ARRAY });
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(1);
    // Each asserted field reads a distinct slot, so a field-order bug surfaces here.
    expect(children[0]).toMatchObject({ chainId: EXPECT_DEST_CHAIN, to: TARGET, value: EXPECT_VALUE, data: INNER });
  });

  it("decodes the same message in named-object form", async () => {
    const node = sendMessageNode({ to: BRIDGE, value: MESSAGE_OBJECT });
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children[0]).toMatchObject({ chainId: EXPECT_DEST_CHAIN, to: TARGET, value: EXPECT_VALUE, data: INNER });
  });

  it("does NOT match a verified sendMessage whose target is not a known bridge (address-bind)", async () => {
    const node = sendMessageNode({ to: NOT_BRIDGE, value: MESSAGE_ARRAY });
    expect(taikoBridgeMessage.match(node)).toBe(false);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(0);
  });

  it("does not match an unrelated verified function", async () => {
    const node = sendMessageNode({ to: BRIDGE, value: MESSAGE_ARRAY });
    node.functionName = "transfer";
    node.signature = "transfer(address,uint256)";
    node.params = [{ name: "to", type: "address", value: TARGET as any }];
    expect(taikoBridgeMessage.match(node)).toBe(false);
  });

  it("does not match sendMessage decoded only from the signature DB (untrusted) and emits no child", async () => {
    const node = sendMessageNode({ to: BRIDGE, value: MESSAGE_ARRAY, trust: "signature-db" });
    expect(taikoBridgeMessage.match(node)).toBe(false);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(0);
  });
});

// Coverage gap: these fixtures are hand-built to be adversarial to field-order bugs, but they
// are not a real on-chain sendMessage sample (no network access here). A captured mainnet bridge
// proposal calldata would additionally validate that our tuple field order matches the deployed
// contract's actual ABI encoding.
