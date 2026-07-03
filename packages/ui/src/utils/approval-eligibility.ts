export enum ApprovalButtonState {
  CHECKING = "checking",
  RETRY = "retry",
  APPROVE = "approve",
  UNABLE = "unable",
}

interface ApprovalEligibilityInput {
  // undefined = eligibility was never determined (read pending, errored, or never ran)
  canApprove: boolean | undefined;
  // any read in flight (initial load or retry) — react-query's isFetching, not
  // isLoading, so a retry after a failure shows as checking instead of a
  // frozen retry button
  isFetching: boolean;
  hasError: boolean;
}

// A settled read wins over loading and error: a background refetch that errors
// (or reloads) must not hide a previously confirmed positive — the contract
// re-checks canApprove on the approve transaction, so stale-positive is safe
// while a hidden Approve button locks an eligible signer out — and must not
// dress a confirmed denial up as a transient error to retry.
export function getApprovalButtonState({
  canApprove,
  isFetching,
  hasError,
}: ApprovalEligibilityInput): ApprovalButtonState {
  if (canApprove === true) return ApprovalButtonState.APPROVE;
  if (canApprove === false) return ApprovalButtonState.UNABLE;
  if (isFetching) return ApprovalButtonState.CHECKING;
  if (hasError) return ApprovalButtonState.RETRY;
  return ApprovalButtonState.UNABLE;
}
