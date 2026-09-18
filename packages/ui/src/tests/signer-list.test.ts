import { describe, expect, test } from "vitest";
import { getAddress } from "viem";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";

describe("Security Council directory invariants", () => {
  test("stores checksummed addresses in the raw directory", () => {
    for (const { address } of SecurityCouncilProfiles) expect(address).toBe(getAddress(address));
  });
  test("has unique addresses and explicit sort orders", () => {
    const addresses = SecurityCouncilProfiles.map(({ address }) => address.toLowerCase());
    const orders = SecurityCouncilProfiles.map(({ order }) => order).filter((order) => order !== undefined);
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
