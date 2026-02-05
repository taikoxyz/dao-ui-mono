import { describe, expect, test } from "bun:test";
import { getDescendingIndices } from "../utils/pagination";

describe("getDescendingIndices", () => {
  test("returns empty array for non-positive inputs", () => {
    expect(getDescendingIndices(0, 5)).toStrictEqual([]);
    expect(getDescendingIndices(5, 0)).toStrictEqual([]);
    expect(getDescendingIndices(-1, 3)).toStrictEqual([]);
  });

  test("returns descending indices for total larger than count", () => {
    expect(getDescendingIndices(10, 3)).toStrictEqual([9, 8, 7]);
  });

  test("clamps count to total", () => {
    expect(getDescendingIndices(3, 10)).toStrictEqual([2, 1, 0]);
  });
});
