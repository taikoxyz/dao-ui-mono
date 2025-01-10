import Link from "next/link";
import { useProposalVeto } from "@/plugins/optimistic-proposals/hooks/useProposalVeto";
import { Card, ProposalStatus, ProposalDataListItem } from "@aragon/ods";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalStatus } from "../../hooks/useProposalVariantStatus";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { usePastSupply } from "../../hooks/usePastSupply";
import { useToken } from "../../hooks/useToken";

const DEFAULT_PROPOSAL_METADATA_TITLE = "(No proposal title)";
const DEFAULT_PROPOSAL_METADATA_SUMMARY = "(The metadata of the proposal is not available)";

type ProposalInputs = {
  proposalIndex: number;
  linkPrefix?: string;
};

export default function ProposalCard(props: ProposalInputs) {
  const { address } = useAccount();
  const { proposal, proposalFetchStatus, vetoes } = useProposalVeto(props.proposalIndex);
  const pastSupply = usePastSupply(proposal);
  const { symbol: tokenSymbol } = useToken();

  const { status: proposalStatus } = useProposalStatus(proposal);
  const showLoading = getShowProposalLoading(proposal, proposalFetchStatus);
  const hasVetoed = vetoes?.some((veto) => veto.voter === address);
  const prefix = props.linkPrefix ? props.linkPrefix + "/" : "";

  if (!proposal && showLoading) {
    return (
      <section className="w-full">
        <Card className="p-6">
          <PleaseWaitSpinner fullMessage="Loading proposal..." />
        </Card>
      </section>
    );
  } else if (!proposal?.title && !proposal?.summary) {
    // We have the proposal but no metadata yet
    return (
      <Link href={`${prefix}#/proposals/${props.proposalIndex}`} className="w-full">
        <Card className="p-6">
          <PleaseWaitSpinner fullMessage="Loading metadata..." />
        </Card>
      </Link>
    );
  } else if (proposalFetchStatus.metadataReady && !proposal?.title) {
    return (
      <Link href={`${prefix}#/proposals/${props.proposalIndex}`} className="w-full">
        <Card className="p-6">
          <div className="xl:4/5 overflow-hidden text-ellipsis text-nowrap pr-4 md:w-7/12 lg:w-3/4">
            <h4 className="mb-1 line-clamp-1 text-lg text-neutral-300">
              {Number(props.proposalIndex) + 1} - {DEFAULT_PROPOSAL_METADATA_TITLE}
            </h4>
            <p className="line-clamp-3 text-base text-neutral-300">{DEFAULT_PROPOSAL_METADATA_SUMMARY}</p>
          </div>
        </Card>
      </Link>
    );
  }

  let vetoPercentage = 0;
  if (proposal?.vetoTally && pastSupply && proposal.parameters.minVetoRatio) {
    // Example: 15% of the token supply (adjusted for decimal precision, 10^6)
    const defeatThreshold = (pastSupply * BigInt(proposal.parameters.minVetoRatio)) / BigInt(1000000);
    vetoPercentage = Number((10000n * proposal.vetoTally) / defeatThreshold) / 100;
  }

  return (
    <ProposalDataListItem.Structure
      className="!p-6"
      title={proposal.title}
      summary={proposal.summary}
      href={`${prefix}#/proposals/${props.proposalIndex}`}
      voted={hasVetoed}
      date={
        [ProposalStatus.ACTIVE, ProposalStatus.ACCEPTED].includes(proposalStatus!) && proposal.parameters.vetoEndDate
          ? Number(proposal.parameters.vetoEndDate) * 1000
          : undefined
      }
      result={{
        option: "Veto",
        voteAmount: formatEther(proposal.vetoTally) + " " + (tokenSymbol || "TKO"),
        votePercentage: vetoPercentage,
      }}
      publisher={{ address: proposal.creator }}
      status={proposalStatus!}
      type={"majorityVoting"}
    />
  );
}

function getShowProposalLoading(
  proposal: ReturnType<typeof useProposalVeto>["proposal"],
  status: ReturnType<typeof useProposalVeto>["proposalFetchStatus"]
) {
  if (!proposal || status.proposalLoading) return true;
  else if (status.metadataLoading && !status.metadataError) return true;
  else if (!proposal?.title && !status.metadataError) return true;

  return false;
}
