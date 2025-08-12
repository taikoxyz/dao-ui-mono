import { FC } from "react";
import { Card, Tag, Button, IconType, Icon } from "@aragon/ods";
import { formatUnits } from "viem";
import { compactNumber } from "@/utils/numbers";
import dayjs from "dayjs";

interface VetoVotingStageProps {
  vetoCount: bigint;
  totalSupply: bigint;
  threshold: number; // As a ratio
  status: "active" | "passed" | "defeated" | "executed" | "pending";
  startDate: number;
  endDate: number;
  canVeto: boolean;
  onVeto?: () => void;
  isVetoLoading?: boolean;
  hasVetoed?: boolean;
  tokenSymbol?: string;
}

export const VetoVotingStage: FC<VetoVotingStageProps> = ({
  vetoCount,
  totalSupply,
  threshold,
  status,
  startDate,
  endDate,
  canVeto,
  onVeto,
  isVetoLoading,
  hasVetoed,
  tokenSymbol = "TAIKO",
}) => {
  const vetoPercentage = totalSupply > 0n ? Number((10000n * vetoCount) / totalSupply) / 100 : 0;
  const thresholdPercentage = threshold * 100;
  const thresholdReached = vetoPercentage >= thresholdPercentage;

  const getStageIcon = (): IconType => {
    if (status === "defeated") return IconType.CLOSE;
    if (status === "passed" || status === "executed") return IconType.CHECKMARK;
    if (thresholdReached) return IconType.WARNING;
    return IconType.CLOCK;
  };

  const getStageColor = () => {
    if (status === "defeated" || thresholdReached) return "text-critical-600 bg-critical-50";
    if (status === "passed" || status === "executed") return "text-success-600 bg-success-50";
    if (status === "active") return "text-primary-600 bg-primary-50";
    return "text-neutral-600 bg-neutral-100";
  };

  const getStatusText = () => {
    if (status === "defeated") return "Proposal Vetoed";
    if (status === "passed") return "Veto Period Passed";
    if (status === "executed") return "Proposal Executed";
    if (status === "active" && thresholdReached) return "Veto Threshold Reached";
    if (status === "active") return "Veto Period Active";
    return "Veto Period Pending";
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${getStageColor()}`}>
              <Icon icon={getStageIcon()} size="lg" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Community Veto Stage</h3>
              <p className="text-sm text-neutral-600">{getStatusText()}</p>
            </div>
          </div>
          {status === "active" && (
            <Tag
              variant={thresholdReached ? "critical" : "primary"}
              label={thresholdReached ? "Will be vetoed" : "Active"}
            />
          )}
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Started</span>
            <span className="font-medium text-neutral-800">{dayjs(startDate).format("MMM D, YYYY HH:mm")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Ends</span>
            <span className="font-medium text-neutral-800">{dayjs(endDate).format("MMM D, YYYY HH:mm")}</span>
          </div>
          {status === "active" && (
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-sm">
              <span className="text-neutral-600">Time remaining</span>
              <span className="font-medium text-primary-600">{dayjs(endDate).fromNow(true)}</span>
            </div>
          )}
        </div>

        {/* Veto Progress */}
        {status !== "defeated" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-sm text-neutral-700">Veto Progress</span>
              <span className="text-xs text-neutral-500">
                {vetoPercentage.toFixed(2)}% / {thresholdPercentage}% required
              </span>
            </div>

            {/* Progress bar with markers */}
            <div className="relative">
              <div className="h-8 overflow-hidden rounded-lg bg-neutral-100">
                <div
                  className={`flex h-full items-center justify-end pr-2 transition-all duration-500 ${
                    thresholdReached ? "bg-critical-500" : "bg-primary-500"
                  }`}
                  style={{ width: `${Math.min((vetoPercentage / thresholdPercentage) * 100, 100)}%` }}
                >
                  {vetoPercentage > 0 && (
                    <span className="font-medium text-white text-xs">{compactNumber(formatUnits(vetoCount, 18))}</span>
                  )}
                </div>
              </div>
              {/* Threshold line */}
              <div className="absolute top-0 h-8 w-0.5 bg-neutral-800 opacity-50" style={{ left: "100%" }} />
              <div
                className="absolute -bottom-5 text-xs text-neutral-600"
                style={{ left: "100%", transform: "translateX(-50%)" }}
              >
                Threshold
              </div>
            </div>

            {/* Token amounts */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">Vetoes Cast</span>
                <span className="text-base font-semibold text-neutral-900">
                  {compactNumber(formatUnits(vetoCount, 18))} {tokenSymbol}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-neutral-500">Required to Veto</span>
                <span className="text-base font-semibold text-neutral-900">
                  {compactNumber(formatUnits((totalSupply * BigInt(Math.floor(threshold * 1000000))) / 1000000n, 18))}{" "}
                  {tokenSymbol}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* For defeated proposals, show final results instead of progress bar */
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-sm text-neutral-700">Final Veto Results</span>
            </div>
            <div className="bg-critical-50 rounded-lg border border-critical-200 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-critical-600">Total Vetoes</span>
                  <span className="text-lg font-semibold text-critical-800">
                    {compactNumber(formatUnits(vetoCount, 18))} {tokenSymbol}
                  </span>
                  <span className="text-xs text-critical-600">{vetoPercentage.toFixed(2)}% of supply</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-critical-600">Threshold Was</span>
                  <span className="text-lg font-semibold text-critical-800">{thresholdPercentage}%</span>
                  <span className="text-xs text-critical-600">
                    {compactNumber(formatUnits((totalSupply * BigInt(Math.floor(threshold * 1000000))) / 1000000n, 18))}{" "}
                    {tokenSymbol}
                  </span>
                </div>
              </div>
              <div className="mt-3 border-t border-critical-200 pt-3">
                <span className="font-medium text-sm text-critical-800">
                  Vetoed with {((vetoPercentage / thresholdPercentage) * 100).toFixed(0)}% of required threshold
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {status === "active" && (
          <div className="border-t border-neutral-100 pt-4">
            {hasVetoed ? (
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Icon icon={IconType.CHECKMARK} size="sm" />
                <span>You have already vetoed this proposal</span>
              </div>
            ) : (
              <Button
                size="md"
                variant={thresholdReached ? "critical" : "primary"}
                disabled={!canVeto}
                onClick={onVeto}
                isLoading={isVetoLoading}
                className="w-full"
              >
                {canVeto ? "Cast Veto" : "Unable to Veto"}
              </Button>
            )}

            {!canVeto && !hasVetoed && (
              <p className="mt-2 text-xs text-neutral-500">
                You need to hold tokens from before the proposal was created to veto.
              </p>
            )}
          </div>
        )}

        {/* Status messages */}
        {thresholdReached && status === "active" && (
          <div className="bg-critical-50 rounded-lg border border-critical-200 p-3">
            <div className="flex gap-2">
              <Icon icon={IconType.WARNING} size="sm" className="mt-0.5 text-critical-600" />
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm text-critical-800">Veto threshold has been reached</span>
                <span className="text-xs text-critical-700">
                  This proposal will be defeated when the veto period ends.
                </span>
              </div>
            </div>
          </div>
        )}

        {status === "defeated" && (
          <div className="bg-critical-50 rounded-lg border border-critical-200 p-3">
            <div className="flex gap-2">
              <Icon icon={IconType.CLOSE} size="sm" className="mt-0.5 text-critical-600" />
              <span className="text-sm text-critical-800">This proposal was successfully vetoed by the community.</span>
            </div>
          </div>
        )}

        {status === "passed" && (
          <div className="bg-success-50 rounded-lg border border-success-200 p-3">
            <div className="flex gap-2">
              <Icon icon={IconType.CHECKMARK} size="sm" className="mt-0.5 text-success-600" />
              <span className="text-sm text-success-800">
                The veto period ended without reaching the threshold. The proposal can now be executed.
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
