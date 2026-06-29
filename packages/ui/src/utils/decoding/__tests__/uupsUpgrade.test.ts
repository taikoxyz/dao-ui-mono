import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { uupsUpgrade } from "../unwrappers/uupsUpgrade";

const NEW_IMPL = "0x349ae3578f48f758d79451eeab61cdd5fedd0098";
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f";

function node(partial: Partial<DecodedNode>): DecodedNode {
  return {
    to: PROXY as `0x${string}`, value: 0n, data: "0x3659cfe6" as `0x${string}`,
    selector: "0x3659cfe6", functionName: "upgradeTo", signature: "upgradeTo(address)",
    params: [{ name: "newImplementation", type: "address", value: NEW_IMPL }],
    chainId: 1, trust: "verified", isProxy: true, implementation: null, summary: null, children: [], ...partial,
  };
}
const ctx = { loadToken: async () => null } as unknown as DecodeCtx;

describe("uups-upgrade unwrapper", () => {
  it("matches upgradeTo and summarizes", async () => {
    const n = node({});
    expect(uupsUpgrade.match(n)).toBe(true);
    const { summary, children } = await uupsUpgrade.apply(n, ctx);
    expect(summary).toContain("Upgrades proxy");
    expect(summary).toContain("0x349a");
    expect(children).toHaveLength(0);
  });

  it("recurses into upgradeToAndCall's inner call", async () => {
    const n = node({
      selector: "0x4f1ef286", functionName: "upgradeToAndCall", signature: "upgradeToAndCall(address,bytes)",
      params: [
        { name: "newImplementation", type: "address", value: NEW_IMPL },
        { name: "data", type: "bytes", value: "0x8456cb59" },
      ],
    });
    expect(uupsUpgrade.match(n)).toBe(true);
    const { children } = await uupsUpgrade.apply(n, ctx);
    expect(children).toHaveLength(1);
    expect(children[0].to.toLowerCase()).toBe(NEW_IMPL.toLowerCase());
    expect(children[0].data).toBe("0x8456cb59");
  });

  it("does NOT match a selector collision with a different signature", () => {
    expect(uupsUpgrade.match(node({ signature: "upgradeToken(address)" }))).toBe(false);
    expect(uupsUpgrade.match(node({ signature: null }))).toBe(false);
  });
});
