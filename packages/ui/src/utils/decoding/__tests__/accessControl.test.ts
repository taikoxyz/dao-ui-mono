import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { accessControl } from "../unwrappers/accessControl";

const C = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f";
const NEW_OWNER = "0x000000000000000000000000000000000000bEEF";
const ctx = {} as DecodeCtx;

function node(p: Partial<DecodedNode>): DecodedNode {
  return {
    to: C as `0x${string}`, value: 0n, data: "0xf2fde38b" as `0x${string}`,
    selector: "0xf2fde38b", functionName: "transferOwnership", signature: "transferOwnership(address)",
    params: [{ name: "newOwner", type: "address", value: NEW_OWNER }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [], ...p,
  };
}

describe("access-control unwrapper", () => {
  it("summarizes transferOwnership", async () => {
    const n = node({});
    expect(accessControl.match(n)).toBe(true);
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toContain("Transfers ownership");
    expect(summary).toContain("0x0000…bEEF");
  });

  it("summarizes acceptOwnership", async () => {
    const n = node({ selector: "0x79ba5097", functionName: "acceptOwnership", signature: "acceptOwnership()", params: [] });
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toContain("Accepts ownership");
  });
});
