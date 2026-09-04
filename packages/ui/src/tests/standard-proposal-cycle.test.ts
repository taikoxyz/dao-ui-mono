import {
  formatVetoDurationLabel,
  getStandardProposalCycleDays,
  secondsToWholeDays,
} from "@/plugins/optimistic-proposals/utils/standard-proposal-cycle";
import { expect, test, describe } from "vitest";

describe("standard proposal cycle helpers", () => {
  test("secondsToWholeDays ignores zero and undefined", () => {
    expect(secondsToWholeDays(undefined)).toBeUndefined();
    expect(secondsToWholeDays(0)).toBeUndefined();
    expect(secondsToWholeDays(864000)).toBe(10);
    expect(secondsToWholeDays(604800n)).toBe(7);
  });

  test("getStandardProposalCycleDays falls back when minDuration is 0", () => {
    expect(
      getStandardProposalCycleDays({
        minDuration: 0,
        timelockPeriod: 604800,
      })
    ).toEqual({
      vetoDays: 10,
      timelockDays: 7,
      totalCycleDays: 17,
    });
  });

  test("getStandardProposalCycleDays uses positive on-chain minDuration", () => {
    expect(
      getStandardProposalCycleDays({
        minDuration: 1814400,
        timelockPeriod: 604800,
      })
    ).toEqual({
      vetoDays: 21,
      timelockDays: 7,
      totalCycleDays: 28,
    });
  });

  test("formatVetoDurationLabel prefers proposal timestamps", () => {
    const start = 1_700_000_000_000;
    const end21 = start + 21 * 86_400 * 1000;
    const end10 = start + 10 * 86_400 * 1000;
    expect(formatVetoDurationLabel(start, end21, 10)).toBe("21 days");
    expect(formatVetoDurationLabel(start, end10, 10)).toBe("10 days");
    expect(formatVetoDurationLabel(undefined, undefined, 10)).toBe("10 days");
  });
});
