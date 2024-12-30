import { useProposal } from "@/plugins/emergency-multisig/hooks/useProposal";
import ProposalHeader from "@/plugins/emergency-multisig/components/proposal/header";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalApprove } from "@/plugins/emergency-multisig/hooks/useProposalApprove";
import { useProposalExecute } from "@/plugins/emergency-multisig/hooks/useProposalExecute";
import { BodySection } from "@/components/proposal/proposalBodySection";
import { ProposalVoting } from "@/components/proposalVoting";
import { ITransformedStage, IVote, ProposalStages } from "@/utils/types";
import { useProposalStatus } from "../hooks/useProposalVariantStatus";
import dayjs from "dayjs";
import { ProposalActions } from "@/components/proposalActions/proposalActions";
import { CardResources } from "@/components/proposal/cardResources";
import { useDerivedWallet } from "../../../hooks/useDerivedWallet";
import { useAccount } from "wagmi";
import { Else, ElseIf, If, Then } from "@/components/if";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { CardEmptyState } from "@aragon/ods";

export default function ProposalDetail({ id: proposalId }: { id: string }) {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const {
    proposal,
    proposalFetchStatus,
    canApprove,
    approvals,
    isConfirming: isConfirmingApproval,
    approveProposal,
  } = useProposalApprove(proposalId);
  const { executeProposal, canExecute, isConfirming: isConfirmingExecution } = useProposalExecute(proposalId);
  const { publicKey, requestSignature } = useDerivedWallet();

  const showProposalLoading = getShowProposalLoading(proposal, proposalFetchStatus);
  const proposalStatus = useProposalStatus(proposal!);

  const proposalStage: ITransformedStage[] = [
    {
      id: "1",
      type: ProposalStages.MULTISIG_APPROVAL,
      variant: "approvalThreshold",
      title: "Onchain multisig",
      status: proposalStatus!,
      disabled: false,
      proposalId: proposalId,
      providerId: "1",
      result: {
        cta: proposal?.executed
          ? {
              disabled: true,
              label: "Executed",
            }
          : canExecute
            ? {
                isLoading: isConfirmingExecution,
                label: "Execute proposal",
                onClick: executeProposal,
              }
            : {
                disabled: !canApprove,
                isLoading: isConfirmingApproval,
                label: "Approve proposal",
                onClick: approveProposal,
              },
        approvalAmount: proposal?.approvals || 0,
        approvalThreshold: proposal?.parameters.minApprovals || 0,
      },
      details: {
        censusBlock: Number(proposal?.parameters.snapshotBlock),
        startDate: "",
        endDate: dayjs(Number(proposal?.parameters.expirationDate) * 1000).toString(),
        strategy: "Approval threshold",
        options: "Approve",
      },
      votes: approvals?.map(({ approver }) => ({ address: approver, variant: "approve" }) as IVote) || [],
    },
  ];

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
                <BodySection body={proposal.description || "No description was provided"} />
                <ProposalVoting
                  stages={proposalStage}
                  description="The onchain emergency multisig flow allows its members to create proposals that, if approved by a super majority, will be executed directly by the DAO."
                />
                <ProposalActions
                  actions={proposal.actions}
                  emptyListDescription="Either the proposal has no actions or they cannot be decrypted by your account"
                />
              </div>
              <div className="flex flex-col gap-y-6 md:w-[33%]">
                <CardResources resources={proposal.resources} title="Resources" />
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
