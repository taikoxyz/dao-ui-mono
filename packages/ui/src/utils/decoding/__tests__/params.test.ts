import { describe, it, expect } from "vitest";
import type { AbiParameter } from "viem";
import { buildParams } from "../params";

describe("buildParams", () => {
  it("maps flat params to name/type/value", () => {
    const inputs: AbiParameter[] = [{ name: "newOwner", type: "address" }];
    const out = buildParams(inputs, ["0xabc"]);
    expect(out).toEqual([{ name: "newOwner", type: "address", value: "0xabc", internalType: undefined }]);
  });

  it("captures internalType when present", () => {
    const inputs: AbiParameter[] = [{ name: "x", type: "address", internalType: "contract IFoo" }];
    expect(buildParams(inputs, ["0x1"])[0].internalType).toBe("contract IFoo");
  });

  it("recurses a tuple into named, typed components (value as object)", () => {
    const inputs: AbiParameter[] = [{
      name: "message", type: "tuple", internalType: "struct IBridge.Message",
      components: [{ name: "destChainId", type: "uint64" }, { name: "to", type: "address" }],
    }];
    const out = buildParams(inputs, [{ destChainId: 167000n, to: "0xfa06" }]);
    expect(out[0].type).toBe("tuple");
    expect(out[0].internalType).toBe("struct IBridge.Message");
    expect(out[0].components).toEqual([
      { name: "destChainId", type: "uint64", value: 167000n, internalType: undefined },
      { name: "to", type: "address", value: "0xfa06", internalType: undefined },
    ]);
  });

  it("recurses a tuple when the value is an array (unnamed)", () => {
    const inputs: AbiParameter[] = [{
      name: "m", type: "tuple",
      components: [{ name: "a", type: "uint64" }, { name: "b", type: "address" }],
    }];
    const out = buildParams(inputs, [[5n, "0xbb"]]);
    expect(out[0].components?.map((c) => c.value)).toEqual([5n, "0xbb"]);
  });

  it("does not recurse non-tuple types (arrays stay flat)", () => {
    const inputs: AbiParameter[] = [{ name: "ids", type: "uint256[]" }];
    const out = buildParams(inputs, [[1n, 2n]]);
    expect(out[0].components).toBeUndefined();
    expect(out[0].value).toEqual([1n, 2n]);
  });
});
