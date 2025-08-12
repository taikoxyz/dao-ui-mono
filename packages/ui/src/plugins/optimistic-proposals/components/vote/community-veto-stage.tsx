import { FC } from "react";
import { Card, Tag, Button, Icon, IconType, Tabs } from "@aragon/ods";
import { Tabs as RadixTabsRoot } from "@radix-ui/react-tabs";
import { formatUnits } from "viem";
import { compactNumber } from "@/utils/numbers";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { VotesDataList } from "@/components/proposalVoting/votesDataList/votesDataList";
import type { IVote } from "@/utils/types";

dayjs.extend(relativeTime);

interface CommunityVetoStageProps {
  vetoCount: bigint;
  totalSupply: bigint;
  threshold: number;
  status: 'active' | 'passed' | 'defeated' | 'executed' | 'pending';
  startDate?: number;
  endDate?: number;
  canVeto?: boolean;
  onVeto?: () => void;
  isVetoLoading?: boolean;
  hasVetoed?: boolean;
  tokenSymbol?: string;
  votes?: IVote[];
  snapshotBlock?: number;
}

export const CommunityVetoStage: FC<CommunityVetoStageProps> = ({
  vetoCount,
  totalSupply,
  threshold,
  status,
  startDate,
  endDate,
  canVeto = false,
  onVeto,
  isVetoLoading = false,
  hasVetoed = false,
  tokenSymbol = "TAIKO",
  votes = [],
  snapshotBlock,
}) => {
  const vetoPercentage = totalSupply > 0n 
    ? Number((10000n * vetoCount) / totalSupply) / 100 
    : 0;
  const thresholdPercentage = threshold * 100;
  const thresholdReached = vetoPercentage >= thresholdPercentage;
  const progressPercentage = Math.min((vetoPercentage / thresholdPercentage) * 100, 100);
  
  const now = Date.now();
  const timeRemaining = endDate && status === 'active' ? endDate - now : 0;
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const getStatusIcon = () => {
    if (status === 'defeated' || thresholdReached) return <Icon icon={IconType.CLOSE} size="md" className="text-critical-600" />;
    if (status === 'passed' || status === 'executed') return <Icon icon={IconType.CHECKMARK} size="md" className="text-success-600" />;
    if (status === 'active') return <Icon icon={IconType.CLOCK} size="md" className="text-primary-600" />;
    return <Icon icon={IconType.CLOCK} size="md" className="text-neutral-400" />;
  };

  const getStatusTag = () => {
    if (status === 'defeated') return <Tag variant="critical" label="Vetoed" />;
    if (status === 'passed') return <Tag variant="success" label="Passed" />;
    if (status === 'executed') return <Tag variant="neutral" label="Executed" />;
    if (status === 'active' && thresholdReached) return <Tag variant="critical" label="Will be vetoed" />;
    if (status === 'active') return <Tag variant="primary" label="Active" />;
    return <Tag variant="neutral" label="Pending" />;
  };

  return (
    <Card className="overflow-hidden">
      {/* Header with clear distinction */}
      <div className="bg-critical-50 border-b border-critical-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Community Veto Period</h3>
              <p className="text-sm text-neutral-600">
                Token holders can veto this proposal
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
          <Tabs.Trigger value="votes" label={`Votes (${votes.length})`} />
          <Tabs.Trigger value="details" label="Details" />
        </Tabs.List>

        <Tabs.Content value="overview">
          <div className="p-6 pt-4">
            <div className="flex flex-col gap-4">
              {/* Status message */}
              <div className="flex items-start gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-800">
                    {status === 'defeated' && 'Community successfully vetoed this proposal'}
                    {status === 'passed' && 'Veto period ended without reaching threshold'}
                    {status === 'executed' && 'Proposal has been executed'}
                    {status === 'active' && thresholdReached && 'Veto threshold reached - proposal will be defeated'}
                    {status === 'active' && !thresholdReached && `${(thresholdPercentage - vetoPercentage).toFixed(2)}% more vetoes needed`}
                    {status === 'pending' && 'Veto period has not started yet'}
                  </p>
                  {status === 'active' && timeRemaining > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {daysRemaining > 0 
                        ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} ${hoursRemaining}h remaining`
                        : `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} remaining`
                      }
                    </p>
                  )}
                </div>
              </div>

              {/* Progress visualization */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-neutral-700">Veto Progress</span>
                  <span className="text-xs text-neutral-500">
                    {vetoPercentage.toFixed(2)}% of token supply
                  </span>
                </div>
                
                {/* Enhanced progress bar */}
                <div className="flex flex-col gap-2">
                  <div className="h-8 bg-neutral-100 rounded-lg overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        thresholdReached ? 'bg-critical-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  
                  {/* Progress legend */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded ${thresholdReached ? 'bg-critical-500' : 'bg-primary-500'}`} />
                        <span className="text-neutral-600">
                          Current: {vetoPercentage.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded border-2 border-neutral-400 bg-white" />
                        <span className="text-neutral-600">
                          Threshold: {thresholdPercentage}%
                        </span>
                      </div>
                    </div>
                    <span className="font-medium text-neutral-800">
                      {progressPercentage.toFixed(1)}% of threshold reached
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Current Vetoes</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      {compactNumber(formatUnits(vetoCount, 18))}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {tokenSymbol}
                    </p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Required to Veto</p>
                    <p className="text-lg font-semibold text-neutral-900">
                      {compactNumber(formatUnits((totalSupply * BigInt(Math.floor(threshold * 1000000))) / 1000000n, 18))}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {tokenSymbol} ({thresholdPercentage}%)
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {(startDate || endDate) && (
                <div className="border-t border-neutral-100 pt-4">
                  <div className="flex justify-between text-sm">
                    {startDate && (
                      <div>
                        <span className="text-neutral-500">Started: </span>
                        <span className="font-medium text-neutral-800">
                          {dayjs(startDate).format('MMM D, HH:mm')}
                        </span>
                      </div>
                    )}
                    {endDate && (
                      <div>
                        <span className="text-neutral-500">Ends: </span>
                        <span className="font-medium text-neutral-800">
                          {dayjs(endDate).format('MMM D, HH:mm')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action button */}
              {status === 'active' && (
                <div className="border-t border-neutral-100 pt-4">
                  {hasVetoed ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg">
                      <Icon icon={IconType.CHECKMARK} size="sm" className="text-success-600" />
                      <span>You have already vetoed this proposal</span>
                    </div>
                  ) : (
                    <>
                      <Button
                        size="md"
                        variant={thresholdReached ? "critical" : "primary"}
                        disabled={!canVeto}
                        onClick={onVeto}
                        isLoading={isVetoLoading}
                        className="w-full"
                      >
                        {canVeto ? 'Cast Veto' : 'Unable to Veto'}
                      </Button>
                      {!canVeto && (
                        <p className="text-xs text-neutral-500 mt-2">
                          You need tokens from before the proposal creation to veto
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Alerts */}
              {thresholdReached && status === 'active' && (
                <div className="p-3 bg-critical-50 border border-critical-200 rounded-lg flex gap-2">
                  <Icon icon={IconType.WARNING} size="md" className="text-critical-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-critical-800">Veto threshold reached</p>
                    <p className="text-xs text-critical-700 mt-1">
                      This proposal will be defeated when the veto period ends.
                    </p>
                  </div>
                </div>
              )}
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
                <dd className="text-sm font-medium text-neutral-800">Token-based veto voting</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Veto Threshold</dt>
                <dd className="text-sm font-medium text-neutral-800">{thresholdPercentage}% of token supply</dd>
              </div>
              {snapshotBlock && (
                <div>
                  <dt className="text-sm text-neutral-500">Snapshot Block</dt>
                  <dd className="text-sm font-medium text-neutral-800">#{snapshotBlock}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-neutral-500">Duration</dt>
                <dd className="text-sm font-medium text-neutral-800">21 days</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Token</dt>
                <dd className="text-sm font-medium text-neutral-800">{tokenSymbol}</dd>
              </div>
            </dl>
          </div>
        </Tabs.Content>
      </RadixTabsRoot>
    </Card>
  );
};