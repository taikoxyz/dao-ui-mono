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
    retry: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retryOnMount: true,
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

    if (!res.data || !res.data.signers) {
      return [];
    }

    return res.data.signers.map((s: any) => s.id);
  } catch (e) {
    console.error("GQL Error:", e);
    return [];
  }
}
