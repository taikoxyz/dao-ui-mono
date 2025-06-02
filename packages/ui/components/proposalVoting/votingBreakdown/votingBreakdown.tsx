import { usePastSupply } from "@/plugins/optimistic-proposals/hooks/usePastSupply";
import { BreakdownApprovalThresholdResult, type IBreakdownApprovalThresholdResult } from "./approvalThresholdResult";
import { BreakdownMajorityVotingResult, type IBreakdownMajorityVotingResult } from "./majorityVotingResult";
import { type VotingCta } from "./types";
import { formatEther } from "viem";

export type ProposalType = "majorityVoting" | "approvalThreshold";

export interface IVotingBreakdownProps<TType extends ProposalType = ProposalType> {
  variant: TType;
  result?: TType extends "approvalThreshold" ? IBreakdownApprovalThresholdResult : IBreakdownMajorityVotingResult;
  cta?: VotingCta;
  pastSupply?: bigint;
}

export const VotingBreakdown: React.FC<IVotingBreakdownProps> = (props) => {
  const { result, cta, variant, pastSupply } = props;
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
      <div className="relative">
        <BreakdownMajorityVotingResult
          votingScores={(result as IBreakdownMajorityVotingResult).votingScores}
          cta={cta}
        />
        <div className="absolute bottom-6 right-6 text-sm">
          Voting Supply: {pastSupply ? `${formatEther(pastSupply / BigInt(1000000))} TAIKO` : "N/A"}
        </div>
      </div>
    );
  }
  return null;
};
