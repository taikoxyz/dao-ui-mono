import { describe, it, expect } from "vitest";
import { contractLabel } from "../actionNode.helpers";

describe("contractLabel", () => {
  it("returns the name when there is no proxy name", () => {
    expect(contractLabel({ name: "TaikoL1" })).toBe("TaikoL1");
  });

  it("joins proxy and implementation names with an arrow", () => {
    expect(contractLabel({ name: "OptimisticTokenVotingPlugin", proxyName: "ERC1967Proxy" })).toBe(
      "ERC1967Proxy → OptimisticTokenVotingPlugin",
    );
  });

  it("returns the proxy name alone when the implementation name is missing", () => {
    expect(contractLabel({ proxyName: "ERC1967Proxy" })).toBe("ERC1967Proxy");
  });

  it("collapses to a single name when proxy and implementation names are identical", () => {
    expect(contractLabel({ name: "DAO", proxyName: "DAO" })).toBe("DAO");
  });

  it("returns null when no name is available", () => {
    expect(contractLabel({})).toBeNull();
  });
});
