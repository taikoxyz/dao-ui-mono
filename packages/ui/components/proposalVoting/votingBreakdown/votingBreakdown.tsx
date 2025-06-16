import { BreakdownApprovalThresholdResult, type IBreakdownApprovalThresholdResult } from "./approvalThresholdResult";
import { BreakdownMajorityVotingResult, type IBreakdownMajorityVotingResult } from "./majorityVotingResult";
import { type VotingCta } from "./types";
import formatLargeNumber from "@/utils/formatLArgeNumber";

export type ProposalType = "majorityVoting" | "approvalThreshold";

export interface IVotingBreakdownProps<TType extends ProposalType = ProposalType> {
  variant: TType;
  result?: TType extends "approvalThreshold" ? IBreakdownApprovalThresholdResult : IBreakdownMajorityVotingResult;
  cta?: VotingCta;
  pastSupply?: bigint;
  vetoPercentage?: number;
}

export const VotingBreakdown: React.FC<IVotingBreakdownProps> = (props) => {
  const { result, cta, variant, pastSupply, vetoPercentage } = props;
  const [supplyText, supplyFormatted] = formatLargeNumber(pastSupply ?? BigInt(0));

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
        <div className="absolute right-0 right-[24px] top-[16px] text-primary-400 md:top-[30px]">
          {vetoPercentage} %
        </div>

        <div className="absolute right-6 top-[64px] hidden text-sm md:top-[80px] md:block">
          {pastSupply ? `${supplyFormatted} TAIKO` : "N/A"}
        </div>
      </div>
    );
  }
  return null;
};
