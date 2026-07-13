import { describe, expect, test } from "vitest";
import { ProposalStatus } from "@aragon/ods";
import { getPhaseTag } from "../plugins/optimistic-proposals/utils/proposal-phase-tag";

const base = {
  isEmergency: false,
  isL2GracePeriod: false,
  isTimelockPeriod: false,
  governanceSettingsLoaded: true,
};

describe("getPhaseTag — standard proposal lifecycle", () => {
  test("an open veto window reads as Voting", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACTIVE })).toEqual({ label: "Voting", variant: "info" });
  });

  test("the L2 veto aggregation window is named", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACCEPTED, isL2GracePeriod: true })).toEqual({
      label: "Awaiting L2 vetoes",
      variant: "warning",
    });
  });

  test("the timelock window is named", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACCEPTED, isTimelockPeriod: true })).toEqual({
      label: "In timelock",
      variant: "warning",
    });
  });

  test("past the timelock, with settings known, the proposal is executable", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACCEPTED })).toEqual({
      label: "Executable",
      variant: "success",
    });
  });
});

describe("getPhaseTag — never claims executability it cannot know", () => {
  // Regression: while useGovernanceSettings is in flight, timelockPeriod and
  // l2AggregationGracePeriod are undefined -> coerced to 0 -> both window booleans
  // collapse to false. That must NOT be read as "past the timelock".
  test("an ACCEPTED proposal is not called Executable while governance settings are unresolved", () => {
    const tag = getPhaseTag({ ...base, status: ProposalStatus.ACCEPTED, governanceSettingsLoaded: false });
    expect(tag.label).not.toBe("Executable");
    expect(tag).toEqual({ label: "Accepted", variant: "success" });
  });

  test("a known timelock still wins over unresolved settings", () => {
    expect(
      getPhaseTag({
        ...base,
        status: ProposalStatus.ACCEPTED,
        isTimelockPeriod: true,
        governanceSettingsLoaded: false,
      }).label
    ).toBe("In timelock");
  });
});

describe("getPhaseTag — terminal and degenerate states", () => {
  test("a vetoed proposal keeps the on-chain governance term", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.VETOED })).toEqual({ label: "Vetoed", variant: "critical" });
  });

  test("an executed proposal reads as Executed", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.EXECUTED })).toEqual({
      label: "Executed",
      variant: "success",
    });
  });

  test("an undefined status degrades to a neutral Pending pill", () => {
    expect(getPhaseTag({ ...base, status: undefined })).toEqual({ label: "Pending", variant: "neutral" });
  });

  test("terminal states win even when settings are unresolved", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.EXECUTED, governanceSettingsLoaded: false }).label).toBe(
      "Executed"
    );
    expect(getPhaseTag({ ...base, status: ProposalStatus.VETOED, governanceSettingsLoaded: false }).label).toBe(
      "Vetoed"
    );
  });
});

describe("getPhaseTag — emergency (zero-length veto window) proposals", () => {
  test("an active emergency proposal has no veto/timelock phases", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACTIVE, isEmergency: true })).toEqual({
      label: "Active",
      variant: "info",
    });
  });

  test("an emergency proposal is never labelled Executable", () => {
    expect(getPhaseTag({ ...base, status: ProposalStatus.ACCEPTED, isEmergency: true }).label).not.toBe("Executable");
  });
});
