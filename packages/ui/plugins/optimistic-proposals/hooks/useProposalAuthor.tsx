import { useEffect, useState } from "react";
import { useBlockNumber, usePublicClient, useReadContract } from "wagmi";
import { Address, fromHex, getAbiItem } from "viem";
import { ProposalMetadata, type RawAction, type DecodedAction } from "@/utils/types";
import {
  type OptimisticProposal,
  type OptimisticProposalParameters,
  type OptimisticProposalResultType,
} from "@/plugins/optimistic-proposals/utils/types";
import { PUB_CHAIN, PUB_DEPLOYMENT_BLOCK, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS, PUB_SUBGRAPH_URL } from "@/constants";
import { useMetadata } from "@/hooks/useMetadata";
import { OptimisticTokenVotingPluginAbi } from "../artifacts/OptimisticTokenVotingPlugin.sol";
import { parseProposalId } from "../utils/proposal-id";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const ProposalCreatedEvent = getAbiItem({
  abi: OptimisticTokenVotingPluginAbi,
  name: "ProposalCreated",
});
export function useProposalAuthor(proposalId?: bigint, autoRefresh = false) {
    const [creator, setCreator] = useState<Address | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
  
    const { data: blockNumber } = useBlockNumber({ watch: true });
  
    const {
      data: proposalResult,
      refetch: proposalRefetch,
    } = useReadContract({
      address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
      abi: OptimisticTokenVotingPluginAbi,
      functionName: "getProposal",
      args: [proposalId || BigInt(0)],
      chainId: PUB_CHAIN.id,
    });
  
    useEffect(() => {
      if (autoRefresh) proposalRefetch();
    }, [blockNumber]);
  
    useEffect(() => {
      if (!proposalResult) return;
  
      const fetchCreator = async () => {
        const metadata = proposalResult?.[4];
        if (!metadata) return;
  console.log(metadata)
        setLoading(true);
        setError(null);
  
        try {
          const client = new ApolloClient({
            uri: PUB_SUBGRAPH_URL,
            cache: new InMemoryCache(),
          });
  
          const query = gql`
            query GetCreator($metadata: Bytes!) {
              proposalMixin(id: $metadata) {
                creator
              }
            }
          `;
  
          const res = await client.query({
            query,
            variables: { metadata },
          });
  
          if (!res.data?.proposalMixin?.creator) {
            throw new Error("Creator not found");
          }
  
          setCreator(res.data.proposalMixin.creator);
        } catch (err: any) {
          setError(err);
          setCreator(null);
        } finally {
          setLoading(false);
        }
      };
  
      fetchCreator();
    }, [proposalResult]);
  
    return { creator, loading, error };
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
      // aapply next fix
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
