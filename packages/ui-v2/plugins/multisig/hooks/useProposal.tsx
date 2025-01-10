import { useEffect } from "react";
import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { getAbiItem } from "viem";
import { MultisigPluginAbi } from "@/plugins/multisig/artifacts/MultisigPlugin";
import { RawAction, ProposalMetadata } from "@/utils/types";
import {
  MultisigProposal,
  MultisigProposalParameters,
  MultisigProposalResultType,
} from "@/plugins/multisig/utils/types";
import { PUB_CHAIN, PUB_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { useMetadata } from "@/hooks/useMetadata";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";

const ProposalCreatedEvent = getAbiItem({
  abi: MultisigPluginAbi,
  name: "ProposalCreated",
});

export function useProposal(proposalId: string, autoRefresh = false) {
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // Proposal onchain data
  const {
    data: proposalResult,
    error: proposalError,
    fetchStatus: proposalFetchStatus,
    refetch: proposalRefetch,
  } = useReadContract({
    address: PUB_MULTISIG_PLUGIN_ADDRESS,
    abi: MultisigPluginAbi,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
    chainId: PUB_CHAIN.id,
  });
  const { data: proposalCreationEvent } = useProposalCreationEvent(
    BigInt(proposalId),
    proposalResult?.[2]?.snapshotBlock
  );

  const proposalData = decodeProposalResultData(proposalResult);

  useEffect(() => {
    if (autoRefresh) proposalRefetch();
  }, [blockNumber]);

  // JSON metadata
  const {
    data: metadataContent,
    isLoading: metadataLoading,
    error: metadataError,
  } = useMetadata<ProposalMetadata>(proposalData?.metadataUri);

  const proposal = arrangeProposalData(proposalData, proposalCreationEvent, metadataContent);

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

function useProposalCreationEvent(proposalId: bigint, snapshotBlock: bigint | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: [
      "multisig-proposal-creation-event",
      PUB_MULTISIG_PLUGIN_ADDRESS,
      proposalId.toString(),
      snapshotBlock?.toString() || "",
      !!publicClient,
    ],
    queryFn: () => {
      if (!snapshotBlock || !publicClient) throw new Error("Not ready");

      return getLogsUntilNow(
        PUB_MULTISIG_PLUGIN_ADDRESS,
        ProposalCreatedEvent,
        {
          proposalId: BigInt(proposalId),
        },
        publicClient,
        snapshotBlock
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

function decodeProposalResultData(data?: MultisigProposalResultType) {
  if (!data?.length) return null;

  return {
    executed: data[0] as boolean,
    approvals: data[1] as number,
    parameters: data[2] as MultisigProposalParameters,
    metadataUri: data[3] as string,
    actions: data[4] as Array<RawAction>,
  };
}

function arrangeProposalData(
  proposalData?: ReturnType<typeof decodeProposalResultData>,
  creationEvent?: ReturnType<typeof useProposalCreationEvent>["data"],
  metadata?: ProposalMetadata
): MultisigProposal | null {
  if (!proposalData) return null;

  return {
    actions: proposalData.actions,
    executed: proposalData.executed,
    parameters: {
      expirationDate: proposalData.parameters.expirationDate,
      snapshotBlock: proposalData.parameters.snapshotBlock,
      minApprovals: proposalData.parameters.minApprovals,
    },
    approvals: proposalData.approvals,
    allowFailureMap: BigInt(0),
    creator: creationEvent?.creator || "",
    title: metadata?.title || "",
    summary: metadata?.summary || "",
    description: metadata?.description || "",
    resources: metadata?.resources || [],
  };
}
