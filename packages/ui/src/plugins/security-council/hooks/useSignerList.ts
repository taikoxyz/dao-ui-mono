import { useConfig } from "wagmi";
import { SignerListAbi } from "../artifacts/SignerList";
import { PUB_SIGNER_LIST_CONTRACT_ADDRESS } from "@/constants";
import { Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Config, readContract } from "@wagmi/core";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { PUB_SUBGRAPH_URL } from "@/constants";

export function useSignerList() {
  return useQuery({
    queryKey: ["signer-list-fetch", PUB_SIGNER_LIST_CONTRACT_ADDRESS],
    queryFn: () => {
      return getGqlSigners();
    },
    // Bounded: getGqlSigners rethrows, so an unreachable subgraph must surface as
    // an error state rather than retrying forever.
    retry: 2,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retryOnMount: true,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Council size read from the chain, not the subgraph.
 *
 * When a block number is given, the size is resolved *at that block* — a
 * proposal's threshold was set against the council as it existed at its
 * snapshot, so describing it with today's membership would be wrong.
 */
export function useSignerListLength(blockNumber?: bigint) {
  const config = useConfig() as Config;

  return useQuery({
    queryKey: ["signer-list-length", PUB_SIGNER_LIST_CONTRACT_ADDRESS, blockNumber?.toString() ?? "latest"],
    queryFn: () =>
      blockNumber
        ? readContract(config, {
            abi: SignerListAbi,
            address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
            functionName: "addresslistLengthAtBlock",
            args: [blockNumber],
          })
        : readContract(config, {
            abi: SignerListAbi,
            address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
            functionName: "addresslistLength",
          }),
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });
}

export function useApproverWalletList() {
  const config = useConfig() as Config;

  return useQuery({
    queryKey: ["encryption-registry-recipients-fetch", PUB_SIGNER_LIST_CONTRACT_ADDRESS],
    queryFn: () =>
      readContract(config, {
        abi: SignerListAbi,
        address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
        functionName: "getEncryptionAgents",
      }),
    retry: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retryOnMount: true,
    staleTime: 1000 * 60 * 5,
  });
}

async function getGqlSigners(): Promise<Address[]> {
  const query = `
  query GetSigners {
  signers {
    id
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
    });

    // An empty result is a valid "no signers" state.
    if (!res?.data?.signers) {
      return [];
    }

    return res.data.signers.map((s: any) => s.id);
  } catch (e) {
    // Rethrow: swallowing this into [] made an unreachable subgraph
    // indistinguishable from an empty council, which let callers render an
    // approver subset as if it were the full roster.
    console.error("GQL Error:", e);
    throw e;
  }
}
