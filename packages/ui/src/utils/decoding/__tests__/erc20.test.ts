import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { erc20 } from "../unwrappers/erc20";

const TOKEN = "0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800";
const DST = "0x000000000000000000000000000000000000dEaD";
const SPENDER = "0x000000000000000000000000000000000000bEEF";

function node(p: Partial<DecodedNode> = {}): DecodedNode {
  return {
    to: TOKEN as `0x${string}`, value: 0n, data: "0xa9059cbb" as `0x${string}`,
    selector: "0xa9059cbb", functionName: "transfer", signature: "transfer(address,uint256)",
    params: [{ name: "to", type: "address", value: DST }, { name: "amount", type: "uint256", value: 1500000n }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [], ...p,
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

  it("formats transferFrom using the recipient (second arg)", async () => {
    const n = node({
      selector: "0x23b872dd",
      functionName: "transferFrom",
      signature: "transferFrom(address,address,uint256)",
      params: [
        { name: "from", type: "address", value: SPENDER },
        { name: "to", type: "address", value: DST },
        { name: "amount", type: "uint256", value: 1500000n },
      ],
    });
    expect(erc20.match(n)).toBe(true);
    const { summary } = await erc20.apply(n, ctx);
    expect(summary).toBe("Transfer 1.5 USDC → 0x0000…dEaD");
  });

  it("formats approve with spender and allowance", async () => {
    const n = node({
      selector: "0x095ea7b3",
      functionName: "approve",
      signature: "approve(address,uint256)",
      params: [{ name: "spender", type: "address", value: SPENDER }, { name: "amount", type: "uint256", value: 1500000n }],
    });
    expect(erc20.match(n)).toBe(true);
    const { summary } = await erc20.apply(n, ctx);
    expect(summary).toBe("Approve 0x0000…bEEF to spend 1.5 USDC");
  });

  it("does NOT match a selector collision with a different signature", () => {
    // Same 4-byte selector as transfer(), but a different function — must be rejected.
    expect(erc20.match(node({ signature: "gauge(address,uint256)" }))).toBe(false);
    expect(erc20.match(node({ signature: null }))).toBe(false);
  });

  it("does not summarize ERC-721-shaped calls without ERC-20 metadata", async () => {
    const n = node();
    const nftCtx = { loadToken: async () => null } as unknown as DecodeCtx;
    const { summary } = await erc20.apply(n, nftCtx);
    expect(summary).toBeNull();
  });
});
