import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, concat, type Hex } from "viem";
import { delegateControllerCall } from "../unwrappers/delegateControllerCall";
import type { DecodedNode } from "../types";

const TARGET1 = "0x1670000000000000000000000000000000010001" as const;
const TARGET2 = "0x1670000000000000000000000000000000000005" as const;
const UPGRADE = ("0x3659cfe6" + "00".repeat(32)) as Hex;

// _data = 8-byte executionId + abi.encode(Action[])
function makeData(items: Array<[Hex, bigint, Hex]>): Hex {
  const actions = encodeAbiParameters(parseAbiParameters("(address,uint256,bytes)[]"), [items]);
  return concat(["0x0000000000000000", actions]);
}

function node(overrides: Partial<DecodedNode> = {}): DecodedNode {
  return {
    to: "0x00000000000000000000000000000000000000Aa",
    value: 0n,
    data: "0x" as Hex,
    chainId: 167000,
    selector: "0x7f07c947",
    functionName: "onMessageInvocation",
    signature: "onMessageInvocation(bytes)",
    params: [{ name: "_data", type: "bytes", value: makeData([[TARGET1, 0n, UPGRADE], [TARGET2, 0n, UPGRADE]]) }],
    trust: "verified",
    isProxy: false,
    implementation: null,
    name: "DelegateController",
    summary: null,
    children: [],
    ...overrides,
  };
}

describe("delegateControllerCall", () => {
  it("matches a verified DelegateController onMessageInvocation and emits actions as children on the node's chain", async () => {
    const n = node();
    expect(delegateControllerCall.match(n)).toBe(true);
    const { summary, children } = await delegateControllerCall.apply(n, {} as any);
    expect(summary).toBe("Executes 2 action(s)");
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ to: TARGET1, value: 0n, data: UPGRADE, chainId: 167000 });
    expect(children[1].to).toBe(TARGET2);
  });

  it("does not match when trust is not verified", () => {
    expect(delegateControllerCall.match(node({ trust: "bytecode" }))).toBe(false);
  });

  it("does not match when the contract name is not in the allowlist", () => {
    expect(delegateControllerCall.match(node({ name: "SomeOtherContract" }))).toBe(false);
    expect(delegateControllerCall.match(node({ name: undefined }))).toBe(false);
  });

  it("matches DelegateOwner too", () => {
    expect(delegateControllerCall.match(node({ name: "DelegateOwner" }))).toBe(true);
  });

  it("does not match when _data is shorter than the 8-byte executionId", () => {
    expect(delegateControllerCall.match(node({ params: [{ name: "_data", type: "bytes", value: "0x1234" }] }))).toBe(false);
  });

  it("does not match a non-onMessageInvocation function", () => {
    expect(delegateControllerCall.match(node({ functionName: "transfer" }))).toBe(false);
  });
});
