import { describe, it, expect } from "vitest";
import { PUB_CHAIN } from "@/constants";
import { chainLabel, childNumber, contractLabel, friendlySignature, leadParts, worstTrust } from "../actionNode.helpers";
import type { DecodedNode, TrustLevel } from "@/utils/decoding/types";

// Minimal DecodedNode factory for the pure view-model helpers under test.
function makeNode(overrides: Partial<DecodedNode> = {}): DecodedNode {
  return {
    to: "0x0000000000000000000000000000000000000000",
    value: 0n,
    data: "0x",
    selector: "0x12345678",
    functionName: null,
    signature: null,
    params: [],
    trust: "verified",
    isProxy: false,
    implementation: null,
    chainId: PUB_CHAIN.id,
    summary: null,
    children: [],
    ...overrides,
  };
}

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

describe("worstTrust", () => {
  it("returns the node's own trust for a leaf", () => {
    expect(worstTrust(makeNode({ trust: "bytecode" }))).toBe("bytecode");
  });

  it("returns the least-trusted level across descendants", () => {
    // verified root, but an unknown grandchild must surface as the worst.
    const node = makeNode({
      trust: "verified",
      children: [
        makeNode({ trust: "verified", children: [makeNode({ trust: "unknown" })] }),
        makeNode({ trust: "bytecode" }),
      ],
    });
    expect(worstTrust(node)).toBe("unknown");
  });

  it("ranks unknown below bytecode below verified", () => {
    const order: TrustLevel[] = ["verified", "bytecode", "unknown"];
    // Each level paired with a verified sibling must collapse to itself (it is worse).
    for (const level of order) {
      const node = makeNode({ trust: "verified", children: [makeNode({ trust: level })] });
      expect(worstTrust(node)).toBe(level);
    }
  });

  it("keeps a fully verified tree verified", () => {
    const node = makeNode({ trust: "verified", children: [makeNode({ trust: "verified" })] });
    expect(worstTrust(node)).toBe("verified");
  });
});

describe("leadParts setXTrusted heuristic", () => {
  it("reads Trust/Untrust from a strict set<Thing>Trusted(id, bool) shape", () => {
    const trust = makeNode({
      trust: "verified",
      functionName: "setAddressTrusted",
      summary: null,
      params: [
        { name: "account", type: "address", value: "0xabc" },
        { name: "trusted", type: "bool", value: true },
      ],
    });
    expect(leadParts(trust).text).toBe("Trust address");
    const untrust = makeNode({
      trust: "verified",
      functionName: "setAddressTrusted",
      params: [
        { name: "account", type: "address", value: "0xabc" },
        { name: "trusted", type: "bool", value: false },
      ],
    });
    expect(leadParts(untrust).text).toBe("Untrust address");
  });

  it("does NOT apply the heuristic when there is more than one bool (ambiguous flag)", () => {
    // Two bools: which is the trust flag? Fall back to the plain function name
    // rather than risk inverting Trust/Untrust off the wrong positional bool.
    const node = makeNode({
      trust: "verified",
      functionName: "setNodeTrusted",
      params: [
        { name: "id", type: "uint256", value: 1n },
        { name: "active", type: "bool", value: true },
        { name: "trusted", type: "bool", value: false },
      ],
    });
    expect(leadParts(node).text).toBe("Set node trusted");
  });
});

describe("leadParts caveat on non-verified fallback leads", () => {
  it("prefixes 'Unverified:' on a bare function-name lead when trust is not verified", () => {
    const node = makeNode({ trust: "bytecode", functionName: "doSomething" });
    expect(leadParts(node).text).toBe("Unverified: Do something");
  });

  it("prefixes 'Unverified:' on a setXTrusted lead when trust is not verified", () => {
    const node = makeNode({
      trust: "bytecode",
      functionName: "setAddressTrusted",
      params: [
        { name: "account", type: "address", value: "0xabc" },
        { name: "trusted", type: "bool", value: true },
      ],
    });
    expect(leadParts(node).text).toBe("Unverified: Trust address");
  });

  it("does NOT prefix when trust is verified", () => {
    const node = makeNode({ trust: "verified", functionName: "doSomething" });
    expect(leadParts(node).text).toBe("Do something");
  });

  it("does not double-prefix a summary (already caveated by displaySummary)", () => {
    const node = makeNode({ trust: "bytecode", summary: "Transfer 5 TKO" });
    expect(leadParts(node).text).toBe("Unverified: Transfer 5 TKO");
  });
});
