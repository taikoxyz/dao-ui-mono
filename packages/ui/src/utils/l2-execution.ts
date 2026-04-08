export function shouldRenderL2ExecutionCard({
  hasL2Leg,
  isExtracting,
  shouldCheckExecutedProposal,
}: {
  hasL2Leg: boolean;
  isExtracting: boolean;
  shouldCheckExecutedProposal: boolean;
}) {
  return hasL2Leg || isExtracting || shouldCheckExecutedProposal;
}

export function getConfirmedL2MessageOutcome(messageStatus?: number) {
  if (messageStatus === 2) return "success";
  if (messageStatus === 3) return "failed";

  return "pending";
}
