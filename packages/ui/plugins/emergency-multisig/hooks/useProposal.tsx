import { useEffect } from "react";
import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { getAbiItem } from "viem";
import { EmergencyMultisigPluginAbi } from "@/plugins/emergency-multisig/artifacts/EmergencyMultisigPlugin";
import { RawAction, ProposalMetadata } from "@/utils/types";
import {
  EncryptedProposalMetadata,
  EmergencyProposal,
  EmergencyProposalResultType,
} from "@/plugins/emergency-multisig/utils/types";
import { PUB_CHAIN, PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { useDecryptedData } from "./useDecryptedData";
import { useIpfsJsonData } from "@/hooks/useMetadata";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";

const ProposalCreatedEvent = getAbiItem({
  abi: EmergencyMultisigPluginAbi,
  name: "EmergencyProposalCreated",
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
    address: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
    abi: EmergencyMultisigPluginAbi,
    functionName: "getProposal",
    args: [BigInt(proposalId)],
    chainId: PUB_CHAIN.id,
  });
  const { data: proposalCreationEvent, isLoading: isLoadingEvent } = useProposalCreationEvent(
    BigInt(proposalId),
    proposalResult?.[2].snapshotBlock
  );

  const proposalData = decodeProposalResultData(proposalResult);

  useEffect(() => {
    if (autoRefresh) proposalRefetch();
  }, [blockNumber]);

  // JSON data
  const {
    data: encryptedProposalData,
    isLoading: metadataLoading,
    error: metadataError,
  } = useIpfsJsonData<EncryptedProposalMetadata>(proposalData?.encryptedPayloadUri);

  // Decrypt metadata and actions
  const { privateActions, privateMetadata, raw: rawPrivateData } = useDecryptedData(encryptedProposalData);

  const proposal = arrangeProposalData(
    proposalData,
    (privateActions || undefined) as any,
    proposalCreationEvent,
    privateMetadata || undefined
  );

  return {
    proposal,
    rawPrivateData,
    refetch: proposalRefetch,
    status: {
      proposalReady: proposalFetchStatus === "idle",
      proposalLoading: proposalFetchStatus === "fetching",
      proposalError,
      metadataReady: !metadataError && !metadataLoading && !!privateMetadata,
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
      "emergency-proposal-creation-event",
      PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
      proposalId.toString(),
      snapshotBlock?.toString() || "",
      !!publicClient,
    ],
    queryFn: () => {
      if (!snapshotBlock || !publicClient) throw new Error("Not ready");

      return getLogsUntilNow(
        PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
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

function decodeProposalResultData(data?: EmergencyProposalResultType) {
  if (!data?.length) return null;

  return {
    executed: data[0],
    approvals: data[1],
    parameters: data[2],
    encryptedPayloadUri: data[3],
    publicMetadataUriHash: data[4],
    destActionsHash: data[5],
    destinationPlugin: data[6],
  };
}

function arrangeProposalData(
  proposalData?: ReturnType<typeof decodeProposalResultData>,
  actions?: RawAction[],
  creationEvent?: ReturnType<typeof useProposalCreationEvent>["data"],
  metadata?: ProposalMetadata
): EmergencyProposal | null {
  if (!proposalData) return null;

  return {
    actions: actions ?? [],
    executed: proposalData.executed,
    parameters: {
      snapshotBlock: proposalData.parameters.snapshotBlock,
      expirationDate: proposalData.parameters.expirationDate,
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
