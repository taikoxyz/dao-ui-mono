import { useEffect } from "react";
import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { fromHex, getAbiItem } from "viem";
import { ProposalMetadata, type RawAction, type DecodedAction } from "@/utils/types";
import {
  type OptimisticProposal,
  type OptimisticProposalParameters,
  type OptimisticProposalResultType,
} from "@/plugins/optimistic-proposals/utils/types";
import { PUB_CHAIN, PUB_DEPLOYMENT_BLOCK, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { useMetadata } from "@/hooks/useMetadata";
import { OptimisticTokenVotingPluginAbi } from "../artifacts/OptimisticTokenVotingPlugin.sol";
import { parseProposalId } from "../utils/proposal-id";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";

const ProposalCreatedEvent = getAbiItem({
  abi: OptimisticTokenVotingPluginAbi,
  name: "ProposalCreated",
});

export function useProposal(proposalId?: bigint, autoRefresh = false) {
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Proposal onchain data
  const {
    data: proposalResult,
    error: proposalError,
    fetchStatus: proposalFetchStatus,
    refetch: proposalRefetch,
  } = useReadContract({
    address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
    abi: OptimisticTokenVotingPluginAbi,
    functionName: "getProposal",
    args: [proposalId ?? BigInt(0)],
    chainId: PUB_CHAIN.id,
  });
  const { data: proposalCreationEvent } = useProposalCreationEvent(proposalId);

  useEffect(() => {
    if (autoRefresh) proposalRefetch();
  }, [blockNumber]);

  // JSON metadata
  const metadataUri = fromHex(proposalResult?.[4] || "0x", "string");
  const {
    data: metadataContent,
    isLoading: metadataLoading,
    error: metadataError,
  } = useMetadata<ProposalMetadata>(metadataUri);

  const proposal = arrangeProposalData(proposalId, proposalResult, proposalCreationEvent, metadataContent);

  return {
    proposal,
    refetch: proposalRefetch,
    status: {
      proposalReady: proposalFetchStatus === "idle",
      proposalLoading: proposalFetchStatus === "fetching",
      proposalError,
      metadataReady: !metadataError && !metadataLoading && !!metadataContent,
      metadataLoading,
      metadataError: metadataError !== undefined,
    },
  };
}

// Helpers

function useProposalCreationEvent(proposalId: bigint | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: [
      "optimistic-proposal-creation-event",
      PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
      proposalId?.toString() || "",
      !!publicClient,
    ],
    queryFn: () => {
      if (!publicClient || typeof proposalId === "undefined") throw new Error("Not ready");

      return getLogsUntilNow(
        PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
        ProposalCreatedEvent,
        {
          proposalId: BigInt(proposalId),
        },
        publicClient,
        PUB_DEPLOYMENT_BLOCK
      ).then((logs) => {
        if (!logs || !logs.length) throw new Error("No creation logs");

        return logs[0].args;
      });
    },
    retry: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 10,
  });
}

function decodeProposalResultData(data?: OptimisticProposalResultType) {
  if (!data?.length || data.length < 6) return null;

  return {
    active: data[0] as boolean,
    executed: data[1] as boolean,
    parameters: data[2] as OptimisticProposalParameters,
    vetoTally: data[3] as bigint,
    metadataUri: data[4] as string,
    actions: data[5] as Array<RawAction>,
    allowFailureMap: data[6] as bigint,
  };
}

function arrangeProposalData(
  proposalId?: bigint,
  proposalResult?: OptimisticProposalResultType,
  creationEvent?: ReturnType<typeof useProposalCreationEvent>["data"],
  metadata?: ProposalMetadata
): OptimisticProposal | null {
  if (!proposalResult || !proposalId) return null;

  const { index, startDate: vetoStartDate, endDate: vetoEndDate } = parseProposalId(proposalId);

  return {
    index,
    actions: proposalResult[5] as Array<RawAction>,
    active: proposalResult[0],
    executed: proposalResult[1],
    parameters: {
      minVetoRatio: proposalResult[2].minVetoRatio,
      unavailableL2: proposalResult[2].unavailableL2,
      snapshotTimestamp: proposalResult[2].snapshotTimestamp,
      vetoStartDate: BigInt(vetoStartDate),
      vetoEndDate: BigInt(vetoEndDate),
    },
    vetoTally: proposalResult[3],
    allowFailureMap: proposalResult[6],
    creator: creationEvent?.creator ?? "",
    title: metadata?.title ?? "",
    summary: metadata?.summary ?? "",
    description: metadata?.description ?? "",
    resources: metadata?.resources ?? [],
  };
}
