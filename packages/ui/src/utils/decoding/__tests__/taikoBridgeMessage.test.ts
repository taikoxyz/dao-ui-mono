import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { taikoBridgeMessage } from "../unwrappers/taikoBridgeMessage";
import type { DecodedNode } from "../types";

const MESSAGE = "(uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes)";
const TO_L2 = "0x4EBeC8a624ac6f01Bb6C7F13947E6Af3727319CA" as const;
const INNER = "0x3659cfe60000000000000000000000007e83af941fdcf90eb44ed7dc8754a201b156e0ba" as Hex; // upgradeTo(0x7e83…)

function messageTuple(opts: { destChainId: bigint; to: Hex; value: bigint; data: Hex }) {
  return [0n, 0n, 0, TO_L2, 0n, TO_L2, opts.destChainId, TO_L2, opts.to, opts.value, opts.data] as const;
}

function nodeFor(functionName: string, signature: string, paramType: string, value: unknown): DecodedNode {
  return {
    to: TO_L2, value: 0n, data: "0x" as Hex, chainId: 1, selector: "0x1bdb0037",
    functionName, signature, params: [{ name: "_message", type: paramType, value: value as any }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [],
  };
}

describe("taikoBridgeMessage", () => {
  it("matches sendMessage and emits a cross-chain child from the decoded struct", async () => {
    const struct = { id:0n, fee:0n, gasLimit:0, from:TO_L2, srcChainId:0n, srcOwner:TO_L2, destChainId:167000n, destOwner:TO_L2, to:TO_L2, value:5n, data:INNER };
    const node = nodeFor("sendMessage", "sendMessage(" + MESSAGE + ")", "tuple", struct);
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ chainId: 167000, to: TO_L2, value: 5n, data: INNER });
  });

  it("matches onMessageInvocation(bytes) and decodes+validates the inner Message", async () => {
    const encoded = encodeAbiParameters(parseAbiParameters(MESSAGE), [messageTuple({ destChainId: 167000n, to: TO_L2, value: 0n, data: INNER })]);
    const node = nodeFor("onMessageInvocation", "onMessageInvocation(bytes)", "bytes", encoded);
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(1);
    expect(children[0].chainId).toBe(167000);
    expect(children[0].data).toBe(INNER);
  });

  it("emits no child when onMessageInvocation bytes are malformed", async () => {
    const node = nodeFor("onMessageInvocation", "onMessageInvocation(bytes)", "bytes", "0x1234");
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(0);
  });

  it("does not match an unrelated verified function", async () => {
    const node = nodeFor("transfer", "transfer(address,uint256)", "address", TO_L2);
    expect(taikoBridgeMessage.match(node)).toBe(false);
  });

  it("does not match sendMessage decoded only from the signature DB (untrusted) and emits no child", async () => {
    const struct = { id:0n, fee:0n, gasLimit:0, from:TO_L2, srcChainId:0n, srcOwner:TO_L2, destChainId:167000n, destOwner:TO_L2, to:TO_L2, value:5n, data:INNER };
    const node = nodeFor("sendMessage", "sendMessage(" + MESSAGE + ")", "tuple", struct);
    node.trust = "signature-db";
    expect(taikoBridgeMessage.match(node)).toBe(false);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(0);
  });
});
