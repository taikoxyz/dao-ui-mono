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
 *
 * The two settings need different treatment. minDuration is a *floor*, not the
 * window itself, and it reads 0 on mainnet — "no floor" is indistinguishable
 * from unset, so it falls back to STANDARD_PROPOSAL_VETO_PERIOD_DAYS.
 * timelockPeriod is the real value, so a configured 0 means "no timelock" and
 * is preserved; only an unresolved read falls back. useProposalVariantStatus
 * treats a zero timelock as no delay, and this copy must not contradict it.
 */
export function getStandardProposalCycleDays(params: {
  minDuration?: number | bigint;
  timelockPeriod?: number | bigint;
}): StandardProposalCycleDays {
  const vetoDays = secondsToWholeDays(params.minDuration) ?? STANDARD_PROPOSAL_VETO_PERIOD_DAYS;
  const timelockDays =
    params.timelockPeriod === undefined
      ? STANDARD_PROPOSAL_TIMELOCK_DAYS
      : (secondsToWholeDays(params.timelockPeriod) ?? 0);

  return {
    vetoDays,
    timelockDays,
    totalCycleDays: vetoDays + timelockDays,
  };
}

/** Pluralize a whole number of days. */
export function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * The clause both Standard Proposal asides use to describe what follows the
 * veto window. Collapses when there is no timelock to wait out. Execution is
 * a manual call, so the copy says "can be executed", not "is executed".
 */
export function formatTimelockClause({ timelockDays, totalCycleDays }: StandardProposalCycleDays): string {
  if (timelockDays <= 0) {
    return "If not vetoed, it can be executed as soon as the veto period ends.";
  }
  return `If not vetoed, a ${timelockDays}-day timelock follows (${formatDays(totalCycleDays)} total) before it can be executed.`;
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

  return formatDays(days);
}
