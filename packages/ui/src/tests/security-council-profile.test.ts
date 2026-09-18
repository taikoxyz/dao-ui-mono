import { describe, expect, test, vi } from "vitest";
import { getAddress } from "viem";
import {
  compareSecurityCouncilAddresses,
  getSecurityCouncilDirectoryAddresses,
  getSecurityCouncilProfile,
  securityCouncilProfileMatchesQuery,
} from "@/utils/getSecurityCouncilMemberData";

// Lookup semantics should not depend on which people hold council seats today.
vi.mock("@/data/security-council-profiles.json", () => ({
  default: [
    {
      address: "0x00000000000000000000000000000000000000aa",
      name: " First member ",
      description: "Research group",
      order: 2,
    },
    { address: "0x00000000000000000000000000000000000000bb", name: "Former member", order: 1 },
  ],
}));
const FIRST = getAddress("0x00000000000000000000000000000000000000aa");
const FORMER = getAddress("0x00000000000000000000000000000000000000bb");
const UNKNOWN = getAddress("0x000000000000000000000000000000000000dEaD");
const OTHER_UNKNOWN = getAddress("0x000000000000000000000000000000000000beef");

describe("Security Council profiles", () => {
  test("resolves a directory entry case-insensitively and trims its name", () => {
    expect(getSecurityCouncilProfile(FIRST.toLowerCase() as typeof FIRST)).toMatchObject({
      name: "First member",
      hasDirectoryEntry: true,
      order: 2,
      description: "Research group",
    });
  });
  test("keeps historical profiles independently of active membership", () => {
    expect(getSecurityCouncilProfile(FORMER).name).toBe("Former member");
  });
  test("checksums candidate addresses even when fixture entries are lowercase", () => {
    expect(getSecurityCouncilDirectoryAddresses()).toEqual([FIRST, FORMER]);
  });
  test("falls back to a truncated address for unknown signers", () => {
    expect(getSecurityCouncilProfile(UNKNOWN)).toMatchObject({
      name: "0x0000...dEaD",
      hasDirectoryEntry: false,
      order: Number.POSITIVE_INFINITY,
    });
  });
  test("sorts directory entries by order and unknown signers by address", () => {
    expect([UNKNOWN, FIRST, OTHER_UNKNOWN, FORMER].sort(compareSecurityCouncilAddresses)).toEqual([
      FORMER,
      FIRST,
      OTHER_UNKNOWN,
      UNKNOWN,
    ]);
  });
  test("matches names, descriptions and addresses case-insensitively", () => {
    expect(securityCouncilProfileMatchesQuery(FIRST, "FIRST")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(FIRST, "research")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(FIRST, "00aa")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(UNKNOWN, "dead")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(FIRST, "unrelated")).toBe(false);
    expect(securityCouncilProfileMatchesQuery(UNKNOWN, undefined)).toBe(true);
  });
});
