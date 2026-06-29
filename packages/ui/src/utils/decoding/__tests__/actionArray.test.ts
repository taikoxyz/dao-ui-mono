import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { decodeActionTupleArray } from "../unwrappers/actionArray";

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
