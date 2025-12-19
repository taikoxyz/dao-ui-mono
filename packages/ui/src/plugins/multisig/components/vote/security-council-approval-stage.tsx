import { FC } from "react";
import { Card, Tag, Button, Icon, IconType, Tabs, Link } from "@aragon/ods";
import { Tabs as RadixTabsRoot } from "@radix-ui/react-tabs";
import dayjs from "dayjs";
import { VotesDataList } from "@/components/proposalVoting/votesDataList/votesDataList";
import type { IVote } from "@/utils/types";
import { PUB_CHAIN } from "@/constants";

interface SecurityCouncilApprovalStageProps {
  status: "pending" | "approved" | "rejected" | "executed";
  approvals: number;
  requiredApprovals: number;
  votes?: IVote[];
  canApprove?: boolean;
  onApprove?: () => void;
  isApproveLoading?: boolean;
  canExecute?: boolean;
  onExecute?: () => void;
  isExecuteLoading?: boolean;
  hasApproved?: boolean;
  createdAt?: number;
  expirationDate?: number;
  isEmergency?: boolean;
  executed?: boolean;
  snapshotBlock?: number;
  executionTxHash?: string;
  executedAt?: number;
}

export const SecurityCouncilApprovalStage: FC<SecurityCouncilApprovalStageProps> = ({
  status,
  approvals,
  requiredApprovals,
  votes = [],
  canApprove = false,
  onApprove,
  isApproveLoading = false,
  canExecute = false,
  onExecute,
  isExecuteLoading = false,
  hasApproved = false,
  createdAt,
  expirationDate,
  isEmergency = false,
  executed = false,
  snapshotBlock,
  executionTxHash,
  executedAt,
}) => {
  const progressPercentage = (approvals / requiredApprovals) * 100;
  const thresholdReached = approvals >= requiredApprovals;

  const getStatusIcon = () => {
    if (executed) return <Icon icon={IconType.CHECKMARK} size="md" className="text-success-600" />;
    if (thresholdReached) return <Icon icon={IconType.CHECKMARK} size="md" className="text-success-600" />;
    if (status === "rejected") return <Icon icon={IconType.CLOSE} size="md" className="text-critical-600" />;
    return <Icon icon={IconType.CLOCK} size="md" className="text-primary-600" />;
  };

  const getStatusTag = () => {
    if (executed) return <Tag variant="neutral" label="Executed" />;
    if (thresholdReached && !executed) return <Tag variant="success" label="Ready to Execute" />;
    if (status === "rejected") return <Tag variant="critical" label="Rejected" />;
    return <Tag variant="primary" label="Awaiting Approvals" />;
  };

  const getStatusMessage = () => {
    if (executed) {
      const executedText = executedAt ? ` on ${dayjs(executedAt).format("MMM D, YYYY [at] HH:mm")}` : "";
      return `Proposal has been executed${executedText}`;
    }
    if (thresholdReached && isEmergency)
      return `Approved by ${approvals} of ${requiredApprovals} Security Council members - Ready for execution`;
    if (thresholdReached && !isEmergency)
      return `Approved by ${approvals} of ${requiredApprovals} Security Council members - Ready to send to optimistic approval`;
    if (status === "rejected") return "Proposal was rejected by Security Council";
    return `${approvals} of ${requiredApprovals} approvals received`;
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 bg-neutral-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Security Council {isEmergency ? "Emergency" : "Standard"} Approval
              </h3>
              <p className="text-sm text-neutral-600">
                {isEmergency ? "Emergency multisig approval" : "Onchain multisig approval"}
              </p>
            </div>
          </div>
          {getStatusTag()}
        </div>
      </div>

      {/* Content with tabs */}
      <RadixTabsRoot defaultValue="overview">
        <Tabs.List className="px-6 pt-4">
          <Tabs.Trigger value="overview" label="Overview" />
          <Tabs.Trigger value="votes" label={`Approvals (${votes.length})`} />
          <Tabs.Trigger value="details" label="Details" />
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="p-6 pt-4">
            <div className="flex flex-col gap-4">
              {/* Status message */}
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <p className="font-medium text-sm text-neutral-800">{getStatusMessage()}</p>
                  {createdAt && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Created {dayjs(createdAt).format("MMM D, YYYY HH:mm")}
                    </p>
                  )}
                  {expirationDate && !executed && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Expires {dayjs(expirationDate).format("MMM D, YYYY HH:mm")}
                    </p>
                  )}
                  {executed && executionTxHash && (
                    <Link
                      href={`${PUB_CHAIN.blockExplorers?.default.url}/tx/${executionTxHash}`}
                      target="_blank"
                      variant="primary"
                      iconRight={IconType.LINK_EXTERNAL}
                      className="mt-2 inline-flex text-sm"
                    >
                      View execution transaction
                    </Link>
                  )}
                </div>
              </div>

              {/* Progress visualization */}
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-sm text-neutral-700">Approval Progress</span>
                  <span className="text-xs text-neutral-500">
                    {approvals} / {requiredApprovals} required
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-2">
                  <div className="h-8 overflow-hidden rounded-lg bg-neutral-100">
                    <div
                      className={`h-full transition-all duration-500 ${
                        thresholdReached ? "bg-success-500" : "bg-primary-500"
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {/* Progress legend */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-3 w-3 rounded ${thresholdReached ? "bg-success-500" : "bg-primary-500"}`} />
                        <span className="text-neutral-600">Current: {approvals} approvals</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="bg-white h-3 w-3 rounded border-2 border-neutral-400" />
                        <span className="text-neutral-600">Required: {requiredApprovals} approvals</span>
                      </div>
                    </div>
                    <span className="font-medium text-neutral-800">{progressPercentage.toFixed(1)}% complete</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="mb-1 text-xs text-neutral-500">Current Approvals</p>
                    <p className="text-lg font-semibold text-neutral-900">{approvals}</p>
                    <p className="text-xs text-neutral-600">Security Council Members</p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-3">
                    <p className="mb-1 text-xs text-neutral-500">Required Threshold</p>
                    <p className="text-lg font-semibold text-neutral-900">{requiredApprovals}</p>
                    <p className="text-xs text-neutral-600">{isEmergency ? "75% majority" : "62.5% majority"}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {!executed && (
                <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
                  {!thresholdReached && !hasApproved && (
                    <Button
                      size="md"
                      variant="primary"
                      disabled={!canApprove}
                      onClick={onApprove}
                      isLoading={isApproveLoading}
                      className="w-full"
                    >
                      {canApprove ? "Approve Proposal" : "Unable to Approve"}
                    </Button>
                  )}

                  {thresholdReached && (
                    <Button
                      size="md"
                      variant="success"
                      disabled={!canExecute}
                      onClick={onExecute}
                      isLoading={isExecuteLoading}
                      className="w-full"
                    >
                      {isEmergency ? "Execute Proposal" : "Send to Optimistic Approval"}
                    </Button>
                  )}

                  {hasApproved && !thresholdReached && (
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
                      <Icon icon={IconType.CHECKMARK} size="sm" className="text-success-600" />
                      <span>You have already approved this proposal</span>
                    </div>
                  )}

                  {!canApprove && !hasApproved && !thresholdReached && (
                    <p className="text-xs text-neutral-500">Only Security Council members can approve proposals</p>
                  )}
                </div>
              )}

              {/* Info message */}
              <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                <p className="text-xs text-primary-800">
                  {isEmergency ? (
                    <>
                      <strong>Emergency proposals</strong> require approval from 6 or 75% of Security Council members
                      and are executed directly by the DAO upon approval.
                    </>
                  ) : (
                    <>
                      <strong>Standard proposals</strong> require approval from 5 or 62.5% of Security Council members
                      before being sent to the optimistic approval stage.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="votes">
          <div className="p-6 pt-4">
            <VotesDataList votes={votes} />
          </div>
        </Tabs.Content>

        <Tabs.Content value="details">
          <div className="p-6 pt-4">
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-neutral-500">Voting Strategy</dt>
                <dd className="font-medium text-sm text-neutral-800">Security Council Approval</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Required Approvals</dt>
                <dd className="font-medium text-sm text-neutral-800">
                  {requiredApprovals} out of {isEmergency ? 8 : 8} members ({isEmergency ? "75%" : "62.5%"})
                </dd>
              </div>
              {snapshotBlock && (
                <div>
                  <dt className="text-sm text-neutral-500">Snapshot Block</dt>
                  <dd className="font-medium text-sm text-neutral-800">#{snapshotBlock}</dd>
                </div>
              )}
              {expirationDate && (
                <div>
                  <dt className="text-sm text-neutral-500">Expiration</dt>
                  <dd className="font-medium text-sm text-neutral-800">
                    {dayjs(expirationDate).format("MMM D, YYYY HH:mm")}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-neutral-500">Proposal Type</dt>
                <dd className="font-medium text-sm text-neutral-800">
                  {isEmergency ? "Emergency Proposal" : "Standard Proposal"}
                </dd>
              </div>
              {executed && executedAt && (
                <div>
                  <dt className="text-sm text-neutral-500">Executed</dt>
                  <dd className="font-medium text-sm text-neutral-800">
                    {dayjs(executedAt).format("MMM D, YYYY HH:mm")}
                  </dd>
                </div>
              )}
              {executed && executionTxHash && (
                <div>
                  <dt className="text-sm text-neutral-500">Execution Transaction</dt>
                  <dd className="font-medium text-sm text-neutral-800">
                    <Link
                      href={`${PUB_CHAIN.blockExplorers?.default.url}/tx/${executionTxHash}`}
                      target="_blank"
                      variant="primary"
                      iconRight={IconType.LINK_EXTERNAL}
                    >
                      View on explorer
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </Tabs.Content>
      </RadixTabsRoot>
    </Card>
  );
};
