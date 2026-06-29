import { describe, it, expect } from "vitest";
import { PUB_CHAIN } from "@/constants";
import { chainLabel, childNumber, contractLabel, friendlySignature } from "../actionNode.helpers";

describe("chainLabel", () => {
  it("returns null for the app chain", () => {
    // The app chain id is derived from PUB_CHAIN.id (env-dependent), so assert
    // against it directly rather than a hardcoded id the env might not match.
    expect(chainLabel(PUB_CHAIN.id)).toBeNull();
  });

  it("labels Taiko mainnet", () => {
    expect(chainLabel(167000)).toMatch(/Taiko/i);
  });

  it("labels an unknown chain by id", () => {
    expect(chainLabel(424242)).toMatch(/424242/);
  });
});

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

describe("childNumber", () => {
  it("numbers top-level rows from 1", () => {
    expect(childNumber("", 0)).toBe("1");
    expect(childNumber("", 2)).toBe("3");
  });
  it("nests under the parent number", () => {
    expect(childNumber("3", 0)).toBe("3.1");
    expect(childNumber("3.1", 1)).toBe("3.1.2");
  });
});

describe("friendlySignature", () => {
  it("uses the struct name from internalType for the short form", () => {
    const node = {
      functionName: "sendMessage",
      signature: "sendMessage((uint64,address))",
      params: [{ name: "message", type: "tuple", value: {}, internalType: "struct IBridge.Message" }],
    };
    const s = friendlySignature(node as any);
    expect(s.short).toBe("sendMessage(IBridge.Message message)");
    expect(s.full).toBe("sendMessage((uint64,address))");
  });
  it("falls back to the solidity type when no internalType", () => {
    const node = {
      functionName: "upgradeTo",
      signature: "upgradeTo(address)",
      params: [{ name: "newImplementation", type: "address", value: "0x" }],
    };
    expect(friendlySignature(node as any).short).toBe("upgradeTo(address newImplementation)");
  });
  it("returns null short when there is no function name", () => {
    expect(friendlySignature({ functionName: null, signature: null, params: [] } as any).short).toBeNull();
  });
});
