import {
  formatTimelockClause,
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

  test("getStandardProposalCycleDays preserves a configured zero timelock", () => {
    // A zero timelock is a real setting, not a missing read: useProposalVariantStatus
    // treats it as no delay, so the copy must not advertise the 7-day fallback.
    expect(getStandardProposalCycleDays({ minDuration: 0, timelockPeriod: 0 })).toEqual({
      vetoDays: 10,
      timelockDays: 0,
      totalCycleDays: 10,
    });
  });

  test("getStandardProposalCycleDays only falls back for an unresolved timelock", () => {
    expect(getStandardProposalCycleDays({ minDuration: 0, timelockPeriod: undefined }).timelockDays).toBe(7);
    expect(getStandardProposalCycleDays({ minDuration: 0, timelockPeriod: 0n }).timelockDays).toBe(0);
  });

  test("formatTimelockClause collapses when there is no timelock", () => {
    expect(formatTimelockClause({ vetoDays: 10, timelockDays: 0, totalCycleDays: 10 })).toBe(
      "If not vetoed, it can be executed as soon as the veto period ends."
    );
  });

  test("formatTimelockClause describes the wait when there is one", () => {
    expect(formatTimelockClause({ vetoDays: 10, timelockDays: 7, totalCycleDays: 17 })).toBe(
      "If not vetoed, a 7-day timelock follows (17 days total) before it can be executed."
    );
    expect(formatTimelockClause({ vetoDays: 10, timelockDays: 1, totalCycleDays: 11 })).toBe(
      "If not vetoed, a 1-day timelock follows (11 days total) before it can be executed."
    );
  });
});
