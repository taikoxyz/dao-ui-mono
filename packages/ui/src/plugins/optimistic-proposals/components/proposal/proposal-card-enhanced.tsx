import Link from "next/link";
import { useProposalVeto } from "@/plugins/optimistic-proposals/hooks/useProposalVeto";
import { Card, ProposalStatus, Tag, Icon, IconType } from "@aragon/ods";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useProposalStatus } from "../../hooks/useProposalVariantStatus";
import { isAddressEqual, zeroAddress } from "viem";
import { usePastSupply } from "../../hooks/usePastSupply";
import { PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS, PUB_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { IGqlProposalMixin } from "@/utils/gql/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const DEFAULT_PROPOSAL_METADATA_TITLE = "(No proposal title)";
const DEFAULT_PROPOSAL_METADATA_SUMMARY = "(The metadata of the proposal is not available)";

type ProposalInputs = {
  proposalIndex: number;
  linkPrefix?: string;
  gqlProposal?: IGqlProposalMixin | undefined;
};

export default function EnhancedProposalCard(props: ProposalInputs) {
  const { proposal, proposalFetchStatus } = useProposalVeto(props.proposalIndex);

  const pastSupply = usePastSupply(proposal?.parameters.snapshotTimestamp ?? BigInt(0));

  const { status: proposalStatus } = useProposalStatus(proposal);
  const showLoading = getShowProposalLoading(proposal, proposalFetchStatus);
  const prefix = props.linkPrefix ? props.linkPrefix + "/" : "";

  const isEmergency = isAddressEqual(props.gqlProposal?.creator ?? zeroAddress, PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS);
  const isStandard = isAddressEqual(props.gqlProposal?.creator ?? zeroAddress, PUB_MULTISIG_PLUGIN_ADDRESS);

  if (!proposal && showLoading) {
    return (
      <section className="w-full">
        <Card className="p-6">
          <PleaseWaitSpinner fullMessage="Loading proposal..." />
        </Card>
      </section>
    );
  } else if (!proposal?.title && !proposal?.summary) {
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

  const thresholdPercentage = proposal?.parameters.minVetoRatio ? Number(proposal.parameters.minVetoRatio) / 10000 : 10; // Convert to percentage (e.g., 100000 -> 10%)
  const actualVetoPercentage = pastSupply > 0n ? Number((10000n * (proposal?.vetoTally ?? 0n)) / pastSupply) / 100 : 0;
  const progressPercentage = Math.min((actualVetoPercentage / thresholdPercentage) * 100, 100);

  const getProposalTypeIcon = () => {
    if (isEmergency) return <Icon icon={IconType.WARNING} size="sm" className="text-critical-600" />;
    if (isStandard) return <Icon icon={IconType.BLOCKCHAIN_BLOCKCHAIN} size="sm" className="text-primary-600" />;
    return null;
  };

  const getStatusIcon = () => {
    switch (proposalStatus) {
      case ProposalStatus.VETOED:
        return <Icon icon={IconType.CLOSE} size="sm" className="text-critical-600" />;
      case ProposalStatus.ACCEPTED:
        return <Icon icon={IconType.CHECKMARK} size="sm" className="text-success-600" />;
      case ProposalStatus.EXECUTED:
        return <Icon icon={IconType.CHECKMARK} size="sm" className="text-neutral-600" />;
      case ProposalStatus.ACTIVE:
        return <Icon icon={IconType.CLOCK} size="sm" className="text-primary-600" />;
      default:
        return <Icon icon={IconType.CLOCK} size="sm" className="text-neutral-400" />;
    }
  };

  const endDate = proposal?.parameters.vetoEndDate ? Number(proposal.parameters.vetoEndDate) * 1000 : undefined;
  const timeRemaining = endDate && proposalStatus === ProposalStatus.ACTIVE ? dayjs(endDate).fromNow(true) : null;

  // Determine Security Council status - if proposal reached public/optimistic stage, it was already approved
  const getSecurityCouncilStatus = () => {
    // Optimistic proposals only reach public voting if Security Council already approved them
    if (
      proposalStatus === ProposalStatus.ACTIVE ||
      proposalStatus === ProposalStatus.ACCEPTED ||
      proposalStatus === ProposalStatus.VETOED ||
      proposalStatus === ProposalStatus.EXECUTED
    ) {
      return "approved";
    }
    return "pending";
  };

  const securityCouncilStatus = getSecurityCouncilStatus();

  return (
    <Link href={`${prefix}#/proposals/${props.proposalIndex}`} className="block w-full">
      <Card className="hover:shadow-lg overflow-hidden p-0 transition-shadow duration-200">
        {/* Header with proposal type */}
        <div className="border-b border-neutral-100 bg-neutral-50 px-6 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getProposalTypeIcon()}
              <span className="font-medium text-sm text-neutral-700">
                {isEmergency ? "Emergency Proposal" : isStandard ? "Standard Proposal" : "Proposal"}
              </span>
              <span className="text-sm text-neutral-500">#{props.proposalIndex}</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <Tag
                variant={
                  proposalStatus === ProposalStatus.VETOED
                    ? "critical"
                    : proposalStatus === ProposalStatus.ACCEPTED
                      ? "success"
                      : proposalStatus === ProposalStatus.EXECUTED
                        ? "neutral"
                        : proposalStatus === ProposalStatus.ACTIVE
                          ? "primary"
                          : "neutral"
                }
                label={
                  proposalStatus === ProposalStatus.VETOED
                    ? "Vetoed"
                    : proposalStatus === ProposalStatus.ACCEPTED
                      ? "Passed"
                      : proposalStatus === ProposalStatus.EXECUTED
                        ? "Executed"
                        : proposalStatus === ProposalStatus.ACTIVE
                          ? "Active"
                          : "Pending"
                }
              />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="p-6">
          <div className="flex flex-col gap-3">
            {/* Title and summary */}
            <div>
              <h3 className="mb-2 line-clamp-1 text-lg font-semibold text-neutral-900">{proposal.title}</h3>
              <p className="line-clamp-2 text-sm text-neutral-600">{proposal.summary}</p>
            </div>

            {/* Two-stage indicator */}
            <div className="mt-2 flex gap-2">
              {/* Stage 1: Security Council */}
              <div className="flex-1 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-xs text-neutral-700">Security Council</span>
                </div>
                <div className="flex items-center gap-2">
                  {securityCouncilStatus === "approved" ? (
                    <>
                      <Icon icon={IconType.CHECKMARK} size="sm" className="text-success-600" />
                      <span className="text-xs text-success-700">Approved</span>
                    </>
                  ) : (
                    <>
                      <Icon icon={IconType.CLOCK} size="sm" className="text-neutral-500" />
                      <span className="text-xs text-neutral-600">Pending</span>
                    </>
                  )}
                </div>
              </div>

              {/* Stage 2: Community Veto */}
              <div
                className={`flex-1 rounded-lg border p-3 ${
                  proposalStatus === ProposalStatus.EXECUTED
                    ? "bg-blue-50 border-blue-100"
                    : "bg-critical-50 border-critical-100"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-xs text-neutral-700">
                    {proposalStatus === ProposalStatus.EXECUTED ? "Execution" : "Community Veto"}
                  </span>
                </div>
                {proposalStatus === ProposalStatus.ACTIVE && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-600">Progress</span>
                      <span className="font-medium text-xs text-neutral-800">
                        {actualVetoPercentage.toFixed(1)}% / {thresholdPercentage}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full transition-all duration-300 ${
                          progressPercentage >= 100 ? "bg-critical-500" : "bg-primary-500"
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    {timeRemaining && <span className="text-xs text-neutral-600">{timeRemaining} left</span>}
                  </div>
                )}
                {proposalStatus === ProposalStatus.VETOED && (
                  <div className="flex items-center gap-2">
                    <Icon icon={IconType.CLOSE} size="sm" className="text-critical-600" />
                    <span className="text-xs text-critical-700">Vetoed</span>
                  </div>
                )}
                {proposalStatus === ProposalStatus.ACCEPTED && (
                  <div className="flex items-center gap-2">
                    <Icon icon={IconType.CHECKMARK} size="sm" className="text-success-600" />
                    <span className="text-xs text-success-700">Passed</span>
                  </div>
                )}
                {proposalStatus === ProposalStatus.EXECUTED && (
                  <div className="flex items-center gap-2">
                    <Icon icon={IconType.CHECKMARK} size="sm" className="text-blue-600" />
                    <span className="text-blue-700 text-xs">Executed</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
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
