import type { useProposal } from "@/plugins/optimistic-proposals/hooks/useProposal";
import ProposalHeader from "@/plugins/optimistic-proposals/components/proposal/header";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalVeto } from "@/plugins/optimistic-proposals/hooks/useProposalVeto";
import { useProposalExecute } from "@/plugins/optimistic-proposals/hooks/useProposalExecute";
import { BodySection } from "@/components/proposal/proposalBodySection";
import { IBreakdownMajorityVotingResult, ProposalVoting } from "@/components/proposalVoting";
import type { ITransformedStage, IVote } from "@/utils/types";
import { ProposalStages } from "@/utils/types";
import { useProposalStatus } from "../hooks/useProposalVariantStatus";
import dayjs from "dayjs";
import { ProposalActions } from "@/components/proposalActions/proposalActions";
import { CardResources } from "@/components/proposal/cardResources";
import { Address, formatEther } from "viem";
import { useToken } from "../hooks/useToken";
import { usePastSupply } from "../hooks/usePastSupply";
import { ElseIf, If, Then } from "@/components/if";
import { AlertCard, ProposalStatus } from "@aragon/ods";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useTokenVotes } from "@/hooks/useTokenVotes";
import { ADDRESS_ZERO } from "@/utils/evm";
import { AddressText } from "@/components/text/address";
import { useGqlProposalSingle } from "@/utils/gql/hooks/useGetGqlProposalSingle";
import { useProposalId } from "../hooks/useProposalId";
import { useGetGqlRelatedProposal } from "@/utils/gql/hooks/useGetGqlRelatedProposal";

const ZERO = BigInt(0);

export default function ProposalDetail({ index: proposalIdx }: { index: number }) {
  const { address } = useAccount();
  const {
    proposal,
    proposalFetchStatus,
    canVeto,
    vetoes,
    isConfirming: isConfirmingVeto,
    vetoProposal,
  } = useProposalVeto(proposalIdx);

  const { symbol: tokenSymbol } = useToken();
  const { balance, delegatesTo } = useTokenVotes(address);
  const { proposalId } = useProposalId(proposalIdx);
  const { executeProposal, canExecute, isConfirming: isConfirmingExecution } = useProposalExecute(proposalIdx);

  const startDate = dayjs(Number(proposal?.parameters.vetoStartDate) * 1000).toString();
  const endDate = dayjs(Number(proposal?.parameters.vetoEndDate) * 1000).toString();

  const showProposalLoading = getShowProposalLoading(proposal, proposalFetchStatus);
  const { status: proposalStatus } = useProposalStatus(proposal!);

  const { data: gqlProposal } = useGqlProposalSingle({
    proposalId: proposalId?.toString() ?? "",
    isStandard: false,
    isOptimistic: true,
    isEmergency: false,
  });
  const pastSupply = usePastSupply(proposal?.parameters.snapshotTimestamp ?? BigInt(0));

  let vetoPercentage = 0;
  if (proposal?.vetoTally && pastSupply && proposal.parameters.minVetoRatio) {
    // Example: 15% of the token supply (adjusted for decimal precision, 10^6)
    const defeatThreshold = (pastSupply * BigInt(proposal.parameters.minVetoRatio)) / BigInt(1000000);
    vetoPercentage = Number((10000n * proposal.vetoTally) / defeatThreshold) / 100;
  }

  let cta: IBreakdownMajorityVotingResult["cta"];
  if (proposal?.executed) {
    /*
    cta = {
      disabled: true,
      label: "Executed",
    };*/
  } else if (proposalStatus === ProposalStatus.ACCEPTED) {
    cta = {
      disabled: !canExecute || !proposal?.actions.length,
      isLoading: isConfirmingExecution,
      label: proposal?.actions.length ? "Execute proposal" : "No actions to execute",
      onClick: executeProposal,
    };
  } else if (proposalStatus === ProposalStatus.ACTIVE) {
    cta = {
      disabled: !canVeto,
      isLoading: isConfirmingVeto,
      label: "Veto proposal",
      onClick: vetoProposal,
    };
  }

  const { isEmergency } = useProposalStatus(proposal);

  const { data: relatedProposal } = useGetGqlRelatedProposal({
    executionBlockNumber: gqlProposal?.creationBlockNumber ?? 0,
    isStandard: !isEmergency,
    isEmergency: isEmergency,
  });

  const proposalStage: ITransformedStage[] = [
    {
      id: "1",
      type: ProposalStages.OPTIMISTIC_EXECUTION,
      variant: "majorityVoting",
      title: "Optimistic voting",
      status: proposalStatus!,
      disabled: false,
      proposalId: proposalIdx.toString(),
      providerId: "1",
      result: {
        cta,
        votingScores: [
          {
            option: "Veto",
            voteAmount: formatEther(proposal?.vetoTally ?? BigInt(0)),
            votePercentage: vetoPercentage / 10,
            tokenSymbol: tokenSymbol ?? "TAIKO",
          },
        ],
        proposalId: proposalIdx.toString(),
      },
      details: {
        censusTimestamp: Number(proposal?.parameters.snapshotTimestamp ?? 0) ?? 0,
        startDate,
        endDate,
        strategy: "Optimistic voting",
        options: "Veto",
      },
      votes: vetoes?.map(({ voter }) => ({ address: voter, variant: "no" }) as IVote) ?? [],
    },
  ];

  const hasBalance = balance !== undefined && balance > ZERO;
  const delegatingToSomeoneElse = !!delegatesTo && delegatesTo !== address && delegatesTo !== ADDRESS_ZERO;
  const delegatedToZero = !!delegatesTo && delegatesTo === ADDRESS_ZERO;

  if (!proposal || showProposalLoading) {
    return (
      <section className="justify-left items-left flex w-screen min-w-full max-w-full">
        <PleaseWaitSpinner />
      </section>
    );
  }

  return (
    <section className="flex w-screen min-w-full max-w-full flex-col items-center">
      <ProposalHeader gqlProposal={relatedProposal} proposalIdx={proposalIdx} proposal={proposal} />

      <div className="mx-auto w-full max-w-screen-xl px-4 py-6 md:px-16 md:pb-20 md:pt-10">
        <div className="flex w-full flex-col gap-x-12 gap-y-6 md:flex-row">
          <div className="flex flex-col gap-y-6 md:w-[63%] md:shrink-0">
            <BodySection body={proposal.description ?? "No description was provided"} />
            {!isEmergency && (
              <>
                <If condition={hasBalance && (delegatingToSomeoneElse ?? delegatedToZero)}>
                  <NoVetoPowerWarning
                    delegatingToSomeoneElse={delegatingToSomeoneElse}
                    delegatesTo={delegatesTo}
                    delegatedToZero={delegatedToZero}
                    address={address}
                    canVeto={canVeto}
                  />
                </If>
                <ProposalVoting
                  stages={proposalStage}
                  description="Proposals approved by the Security Council become eventually executable, unless the community reaches the veto threshold during the community veto stage."
                />
              </>
            )}
            <ProposalActions actions={proposal.actions} />
          </div>
          <div className="flex flex-col gap-y-6 md:w-[33%]">
            <CardResources
              gqlProposal={gqlProposal}
              relatedProposal={relatedProposal}
              resources={proposal.resources}
              title="Resources"
            />
            <div>
              <ul className="list-inside list-disc">
                <li>
                  In order to vote, tokens must be held in the voter’s wallet prior to the creation of the proposal.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const NoVetoPowerWarning = ({
  delegatingToSomeoneElse,
  delegatesTo,
  delegatedToZero,
  address,
  canVeto,
}: {
  delegatingToSomeoneElse: boolean;
  delegatesTo: Address | undefined;
  delegatedToZero: boolean;
  address: Address | undefined;
  canVeto: boolean;
}) => {
  return (
    <AlertCard
      description={
        <span className="text-sm">
          <If condition={delegatingToSomeoneElse}>
            <Then>
              You are currently delegating your voting power to <AddressText bold={false}>{delegatesTo}</AddressText>.
              If you wish to participate by yourself in future proposals,
            </Then>
            <ElseIf condition={delegatedToZero}>
              You have not self delegated your voting power to participate in the DAO. If you wish to participate in
              future proposals,
            </ElseIf>
          </If>
          &nbsp;make sure that{" "}
          <Link
            href={"/plugins/security-council/#/delegates/" + address}
            className="!text-sm text-primary-400 hover:underline"
          >
            your voting power is self delegated
          </Link>
          .
        </span>
      }
      message={
        delegatingToSomeoneElse
          ? "Your voting power is currently delegated"
          : canVeto
            ? "You cannot veto on new proposals"
            : "You cannot veto"
      }
      variant="info"
    />
  );
};

function getShowProposalLoading(
  proposal: ReturnType<typeof useProposal>["proposal"],
  status: ReturnType<typeof useProposal>["status"]
) {
  if (!proposal && status.proposalLoading) return true;
  else if (status.metadataLoading && !status.metadataError) return true;
  else if (!proposal?.title && !status.metadataError) return true;

  return false;
}
