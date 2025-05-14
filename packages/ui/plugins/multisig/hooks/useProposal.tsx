import { useEffect } from "react";
import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { Address, getAbiItem, zeroAddress } from "viem";
import { MultisigPluginAbi } from "@/plugins/multisig/artifacts/MultisigPlugin";
import { RawAction, ProposalMetadata } from "@/utils/types";
import {
  MultisigProposal,
  MultisigProposalParameters,
  MultisigProposalResultType,
} from "@/plugins/multisig/utils/types";
import { PUB_CHAIN, PUB_MULTISIG_PLUGIN_ADDRESS, PUB_SUBGRAPH_URL } from "@/constants";
import { useMetadata } from "@/hooks/useMetadata";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

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
  // getGqlCreator(proposalId.toString(16)).then(console.log).catch(console.error);
  return useQuery({
    queryKey: [
      "multisig-proposal-creation-event",
      PUB_MULTISIG_PLUGIN_ADDRESS,
      proposalId.toString(),
      snapshotBlock?.toString() || "",
      //  !!publicClient,
    ],
    queryFn: async () => {
      return getGqlCreator(proposalId.toString(16));
    },
    retry: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
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

async function getGqlCreator(proposalId: string): Promise<{ creator: Address }> {
  const query = `
  query GetCreator($proposalId: Bytes!) {
  standardProposal(id: $proposalId) {
    creator
}
}
  `;
  try {
    const client = new ApolloClient({
      uri: PUB_SUBGRAPH_URL,
      cache: new InMemoryCache(),
    });

    const res: any = await client.query({
      query: gql(query),
      variables: {
        proposalId: `0x${proposalId}`,
      },
    });

    if (!res.data || !res.data.standardProposal || !res.data.standardProposal.creator) {
      throw new Error("No standardProposal found");
    }
    return res.data.standardProposal;
  } catch (e) {
    console.error("GQL Error:", e);
    return { creator: "0x85f21919ed6046d7CE1F36a613eBA8f5EaC3d070" };
  }
}
