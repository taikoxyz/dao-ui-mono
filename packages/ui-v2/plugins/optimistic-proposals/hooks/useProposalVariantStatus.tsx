import { useState, useEffect } from "react";
import { OptimisticProposal } from "@/plugins/optimistic-proposals/utils/types";
import { ProposalStatus } from "@aragon/ods";
import { useToken } from "./useToken";
import { PUB_TAIKO_BRIDGE_ADDRESS } from "@/constants";
import { useTokenPastVotes } from "./useTokenPastVotes";
import { useGovernanceSettings } from "./useGovernanceSettings";

export const useProposalVariantStatus = (proposal: OptimisticProposal) => {
  const [status, setStatus] = useState({ variant: "", label: "" });
  const { tokenSupply: totalSupply } = useToken();
  const { votes: bridgedBalance } = useTokenPastVotes(
    PUB_TAIKO_BRIDGE_ADDRESS,
    proposal?.parameters.snapshotTimestamp || BigInt(0)
  );

  useEffect(() => {
    if (!proposal || !proposal?.parameters || !totalSupply || typeof bridgedBalance === "undefined") return;

    const effectiveSupply = proposal.parameters.unavailableL2 ? totalSupply - bridgedBalance : totalSupply;
    const minVetoVotingPower = (effectiveSupply * BigInt(proposal.parameters.minVetoRatio)) / BigInt(1_000_000);

    setStatus(
      proposal?.vetoTally >= minVetoVotingPower
        ? { variant: "critical", label: "Defeated" }
        : proposal?.active
          ? { variant: "info", label: "Active" }
          : proposal?.executed
            ? { variant: "primary", label: "Executed" }
            : { variant: "success", label: "Executable" }
    );
  }, [
    proposal?.vetoTally,
    proposal?.active,
    proposal?.executed,
    proposal?.parameters?.minVetoRatio,
    totalSupply,
    bridgedBalance,
  ]);

  return status;
};

export const useProposalStatus = (proposal: OptimisticProposal | null) => {
  const [status, setStatus] = useState<ProposalStatus>();
  const { tokenSupply: totalSupply } = useToken();
  const { governanceSettings } = useGovernanceSettings();
  const { votes: bridgedBalance } = useTokenPastVotes(
    PUB_TAIKO_BRIDGE_ADDRESS,
    proposal?.parameters.snapshotTimestamp || BigInt(0)
  );

  useEffect(() => {
    if (!proposal || !proposal?.parameters || !totalSupply || typeof bridgedBalance === "undefined") return;

    const effectiveSupply = proposal.parameters.unavailableL2 ? totalSupply - bridgedBalance : totalSupply;
    const minVetoVotingPower = (effectiveSupply * BigInt(proposal.parameters.minVetoRatio)) / BigInt(1_000_000);

    setStatus(
      proposal?.vetoTally >= minVetoVotingPower
        ? ProposalStatus.VETOED
        : proposal?.active
          ? ProposalStatus.ACTIVE
          : proposal?.executed
            ? ProposalStatus.EXECUTED
            : ProposalStatus.ACCEPTED
    );
  }, [
    proposal?.vetoTally,
    proposal?.active,
    proposal?.executed,
    proposal?.parameters?.minVetoRatio,
    totalSupply,
    bridgedBalance,
  ]);

  const isEmergency = !!proposal && proposal.parameters.vetoStartDate === proposal.parameters.vetoEndDate;
  const isPastEndDate = !!proposal && proposal.parameters.vetoEndDate * 1000n < Date.now();

  let isL2GracePeriod = false;
  let isTimelockPeriod = false;
  let l2GracePeriodEnd = 0n;
  let timelockPeriodEnd = 0n;

  if (!isEmergency && status === ProposalStatus.ACCEPTED) {
    let l2AggregationGracePeriod = 0;
    let timelockPeriod = 0;

    if (!!proposal && !proposal.parameters.unavailableL2 && governanceSettings.l2AggregationGracePeriod) {
      l2AggregationGracePeriod = governanceSettings.l2AggregationGracePeriod;
    }
    if (governanceSettings.timelockPeriod) {
      timelockPeriod = governanceSettings.timelockPeriod;
    }

    if (!!proposal) {
      l2GracePeriodEnd = (proposal.parameters.vetoEndDate + BigInt(l2AggregationGracePeriod)) * 1000n;
      timelockPeriodEnd = l2GracePeriodEnd + BigInt(timelockPeriod) * 1000n;

      if (isPastEndDate) {
        if (proposal.parameters.vetoEndDate * 1000n <= Date.now() && Date.now() < l2GracePeriodEnd) {
          isL2GracePeriod = true;
        } else if (l2GracePeriodEnd <= Date.now() && Date.now() < timelockPeriodEnd) {
          isTimelockPeriod = true;
        }
      }
    }
  }

  return {
    status,
    isEmergency,
    isL2GracePeriod,
    isTimelockPeriod,
    isPastEndDate,
    l2GracePeriodEnd,
    timelockPeriodEnd,
  };
};
