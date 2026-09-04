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

  test("secondsToWholeDays rejects durations shorter than a day", () => {
    expect(secondsToWholeDays(3600)).toBeUndefined();
    expect(secondsToWholeDays(43199)).toBeUndefined();
    expect(secondsToWholeDays(43200)).toBe(1);
  });

  test("secondsToWholeDays rejects negative and non-finite input", () => {
    expect(secondsToWholeDays(-604800)).toBeUndefined();
    expect(secondsToWholeDays(NaN)).toBeUndefined();
    expect(secondsToWholeDays(Infinity)).toBeUndefined();
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

  test("getStandardProposalCycleDays falls back while settings are loading", () => {
    expect(getStandardProposalCycleDays({})).toEqual({
      vetoDays: 10,
      timelockDays: 7,
      totalCycleDays: 17,
    });
  });

  test("getStandardProposalCycleDays never renders a zero-day veto period", () => {
    expect(getStandardProposalCycleDays({ minDuration: 3600, timelockPeriod: 604800 })).toEqual({
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
    expect(formatVetoDurationLabel(start, start + 21 * 86_400 * 1000)).toBe("21 days");
    expect(formatVetoDurationLabel(start, start + 10 * 86_400 * 1000)).toBe("10 days");
    expect(formatVetoDurationLabel(start, start + 86_400 * 1000)).toBe("1 day");
  });

  test("formatVetoDurationLabel omits the label when there is no veto window", () => {
    const start = 1_700_000_000_000;
    // Emergency proposals share the optimistic plugin with vetoStartDate === vetoEndDate.
    expect(formatVetoDurationLabel(start, start)).toBeUndefined();
    expect(formatVetoDurationLabel(start, start - 86_400 * 1000)).toBeUndefined();
    expect(formatVetoDurationLabel(start, start + 3600 * 1000)).toBeUndefined();
    expect(formatVetoDurationLabel(undefined, undefined)).toBeUndefined();
    expect(formatVetoDurationLabel(0, 0)).toBeUndefined();
  });
});
