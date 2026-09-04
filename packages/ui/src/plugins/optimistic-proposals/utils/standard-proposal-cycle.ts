import {
  SECONDS_PER_DAY,
  STANDARD_PROPOSAL_TIMELOCK_DAYS,
  STANDARD_PROPOSAL_VETO_PERIOD_DAYS,
} from "@/constants";

export type StandardProposalCycleDays = {
  vetoDays: number;
  timelockDays: number;
  totalCycleDays: number;
};

/** Convert a positive duration in seconds to whole days; otherwise undefined. */
export function secondsToWholeDays(seconds: number | bigint | undefined): number | undefined {
  if (seconds === undefined) return undefined;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value / SECONDS_PER_DAY);
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

/** Format a proposal's veto window from millisecond timestamps (historical-safe). */
export function formatVetoDurationLabel(
  startDateMs?: number,
  endDateMs?: number,
  fallbackDays: number = STANDARD_PROPOSAL_VETO_PERIOD_DAYS
): string {
  if (startDateMs && endDateMs && endDateMs > startDateMs) {
    const days = Math.round((endDateMs - startDateMs) / 1000 / SECONDS_PER_DAY);
    if (days > 0) {
      return `${days} day${days === 1 ? "" : "s"}`;
    }
  }
  return `${fallbackDays} day${fallbackDays === 1 ? "" : "s"}`;
}
