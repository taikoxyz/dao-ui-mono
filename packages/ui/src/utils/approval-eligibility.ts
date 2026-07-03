export type ApprovalButtonState = "checking" | "retry" | "approve" | "unable";

interface ApprovalEligibilityInput {
  canApprove: boolean;
  isLoading: boolean;
  hasError: boolean;
}

// A background refetch that errors (or reloads) must not hide a previously
// confirmed positive eligibility: the contract re-checks canApprove on the
// actual approve transaction, so stale-positive is safe while a hidden
// Approve button locks an eligible signer out.
export function getApprovalButtonState({
  canApprove,
  isLoading,
  hasError,
}: ApprovalEligibilityInput): ApprovalButtonState {
  if (canApprove) return "approve";
  if (isLoading) return "checking";
  if (hasError) return "retry";
  return "unable";
}
