import { describe, it, expect } from "vitest";
import { findEmbeddedCandidates } from "../embeddedCalls";
import type { DecodedParam } from "../types";

const CALLDATA = "0x7f07c947" + "00".repeat(32); // selector + 32 bytes

describe("findEmbeddedCandidates", () => {
  it("finds a top-level bytes param whose head is a 4-byte selector", () => {
    const params: DecodedParam[] = [{ name: "data", type: "bytes", value: CALLDATA }];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "data", selector: "0x7f07c947" }]);
  });

  it("finds a bytes field nested inside a tuple", () => {
    const params: DecodedParam[] = [
      { name: "message", type: "tuple", value: { to: "0x00", data: CALLDATA } },
    ];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "message.data", selector: "0x7f07c947" }]);
  });

  it("finds bytes inside an array", () => {
    const params: DecodedParam[] = [{ name: "calls", type: "bytes[]", value: [CALLDATA] }];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "calls[0]", selector: "0x7f07c947" }]);
  });

  it("ignores non-bytes and too-short bytes", () => {
    const params: DecodedParam[] = [
      { name: "amount", type: "uint256", value: 5n },
      { name: "short", type: "bytes", value: "0x1234" },
    ];
    expect(findEmbeddedCandidates(params)).toEqual([]);
  });

  it("ignores an address-shaped hex param whose head collides with a selector", () => {
    // 20-byte value: (20 - 4) % 32 === 16 → not calldata-shaped.
    const params: DecodedParam[] = [{ name: "target", type: "address", value: "0x7f07c947" + "11".repeat(16) }];
    expect(findEmbeddedCandidates(params)).toEqual([]);
  });

  it("ignores a bytes32-shaped hex param whose head collides with a selector", () => {
    // 32-byte value: (32 - 4) % 32 === 28 → not calldata-shaped.
    const params: DecodedParam[] = [{ name: "salt", type: "bytes32", value: "0x7f07c947" + "22".repeat(28) }];
    expect(findEmbeddedCandidates(params)).toEqual([]);
  });

  it("caps the number of candidates at 8", () => {
    const params: DecodedParam[] = Array.from({ length: 20 }, (_, i) => ({ name: `b${i}`, type: "bytes", value: CALLDATA }));
    expect(findEmbeddedCandidates(params).length).toBe(8);
  });
});
