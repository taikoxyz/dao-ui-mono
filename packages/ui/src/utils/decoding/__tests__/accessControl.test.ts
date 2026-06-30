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
    chainId: 1, trust: "verified", isProxy: false, implementation: null, summary: null, children: [], ...p,
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

  const ROLE_HASH = "0x1234567890abcdef000000000000000000000000000000000000000000abcdef";
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const GRANTEE = "0x000000000000000000000000000000000000cAfE";

  function grant(role: string, account: string) {
    return node({
      selector: "0x2f2ff15d", functionName: "grantRole", signature: "grantRole(bytes32,address)",
      params: [{ name: "role", type: "bytes32", value: role }, { name: "account", type: "address", value: account }],
    });
  }
  function revoke(role: string, account: string) {
    return node({
      selector: "0xd547741f", functionName: "revokeRole", signature: "revokeRole(bytes32,address)",
      params: [{ name: "role", type: "bytes32", value: role }, { name: "account", type: "address", value: account }],
    });
  }

  it("surfaces the role hash and grantee for grantRole", async () => {
    const n = grant(ROLE_HASH, GRANTEE);
    expect(accessControl.match(n)).toBe(true);
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toBe("Grants role 0x1234…cdef to 0x0000…cAfE");
  });

  it("surfaces the role hash and grantee for revokeRole", async () => {
    const { summary } = await accessControl.apply(revoke(ROLE_HASH, GRANTEE), ctx);
    expect(summary).toBe("Revokes role 0x1234…cdef from 0x0000…cAfE");
  });

  it("labels DEFAULT_ADMIN_ROLE (the zero hash) so an admin escalation is legible", async () => {
    const { summary } = await accessControl.apply(grant(DEFAULT_ADMIN_ROLE, GRANTEE), ctx);
    expect(summary).toBe("Grants role DEFAULT_ADMIN_ROLE to 0x0000…cAfE");
  });

  it("labels DEFAULT_ADMIN_ROLE on revoke too", async () => {
    const { summary } = await accessControl.apply(revoke(DEFAULT_ADMIN_ROLE, GRANTEE), ctx);
    expect(summary).toBe("Revokes role DEFAULT_ADMIN_ROLE from 0x0000…cAfE");
  });

  it("labels a keccak256-derived known role (MINTER_ROLE)", async () => {
    // keccak256("MINTER_ROLE")
    const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    const { summary } = await accessControl.apply(grant(MINTER_ROLE, GRANTEE), ctx);
    expect(summary).toBe("Grants role MINTER_ROLE to 0x0000…cAfE");
  });

  it("falls back to the old shape when role/account params are missing", async () => {
    const n = node({ selector: "0x2f2ff15d", functionName: "grantRole", signature: "grantRole(bytes32,address)", params: [] });
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toBe("Grants a role on 0x6f21…ef1f");
  });

  it("does NOT match a selector collision with a different signature", () => {
    expect(accessControl.match(node({ signature: "transferOwnershipNow(address)" }))).toBe(false);
    expect(accessControl.match(node({ signature: null }))).toBe(false);
  });
});
