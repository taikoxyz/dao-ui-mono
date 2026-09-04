import { SECONDS_PER_DAY, STANDARD_PROPOSAL_TIMELOCK_DAYS, STANDARD_PROPOSAL_VETO_PERIOD_DAYS } from "@/constants";

export type StandardProposalCycleDays = {
  vetoDays: number;
  timelockDays: number;
  totalCycleDays: number;
};

/** Convert a duration in seconds to whole days, or undefined if it isn't at least a day. */
export function secondsToWholeDays(seconds: number | bigint | undefined): number | undefined {
  if (seconds === undefined) return undefined;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const days = Math.round(value / SECONDS_PER_DAY);
  return days > 0 ? days : undefined;
}

/**
 * Explainer-copy cycle lengths for Standard Proposals.
 * Plugin minDuration is 0 on mainnet, so veto days fall back to
 * STANDARD_PROPOSAL_VETO_PERIOD_DAYS unless a positive on-chain value exists.
 */
export function getStandardProposalCycleDays(params: {
  minDuration?: number | bigint;
  timelockPeriod?: number | bigint;
}): StandardProposalCycleDays {
  const vetoDays = secondsToWholeDays(params.minDuration) ?? STANDARD_PROPOSAL_VETO_PERIOD_DAYS;
  const timelockDays = secondsToWholeDays(params.timelockPeriod) ?? STANDARD_PROPOSAL_TIMELOCK_DAYS;

  return {
    vetoDays,
    timelockDays,
    totalCycleDays: vetoDays + timelockDays,
  };
}

/**
 * Format a proposal's veto window from millisecond timestamps (historical-safe).
 * Returns undefined when the proposal has no veto window — emergency proposals
 * share this plugin with vetoStartDate === vetoEndDate — so callers omit the
 * row rather than asserting a duration the proposal never had.
 */
export function formatVetoDurationLabel(startDateMs?: number, endDateMs?: number): string | undefined {
  if (!startDateMs || !endDateMs || endDateMs <= startDateMs) return undefined;

  const days = Math.round((endDateMs - startDateMs) / 1000 / SECONDS_PER_DAY);
  if (days <= 0) return undefined;

  return `${days} day${days === 1 ? "" : "s"}`;
}
