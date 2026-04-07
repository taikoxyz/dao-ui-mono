import { describe, expect, test } from "bun:test";
import { shouldForcePrimaryChainSwitch } from "../utils/wallet-chain-policy";

describe("shouldForcePrimaryChainSwitch", () => {
  test("force-switches when connected to Taiko but the current flow has not allowed it", () => {
    expect(shouldForcePrimaryChainSwitch(167000, 1, [])).toBe(true);
  });

  test("does not force-switch when the current flow explicitly allows Taiko", () => {
    expect(shouldForcePrimaryChainSwitch(167000, 1, [167000])).toBe(false);
  });

  test("does not force-switch when already on the primary chain", () => {
    expect(shouldForcePrimaryChainSwitch(1, 1, [])).toBe(false);
  });
});
