import { describe, expect, test } from "vitest";
import { getAddress } from "viem";
import {
  compareSecurityCouncilAddresses,
  getSecurityCouncilProfile,
  securityCouncilProfileMatchesQuery,
} from "@/utils/getSecurityCouncilMemberData";

const TAIKO_LABS = getAddress("0xb47fE76aC588101BFBdA9E68F66433bA51E8029a");
const SEBASTIAN_KUGLER = getAddress("0xf1cF63589A1e012F9124182c9eAa36B5333e5f06");
const GATTACA = getAddress("0x6268d189E011Aa53A2f09A1FE159445BeB3d878E");
const DANIEL_WANG = getAddress("0xF74F2bBaEd41e3e4AbAcbA24563a5Ce5aB071C8A");
const GUSTAVO_GONZALEZ = getAddress("0xe63E61BbB3aa1b82d44471AbcAb490102C17c986");
const UNKNOWN = getAddress("0x000000000000000000000000000000000000dEaD");

describe("getSecurityCouncilProfile", () => {
  test("resolves a directory entry case-insensitively", () => {
    const profile = getSecurityCouncilProfile("0xb47fe76ac588101bfbda9e68f66433ba51e8029a");
    expect(profile.name).toBe("Taiko Labs");
    expect(profile.hasDirectoryEntry).toBe(true);
    expect(profile.order).toBe(1);
  });

  test("resolves the inherited L2BEAT Safe to Sebastian Kugler", () => {
    const profile = getSecurityCouncilProfile(SEBASTIAN_KUGLER);
    expect(profile.name).toBe("Sebastian Kugler");
    expect(profile.hasDirectoryEntry).toBe(true);
    expect(profile.order).toBe(3);
    expect(securityCouncilProfileMatchesQuery(SEBASTIAN_KUGLER, "kugler")).toBe(true);
  });

  test("resolves incoming Proposal0020 seats before they appear on SignerList", () => {
    expect(getSecurityCouncilProfile(DANIEL_WANG).name).toBe("Daniel Wang");
    expect(getSecurityCouncilProfile(DANIEL_WANG).order).toBe(2);
    expect(getSecurityCouncilProfile(GUSTAVO_GONZALEZ).name).toBe("Gustavo Gonzalez");
    expect(getSecurityCouncilProfile(GUSTAVO_GONZALEZ).order).toBe(5);
  });

  test("keeps historical names for members who may leave the on-chain list", () => {
    expect(getSecurityCouncilProfile(GATTACA).name).toBe("Gattaca");
  });

  test("falls back to a truncated address for signers not yet in the JSON overlay", () => {
    const profile = getSecurityCouncilProfile(UNKNOWN);
    expect(profile.hasDirectoryEntry).toBe(false);
    expect(profile.name).toBe("0x0000...dEaD");
    expect(profile.order).toBe(Number.POSITIVE_INFINITY);
  });

  test("matches unknown signers by truncated address", () => {
    expect(securityCouncilProfileMatchesQuery(UNKNOWN, "dead")).toBe(true);
  });
});

describe("compareSecurityCouncilAddresses", () => {
  test("sorts by directory order, then unknown signers last by address", () => {
    const sorted = [UNKNOWN, GATTACA, DANIEL_WANG, TAIKO_LABS].sort(compareSecurityCouncilAddresses);
    expect(sorted).toEqual([TAIKO_LABS, DANIEL_WANG, GATTACA, UNKNOWN]);
  });
});

describe("securityCouncilProfileMatchesQuery", () => {
  test("matches name, description, or address", () => {
    expect(securityCouncilProfileMatchesQuery(TAIKO_LABS, "taiko")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(TAIKO_LABS, "b47fe76")).toBe(true);
    expect(securityCouncilProfileMatchesQuery(TAIKO_LABS, "nethermind")).toBe(false);
    expect(securityCouncilProfileMatchesQuery(UNKNOWN, undefined)).toBe(true);
  });
});
