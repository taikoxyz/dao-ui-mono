import { describe, it, expect, vi, beforeEach } from "vitest";

const getContract = vi.fn();
vi.mock("@shazow/whatsabi", () => ({
  whatsabi: { loaders: { EtherscanABILoader: vi.fn().mockImplementation(() => ({ getContract })) } },
}));

import { loadVerifiedAbiFrom, isVerifiedAbiChainSupported, loadVerifiedViaRpc, chainClient } from "../abiResolver";

const ADDR = "0x000000000000000000000000000000000000dEaD" as const;

describe("cross-chain verified resolver", () => {
  // Block body (not `() => getContract.mockReset()`): mockReset returns the stub, and a
  // function returned from beforeEach is treated by vitest as a teardown callback — it would
  // re-invoke the still-rejecting mock after the test and surface a spurious unhandled rejection.
  beforeEach(() => {
    getContract.mockReset();
  });

  it("treats Taiko mainnet (167000) as supported and Ethereum (1) as in-range", () => {
    expect(isVerifiedAbiChainSupported(167000)).toBe(true);
    expect(isVerifiedAbiChainSupported(1)).toBe(true);
    expect(isVerifiedAbiChainSupported(999999)).toBe(false);
  });

  // These exercise the HTTP-only branch of loadVerifiedAbiFrom. Chain 1 is a supported
  // verified chain but is NOT in the proxy-aware CHAIN_RESOLVERS registry, so it routes
  // through the HTTP-only Etherscan path (no RPC client) — keeping the tests offline.
  // (Previously these used 167000, which now routes through loadVerifiedViaRpc + a real
  // client; the proxy-aware path itself is covered by the loadVerifiedViaRpc suite below.)
  it("returns a verified resolution with name when Etherscan reports ok", async () => {
    getContract.mockResolvedValue({ ok: true, name: "SignalService", abi: [{ type: "function", name: "x", inputs: [], outputs: [], stateMutability: "view" }] });
    const res = await loadVerifiedAbiFrom(1, ADDR);
    expect(res.trust).toBe("verified");
    expect(res.name).toBe("SignalService");
    expect(res.abi.length).toBe(1);
  });

  it("returns an unknown resolution (no guess) when Etherscan is not ok", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedAbiFrom(1, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.name).toBeUndefined();
    // A clean "not verified" answer is NOT a transient failure — don't flag refetch.
    expect(res.retryable).toBeFalsy();
  });

  it("never throws; an Etherscan error degrades to unknown and flags retryable", async () => {
    getContract.mockRejectedValue(new Error("rate limited"));
    const res = await loadVerifiedAbiFrom(1, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.abi).toEqual([]);
    // The fetch threw (outage) — transient, so the caller can refetch.
    expect(res.retryable).toBe(true);
  });
});

const PROXY = "0x00000000000000000000000000000000000000Aa" as const;
const IMPL = "0x00000000000000000000000000000000000000Bb" as const;
const padded = (a: string) => ("0x" + "0".repeat(24) + a.slice(2)) as `0x${string}`;

function fakeClient(slotValue: string | null | (() => never)) {
  return {
    getStorageAt: vi.fn(async () => {
      if (typeof slotValue === "function") slotValue();
      return slotValue as any;
    }),
  } as any;
}

describe("loadVerifiedViaRpc (proxy-aware cross-chain)", () => {
  beforeEach(() => { getContract.mockReset(); });

  it("resolves a proxy: impl ABI/name + proxy name, trust verified", async () => {
    getContract.mockImplementation(async (addr: string) => {
      if (addr.toLowerCase() === IMPL.toLowerCase())
        return { ok: true, name: "OnMessageInvoker", abi: [{ type: "function", name: "f", inputs: [], outputs: [], stateMutability: "view" }] };
      return { ok: true, name: "ERC1967Proxy", abi: [] };
    });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded(IMPL)));
    expect(res.trust).toBe("verified");
    expect(res.isProxy).toBe(true);
    expect(res.implementation?.toLowerCase()).toBe(IMPL.toLowerCase());
    expect(res.name).toBe("OnMessageInvoker");
    expect(res.proxyName).toBe("ERC1967Proxy");
    expect(res.abi.length).toBe(1);
  });

  it("resolves a non-proxy verified contract by its own address", async () => {
    getContract.mockResolvedValue({ ok: true, name: "Direct", abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded("0x0000000000000000000000000000000000000000")));
    expect(res.isProxy).toBe(false);
    expect(res.name).toBe("Direct");
    expect(res.trust).toBe("verified");
  });

  it("returns unknown (no name) when the implementation is unverified, preserving isProxy", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded(IMPL)));
    expect(res.trust).toBe("unknown");
    expect(res.name).toBeUndefined();
    expect(res.isProxy).toBe(true);
    expect(res.implementation?.toLowerCase()).toBe(IMPL.toLowerCase());
  });

  it("never throws on RPC failure", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(() => { throw new Error("rpc down"); }));
    expect(res.trust).toBe("unknown");
    expect(res.abi).toEqual([]);
  });

  it("flags retryable when the Etherscan fetch itself throws (outage)", async () => {
    getContract.mockRejectedValue(new Error("rate limited"));
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded(IMPL)));
    expect(res.trust).toBe("unknown");
    expect(res.retryable).toBe(true);
  });

  it("chainClient memoizes one client per supported chain and returns null for unsupported", () => {
    expect(chainClient(999999)).toBeNull();
    const a = chainClient(167000);
    const b = chainClient(167000);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});
