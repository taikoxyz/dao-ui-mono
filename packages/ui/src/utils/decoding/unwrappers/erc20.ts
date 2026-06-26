import { formatUnits, type Address } from "viem";
import type { Unwrapper } from "../types";

const TRANSFER = "0xa9059cbb";
const TRANSFER_FROM = "0x23b872dd";
const APPROVE = "0x095ea7b3";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const erc20: Unwrapper = {
  id: "erc20",
  match: (node) => node.selector === TRANSFER || node.selector === TRANSFER_FROM || node.selector === APPROVE,
  apply: async (node, ctx) => {
    const meta = (await ctx.loadToken(node.to)) ?? { decimals: 18, symbol: "tokens" };
    const amount = node.params[node.params.length - 1]?.value as bigint;
    const amt = `${formatUnits(amount ?? 0n, meta.decimals)} ${meta.symbol}`;
    if (node.selector === APPROVE) {
      const spender = node.params[0]?.value as Address;
      return { summary: `Approve ${short(spender)} to spend ${amt}`, children: [] };
    }
    const dst = (node.selector === TRANSFER_FROM ? node.params[1]?.value : node.params[0]?.value) as Address;
    return { summary: `Transfer ${amt} → ${short(dst)}`, children: [] };
  },
};
