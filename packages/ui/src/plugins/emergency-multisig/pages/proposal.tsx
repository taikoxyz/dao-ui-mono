import { useProposal } from "@/plugins/emergency-multisig/hooks/useProposal";
import ProposalHeader from "@/plugins/emergency-multisig/components/proposal/header";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalApprove } from "@/plugins/emergency-multisig/hooks/useProposalApprove";
import { useProposalExecute } from "@/plugins/emergency-multisig/hooks/useProposalExecute";
import { BodySection } from "@/components/proposal/proposalBodySection";
import { IVote } from "@/utils/types";
import { SecurityCouncilApprovalStage } from "@/plugins/multisig/components/vote/security-council-approval-stage";
import { Heading } from "@aragon/ods";
import { ProposalActions } from "@/components/proposalActions/proposalActions";
import { CardResources } from "@/components/proposal/cardResources";
import { useDerivedWallet } from "../../../hooks/useDerivedWallet";
import { useBlockTimestamp } from "@/hooks/useBlockTimestamp";
import { useAccount } from "wagmi";
import { Else, ElseIf, If, Then } from "@/components/if";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { CardEmptyState } from "@aragon/ods";
import { useGqlProposalSingle } from "@/utils/gql/hooks/useGetGqlProposalSingle";

export default function ProposalDetail({ id: proposalId }: { id: string }) {
  const { isConnected, address } = useAccount();
  const { open } = useWeb3Modal();
  const { publicKey, requestSignature } = useDerivedWallet();

  const {
    proposal,
    proposalFetchStatus,
    canApprove,
    approvals,
    isConfirming: isConfirmingApproval,
    approveProposal,
  } = useProposalApprove(proposalId);
  const { executeProposal, canExecute, isConfirming: isConfirmingExecution } = useProposalExecute(proposalId);

  const showProposalLoading = getShowProposalLoading(proposal, proposalFetchStatus);

  const { data: gqlProposal } = useGqlProposalSingle({
    proposalId: proposalId,
    isStandard: false,
    isOptimistic: false,
    isEmergency: true,
  });

  // Get the actual creation timestamp from the block number
  const { timestamp: creationTimestamp } = useBlockTimestamp(gqlProposal?.creationBlockNumber);

  // Convert approvals to votes format - prefer subgraph data (gqlProposal.approvers) over event logs (approvals)
  // The subgraph data is more reliable as event log fetching can fail or return empty
  const approvalVotes: IVote[] =
    (gqlProposal?.approvers?.length ?? 0) > 0
      ? gqlProposal!.approvers.map(
          ({ address: approverAddress }) => ({ address: approverAddress, variant: "approve" }) as IVote
        )
      : (approvals?.map(({ approver }) => ({ address: approver, variant: "approve" }) as IVote) ?? []);

  // Check if current user has already approved - check both subgraph and event data
  const hasApproved =
    gqlProposal?.approvers?.some((approver) => approver.address === address) ||
    approvals?.some((approval) => approval.approver === address) ||
    false;

  // Determine status
  const getApprovalStatus = () => {
    if (proposal?.executed) return "executed";
    if ((proposal?.approvals ?? 0) >= (proposal?.parameters.minApprovals ?? 0)) return "approved";
    return "pending";
  };

  if (!proposal || showProposalLoading) {
    return (
      <section className="justify-left items-left flex w-screen min-w-full max-w-full">
        <PleaseWaitSpinner />
      </section>
    );
  }

  return (
    <section className="flex w-screen min-w-full max-w-full flex-col items-center">
      <ProposalHeader proposalId={proposalId} proposal={proposal} />

      <If condition={!isConnected}>
        <Then>
          <div className="mt-12">
            <CardEmptyState
              heading="Connect wallet"
              description="Please connect your wallet to access the emergency proposals section."
              objectIllustration={{
                object: "ACTION",
              }}
              primaryButton={{
                label: "Connect wallet",
                onClick: () => open(),
              }}
            />
          </div>
        </Then>
        <ElseIf condition={!publicKey}>
          <div className="mt-12">
            <CardEmptyState
              heading="Sign in to continue"
              description="Please sign in with your wallet to decrypt the private proposal data."
              objectIllustration={{
                object: "ACTION",
              }}
              primaryButton={{
                label: "Sign in",
                onClick: () => requestSignature(),
              }}
            />
          </div>
        </ElseIf>
        <Else>
          <div className="mx-auto w-full max-w-screen-xl px-4 py-6 md:px-16 md:pb-20 md:pt-10">
            <div className="flex w-full flex-col gap-x-12 gap-y-6 md:flex-row">
              <div className="flex flex-col gap-y-6 md:w-[63%] md:shrink-0">
                <BodySection body={proposal.description ?? "No description was provided"} />

                {/* Emergency Security Council Approval Stage */}
                <div className="flex flex-col gap-4">
                  <div>
                    <Heading size="h2" className="mb-3">
                      Emergency Security Council Approval
                    </Heading>
                    <p className="mb-6 text-base text-neutral-600">
                      The onchain emergency multisig flow allows its members to create proposals that, if approved by a
                      super majority, will be executed directly by the DAO.
                    </p>
                  </div>

                  <SecurityCouncilApprovalStage
                    status={getApprovalStatus()}
                    approvals={proposal?.approvals ?? 0}
                    requiredApprovals={proposal?.parameters.minApprovals ?? 0}
                    votes={approvalVotes}
                    canApprove={canApprove}
                    onApprove={approveProposal}
                    isApproveLoading={isConfirmingApproval}
                    canExecute={canExecute}
                    onExecute={executeProposal}
                    isExecuteLoading={isConfirmingExecution}
                    hasApproved={hasApproved}
                    createdAt={creationTimestamp}
                    expirationDate={Number(proposal?.parameters.expirationDate) * 1000}
                    isEmergency={true}
                    executed={proposal?.executed ?? false}
                    snapshotBlock={Number(proposal?.parameters.snapshotBlock)}
                  />
                </div>
                <ProposalActions
                  actions={proposal.actions}
                  emptyListDescription="Either the proposal has no actions or they cannot be decrypted by your account"
                />
              </div>
              <div className="flex flex-col gap-y-6 md:w-[33%]">
                <CardResources gqlProposal={gqlProposal} resources={proposal.resources} title="Resources" />
              </div>
            </div>
          </div>
        </Else>
      </If>
    </section>
  );
}

function getShowProposalLoading(
  proposal: ReturnType<typeof useProposal>["proposal"],
  status: ReturnType<typeof useProposal>["status"]
) {
  if (!proposal && status.proposalLoading) return true;
  else if (status.metadataLoading && !status.metadataError) return true;
  else if (!proposal?.title && !status.metadataError) return true;

  return false;
}
