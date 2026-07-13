import { describe, it, expect } from "vitest";
import { shortHex, displaySummary } from "../format";

describe("shortHex", () => {
  it("truncates a long 0x value to head…tail", () => {
    expect(shortHex("0x000000000000000000000000000000000000bEEF")).toBe("0x0000…bEEF");
  });

  it("returns short or non-hex values unchanged", () => {
    expect(shortHex("0x1234")).toBe("0x1234"); // ≤ 14 chars
    expect(shortHex("0x00000000000a")).toBe("0x00000000000a"); // exactly 14 chars, boundary
    expect(shortHex("not-a-hex-string")).toBe("not-a-hex-string");
  });
});

describe("displaySummary", () => {
  it("leaves verified summaries untouched (a verified ABI source is trustworthy)", () => {
    expect(displaySummary({ summary: "Upgrades proxy", trust: "verified" })).toBe("Upgrades proxy");
  });

  it("prefixes 'Unverified:' for ANY non-verified trust so the caveat travels with the claim", () => {
    expect(displaySummary({ summary: "Transfer 1.5 USDC → 0x0000…dEaD", trust: "bytecode" })).toBe(
      "Unverified: Transfer 1.5 USDC → 0x0000…dEaD",
    );
    expect(displaySummary({ summary: "Upgrades proxy", trust: "bytecode" })).toBe("Unverified: Upgrades proxy");
    expect(displaySummary({ summary: "Executes 2 sub-action(s)", trust: "unknown" })).toBe(
      "Unverified: Executes 2 sub-action(s)",
    );
  });

  it("returns null when there is no summary", () => {
    expect(displaySummary({ summary: null, trust: "bytecode" })).toBeNull();
  });
});
