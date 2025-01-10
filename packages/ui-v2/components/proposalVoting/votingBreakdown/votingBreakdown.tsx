import { BreakdownApprovalThresholdResult, type IBreakdownApprovalThresholdResult } from "./approvalThresholdResult";
import { BreakdownMajorityVotingResult, type IBreakdownMajorityVotingResult } from "./majorityVotingResult";
import { type VotingCta } from "./types";

export type ProposalType = "majorityVoting" | "approvalThreshold";

export interface IVotingBreakdownProps<TType extends ProposalType = ProposalType> {
  variant: TType;
  result?: TType extends "approvalThreshold" ? IBreakdownApprovalThresholdResult : IBreakdownMajorityVotingResult;
  cta?: VotingCta;
}

export const VotingBreakdown: React.FC<IVotingBreakdownProps> = (props) => {
  const { result, cta, variant } = props;

  if (!result) return <></>;
  else if (variant === "approvalThreshold") {
    return (
      <BreakdownApprovalThresholdResult
        approvalAmount={(result as IBreakdownApprovalThresholdResult).approvalAmount}
        approvalThreshold={(result as IBreakdownApprovalThresholdResult).approvalThreshold}
        stage={(result as IBreakdownApprovalThresholdResult).stage}
        cta={cta}
      />
    );
  } else if (variant === "majorityVoting") {
    return (
      <BreakdownMajorityVotingResult votingScores={(result as IBreakdownMajorityVotingResult).votingScores} cta={cta} />
    );
  }
  return null;
};
