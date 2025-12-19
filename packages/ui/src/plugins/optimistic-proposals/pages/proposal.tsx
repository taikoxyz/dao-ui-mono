import type { useProposal } from "@/plugins/optimistic-proposals/hooks/useProposal";
import ProposalHeader from "@/plugins/optimistic-proposals/components/proposal/header";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalVeto } from "@/plugins/optimistic-proposals/hooks/useProposalVeto";
import { useProposalExecute } from "@/plugins/optimistic-proposals/hooks/useProposalExecute";
import { BodySection } from "@/components/proposal/proposalBodySection";
import type { IVote } from "@/utils/types";
import { useProposalStatus } from "../hooks/useProposalVariantStatus";
import { ProposalActions } from "@/components/proposalActions/proposalActions";
import { CardResources } from "@/components/proposal/cardResources";
import { Address } from "viem";
import { useToken } from "../hooks/useToken";
import { usePastSupply } from "../hooks/usePastSupply";
import { ElseIf, If, Then } from "@/components/if";
import { AlertCard, ProposalStatus, Heading, Button } from "@aragon/ods";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useTokenVotes } from "@/hooks/useTokenVotes";
import { ADDRESS_ZERO } from "@/utils/evm";
import { AddressText } from "@/components/text/address";
import { useGqlProposalSingle } from "@/utils/gql/hooks/useGetGqlProposalSingle";
import { useProposalId } from "../hooks/useProposalId";
import { useGetGqlRelatedProposal } from "@/utils/gql/hooks/useGetGqlRelatedProposal";
import { SecurityCouncilStage } from "../components/vote/security-council-stage";
import { CommunityVetoStage } from "../components/vote/community-veto-stage";
import { useRouter } from "next/router";
import { useExecutionTimestamp } from "@/hooks/useExecutionTimestamp";

const ZERO = BigInt(0);

export default function ProposalDetail({ index: proposalIdx }: { index: number }) {
  const { address } = useAccount();
  const router = useRouter();

  // Check if we're on a security-council route to hide Stage 2
  const isSecurityCouncilRoute = router.asPath.includes("/security-council");
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

  const showProposalLoading = getShowProposalLoading(proposal, proposalFetchStatus);
  const { status: proposalStatus } = useProposalStatus(proposal!);

  const { data: gqlProposal } = useGqlProposalSingle({
    proposalId: proposalId?.toString() ?? "",
    isStandard: false,
    isOptimistic: true,
    isEmergency: false,
  });
  const pastSupply = usePastSupply(proposal?.parameters.snapshotTimestamp ?? BigInt(0));

  const { isEmergency } = useProposalStatus(proposal);

  const { data: relatedProposal } = useGetGqlRelatedProposal({
    executionBlockNumber: gqlProposal?.creationBlockNumber ?? 0,
    isStandard: !isEmergency,
    isEmergency: isEmergency,
  });

  // Fetch execution timestamp if proposal was executed
  const { executionTimestamp } = useExecutionTimestamp(gqlProposal?.executionBlockNumber);

  // Determine Security Council status
  // Since this is an optimistic proposal that reached public stage, Security Council has already approved it
  const getSecurityCouncilStatus = () => {
    if (proposal?.executed) return "executed";
    // For optimistic proposals, if they exist in the public stage, they were already approved by Security Council
    if (
      proposalStatus === ProposalStatus.VETOED ||
      proposalStatus === ProposalStatus.ACCEPTED ||
      proposalStatus === ProposalStatus.ACTIVE
    )
      return "approved";
    return "pending";
  };

  // Determine Community Veto status
  const getCommunityVetoStatus = () => {
    if (proposal?.executed) return "executed";
    if (proposalStatus === ProposalStatus.VETOED) return "defeated";
    if (proposalStatus === ProposalStatus.ACCEPTED) return "passed";
    if (proposalStatus === ProposalStatus.ACTIVE) return "active";
    return "pending";
  };

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

                {/* Voting Stages Section with clear separation */}
                <div className="flex flex-col gap-6">
                  <div>
                    <Heading size="h2" className="mb-3">
                      Governance Process
                    </Heading>
                    <p className="mb-6 text-base text-neutral-600">
                      Proposals approved by the Security Council become eventually executable, unless the community
                      reaches the veto threshold during the community veto stage.
                    </p>
                  </div>

                  {/* Stage 1: Security Council Approval */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                        Stage 1
                      </span>
                    </div>
                    <SecurityCouncilStage
                      status={getSecurityCouncilStatus()}
                      approvals={getSecurityCouncilStatus() === "approved" ? 5 : 0} // If approved, show full approvals
                      requiredApprovals={5}
                      createdAt={Number(proposal?.parameters.vetoStartDate ?? 0) * 1000 - 7 * 24 * 60 * 60 * 1000} // Estimate
                      approvedAt={
                        getSecurityCouncilStatus() === "approved"
                          ? Number(proposal?.parameters.vetoStartDate ?? 0) * 1000
                          : undefined
                      }
                      isEmergency={false}
                    />
                  </div>

                  {/* Stage 2: Community Veto Period - Hidden for security-council routes */}
                  {!isSecurityCouncilRoute && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
                          Stage 2
                        </span>
                      </div>
                      <CommunityVetoStage
                        vetoCount={proposal?.vetoTally ?? BigInt(0)}
                        totalSupply={pastSupply ?? BigInt(0)}
                        threshold={
                          proposal?.parameters.minVetoRatio ? Number(proposal.parameters.minVetoRatio) / 1000000 : 0.1
                        }
                        status={getCommunityVetoStatus()}
                        startDate={Number(proposal?.parameters.vetoStartDate ?? 0) * 1000}
                        endDate={Number(proposal?.parameters.vetoEndDate ?? 0) * 1000}
                        canVeto={canVeto}
                        onVeto={vetoProposal}
                        isVetoLoading={isConfirmingVeto}
                        hasVetoed={vetoes?.some((v) => v.voter === address)}
                        tokenSymbol={tokenSymbol ?? "TAIKO"}
                        votes={
                          gqlProposal?.vetoes?.map(
                            (veto) =>
                              ({
                                address: veto.address,
                                variant: "no",
                              }) as IVote
                          ) ?? []
                        }
                        snapshotBlock={Number(proposal?.parameters.snapshotTimestamp ?? 0)}
                        executionTxHash={gqlProposal?.executor?.txHash}
                        executedAt={executionTimestamp ?? undefined}
                      />
                    </div>
                  )}

                  {/* Execute button for passed proposals - Hidden for security-council routes */}
                  {!isSecurityCouncilRoute && proposalStatus === ProposalStatus.ACCEPTED && (
                    <div className="mt-4">
                      <Button
                        size="lg"
                        variant="primary"
                        disabled={!canExecute || !proposal?.actions.length}
                        isLoading={isConfirmingExecution}
                        onClick={executeProposal}
                        className="w-full"
                      >
                        {proposal?.actions.length ? "Execute proposal" : "No actions to execute"}
                      </Button>
                    </div>
                  )}
                </div>
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
