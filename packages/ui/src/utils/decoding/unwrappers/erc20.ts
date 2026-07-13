import { formatUnits, type Address } from "viem";
import type { Unwrapper } from "../types";
import { shortHex } from "../format";

const TRANSFER_FROM = "0x23b872dd";
const APPROVE = "0x095ea7b3";

// Match on the resolved canonical signature, not the bare selector: a foreign
// contract whose function selector merely collides with one of these must not be
// summarized as an ERC-20 transfer/approve.
const SIGNATURES = new Set(["transfer(address,uint256)", "transferFrom(address,address,uint256)", "approve(address,uint256)"]);

export const erc20: Unwrapper = {
  id: "erc20",
  match: (node) => node.signature != null && SIGNATURES.has(node.signature),
  apply: async (node, ctx) => {
    const meta = await ctx.loadToken(node.to, node.chainId);
    if (!meta) return { summary: null, children: [] };

    const amount = node.params[node.params.length - 1]?.value as bigint;
    const amt = `${formatUnits(amount ?? 0n, meta.decimals)} ${meta.symbol}`;
    if (node.selector === APPROVE) {
      const spender = node.params[0]?.value as Address;
      return { summary: `Approve ${shortHex(spender)} to spend ${amt}`, children: [] };
    }
    const dst = (node.selector === TRANSFER_FROM ? node.params[1]?.value : node.params[0]?.value) as Address;
    return { summary: `Transfer ${amt} → ${shortHex(dst)}`, children: [] };
  },
};
