import { describe, expect, test } from "vitest";
import { getAddress } from "viem";
import getSecurityCouncilMemberData from "@/utils/getSecurityCouncilMemberData";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";

const L2BEAT_SAFE = getAddress("0xf1cF63589A1e012F9124182c9eAa36B5333e5f06");
const TAIKO_LABS = getAddress("0xb47fE76aC588101BFBdA9E68F66433bA51E8029a");
const untilBlock = (
  SecurityCouncilProfiles.find((entry) => entry.address.toLowerCase() === L2BEAT_SAFE.toLowerCase()) as {
    priorNames: { untilBlock: number }[];
  }
).priorNames[0].untilBlock;

describe("getSecurityCouncilMemberData", () => {
  test("pins the 9→5 roster execute block as the L2BEAT cutoff", () => {
    expect(untilBlock).toBe(25997731);
  });
  test("Members tab and current roster use Sebastian Kugler", () => {
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE).name).toBe("Sebastian Kugler");
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, null).name).toBe("Sebastian Kugler");
  });

  test("proposals created before the restructure label that wallet as L2BEAT", () => {
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, untilBlock - 1).name).toBe("L2BEAT");
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, BigInt(untilBlock - 1)).name).toBe("L2BEAT");
  });

  test("proposals created at or after the restructure label that wallet as Sebastian Kugler", () => {
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, untilBlock).name).toBe("Sebastian Kugler");
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, untilBlock + 1).name).toBe("Sebastian Kugler");
  });

  test("other members keep a single name across the cutoff", () => {
    expect(getSecurityCouncilMemberData(TAIKO_LABS).name).toBe("Taiko Labs");
    expect(getSecurityCouncilMemberData(TAIKO_LABS, untilBlock - 1).name).toBe("Taiko Labs");
  });

  test("unknown addresses and invalid blocks do not invent a name", () => {
    expect(getSecurityCouncilMemberData(getAddress("0x000000000000000000000000000000000000dEaD")).name).toBe("");
    expect(getSecurityCouncilMemberData(L2BEAT_SAFE, Number.NaN).name).toBe("Sebastian Kugler");
  });
});
