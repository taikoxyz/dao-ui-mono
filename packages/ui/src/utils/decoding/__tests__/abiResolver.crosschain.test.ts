import { describe, it, expect, vi, beforeEach } from "vitest";

const getContract = vi.fn();
vi.mock("@shazow/whatsabi", () => ({
  whatsabi: { loaders: { EtherscanABILoader: vi.fn().mockImplementation(() => ({ getContract })) } },
}));

import { loadVerifiedAbiFrom, isVerifiedAbiChainSupported } from "../abiResolver";

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

  it("returns a verified resolution with name when Etherscan reports ok", async () => {
    getContract.mockResolvedValue({ ok: true, name: "SignalService", abi: [{ type: "function", name: "x", inputs: [], outputs: [], stateMutability: "view" }] });
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("verified");
    expect(res.name).toBe("SignalService");
    expect(res.abi.length).toBe(1);
  });

  it("returns an unknown resolution (no guess) when Etherscan is not ok", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.name).toBeUndefined();
  });

  it("never throws; an Etherscan error degrades to unknown", async () => {
    getContract.mockRejectedValue(new Error("rate limited"));
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.abi).toEqual([]);
  });
});
