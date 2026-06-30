import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { decodeActionTupleArray, decodeActionTuples, MAX_ACTION_ELEMENTS } from "../unwrappers/actionArray";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const UPGRADE = ("0x3659cfe6" + "00".repeat(32)) as Hex;

function encodeActions(items: Array<[Hex, bigint, Hex]>) {
  return encodeAbiParameters(parseAbiParameters("(address,uint256,bytes)[]"), [items]);
}

describe("decodeActionTupleArray", () => {
  it("decodes a valid action array into RawCalls (no chainId)", () => {
    const blob = encodeActions([[A, 0n, UPGRADE], [B, 5n, "0x"]]);
    const calls = decodeActionTupleArray(blob);
    expect(calls).toHaveLength(2);
    expect(calls![0]).toEqual({ to: A, value: 0n, data: UPGRADE });
    expect(calls![1].to).toBe(B);
    expect(calls![1].value).toBe(5n);
    expect("chainId" in calls![0]).toBe(false);
  });

  it("returns null for an empty array", () => {
    expect(decodeActionTupleArray(encodeActions([]))).toBeNull();
  });

  it("returns null for 0x / too-short / malformed blobs", () => {
    expect(decodeActionTupleArray("0x")).toBeNull();
    expect(decodeActionTupleArray("0x1234")).toBeNull();
    expect(decodeActionTupleArray(("0x" + "ab".repeat(80)) as Hex)).toBeNull();
  });
});

describe("decodeActionTuples (breadth cap)", () => {
  it("returns truncated=false and all calls for a within-cap array", () => {
    const blob = encodeActions([[A, 0n, UPGRADE], [B, 5n, "0x"]]);
    const result = decodeActionTuples(blob);
    expect(result?.truncated).toBe(false);
    expect(result?.calls).toHaveLength(2);
  });

  it("caps at MAX_ACTION_ELEMENTS and flags truncated when the source is longer", () => {
    const items = Array.from({ length: MAX_ACTION_ELEMENTS + 5 }, () => [A, 0n, "0x"] as [Hex, bigint, Hex]);
    const result = decodeActionTuples(encodeActions(items));
    expect(result?.truncated).toBe(true);
    expect(result?.calls).toHaveLength(MAX_ACTION_ELEMENTS);
  });

  it("does not flag truncated at exactly the cap", () => {
    const items = Array.from({ length: MAX_ACTION_ELEMENTS }, () => [A, 0n, "0x"] as [Hex, bigint, Hex]);
    const result = decodeActionTuples(encodeActions(items));
    expect(result?.truncated).toBe(false);
    expect(result?.calls).toHaveLength(MAX_ACTION_ELEMENTS);
  });
});
