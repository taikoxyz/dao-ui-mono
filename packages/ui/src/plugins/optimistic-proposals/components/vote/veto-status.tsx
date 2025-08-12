import { FC } from "react";
import { Tag, AlertInline } from "@aragon/ods";
import { formatUnits } from "viem";
import { compactNumber } from "@/utils/numbers";

interface VetoStatusProps {
  vetoCount: bigint;
  totalSupply: bigint;
  threshold: number; // As a ratio (e.g., 0.15 for 15%)
  status: "active" | "passed" | "defeated" | "executed" | "pending";
  endDate?: number;
}

export const VetoStatus: FC<VetoStatusProps> = ({ vetoCount, totalSupply, threshold, status, endDate }) => {
  const vetoPercentage = totalSupply > 0n ? Number((10000n * vetoCount) / totalSupply) / 100 : 0;
  const thresholdPercentage = threshold * 100;
  const progressPercentage = Math.min((vetoPercentage / thresholdPercentage) * 100, 100);
  const thresholdReached = vetoPercentage >= thresholdPercentage;

  // Calculate time remaining
  const now = Date.now();
  const timeRemaining = endDate && status === "active" ? endDate - now : 0;
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const getStatusTag = () => {
    switch (status) {
      case "active":
        return thresholdReached ? (
          <Tag variant="critical" label="Will be vetoed" />
        ) : (
          <Tag variant="primary" label="Veto period active" />
        );
      case "defeated":
        return <Tag variant="critical" label="Vetoed" />;
      case "passed":
        return <Tag variant="success" label="Passed" />;
      case "executed":
        return <Tag variant="neutral" label="Executed" />;
      default:
        return <Tag variant="neutral" label="Pending" />;
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-100 bg-neutral-0 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-800">Veto Status</h3>
        {getStatusTag()}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Current Vetoes</span>
          <span className="text-xl font-semibold text-neutral-900">{compactNumber(formatUnits(vetoCount, 18))}</span>
          <span className="text-sm text-neutral-600">{vetoPercentage.toFixed(2)}% of supply</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm text-neutral-500">Required Threshold</span>
          <span className="text-xl font-semibold text-neutral-900">{thresholdPercentage}%</span>
          <span className="text-sm text-neutral-600">
            {compactNumber(formatUnits((totalSupply * BigInt(Math.floor(threshold * 1000000))) / 1000000n, 18))} tokens
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`absolute h-full transition-all duration-500 ${
              thresholdReached ? "bg-critical-500" : "bg-primary-500"
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
          {/* Threshold marker */}
          <div className="absolute top-0 h-full w-0.5 bg-neutral-800" style={{ left: "100%" }} />
        </div>
        <div className="flex justify-between text-xs text-neutral-600">
          <span>0%</span>
          <span className="font-medium">{progressPercentage.toFixed(1)}% of threshold</span>
          <span>{thresholdPercentage}%</span>
        </div>
      </div>

      {/* Time remaining (if active) */}
      {status === "active" && timeRemaining > 0 && (
        <div className="border-t border-neutral-100 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">Time remaining</span>
            <span className="font-medium text-sm text-neutral-800">
              {daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} ${hoursRemaining}h`
                : `${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      )}

      {/* Alert if threshold reached */}
      {thresholdReached && status === "active" && (
        <div className="bg-critical-50 rounded-lg border border-critical-200 p-3">
          <AlertInline
            message="⚠️ Veto threshold reached - This proposal will be defeated when the veto period ends."
            variant="critical"
          />
        </div>
      )}

      {/* Info message */}
      {!thresholdReached && status === "active" && (
        <div className="rounded-lg bg-primary-50 p-3 text-sm text-neutral-600">
          <span className="font-medium">{(thresholdPercentage - vetoPercentage).toFixed(2)}%</span> more vetoes needed
          to defeat this proposal
        </div>
      )}
    </div>
  );
};
