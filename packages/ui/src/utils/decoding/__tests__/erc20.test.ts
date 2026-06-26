import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { erc20 } from "../unwrappers/erc20";

const TOKEN = "0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800";
const DST = "0x000000000000000000000000000000000000dEaD";

function node(): DecodedNode {
  return {
    to: TOKEN as `0x${string}`, value: 0n, data: "0xa9059cbb" as `0x${string}`,
    selector: "0xa9059cbb", functionName: "transfer", signature: "transfer(address,uint256)",
    params: [{ name: "to", type: "address", value: DST }, { name: "amount", type: "uint256", value: 1500000n }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [],
  };
}
const ctx = { loadToken: async () => ({ decimals: 6, symbol: "USDC" }) } as unknown as DecodeCtx;

describe("erc20 unwrapper", () => {
  it("formats transfer amount with token decimals and symbol", async () => {
    const n = node();
    expect(erc20.match(n)).toBe(true);
    const { summary } = await erc20.apply(n, ctx);
    expect(summary).toBe("Transfer 1.5 USDC → 0x0000…dEaD");
  });
});
