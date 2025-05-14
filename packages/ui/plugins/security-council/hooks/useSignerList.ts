import { useConfig, usePublicClient } from "wagmi";
import { SignerListAbi } from "../artifacts/SignerList";
import { PUB_SIGNER_LIST_CONTRACT_ADDRESS } from "@/constants";
import { Address, getAbiItem, GetLogsReturnType } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Config, readContract } from "@wagmi/core";
import { getLogsUntilNow } from "@/utils/evm";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { PUB_SUBGRAPH_URL } from "@/constants";

const SignersAddedEvent = getAbiItem({
  abi: SignerListAbi,
  name: "SignersAdded",
});
const SignersRemovedEvent = getAbiItem({
  abi: SignerListAbi,
  name: "SignersRemoved",
});

export function useSignerList() {
  console.log('calling useSignerList')
  const getSigners = async () => {
    return await getGqlSigners();
  };
/*
    const publicClient = usePublicClient();
  
    const getSigners = () => {
      if (!publicClient) {
        throw new Error("No public client");
      }
  
      const addedProm = getLogsUntilNow(PUB_SIGNER_LIST_CONTRACT_ADDRESS, SignersAddedEvent, {}, publicClient);
      const removedProm = getLogsUntilNow(PUB_SIGNER_LIST_CONTRACT_ADDRESS, SignersRemovedEvent, {}, publicClient);
  
      return Promise.all([addedProm, removedProm]).then(([addedLogs, removedLogs]) => {
        return computeCurrentSignerList(addedLogs, removedLogs);
      });
    }

*/

/*

  const getSigners = async () => {
    return await getGqlSigners();
  };*/

  return useQuery({
    queryKey: ["signer-list-fetch", PUB_SIGNER_LIST_CONTRACT_ADDRESS],
    queryFn: () => getSigners(),
    retry: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
    refetchOnMount: false,
    refetchOnReconnect: false,
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

    return res.data.signers.map((s:any) => s.id);
  } catch (e) {
    console.error("GQL Error:", e);
    return []
  }
}

type SignerAddRemoveItem = {
  blockNumber: bigint;
  added: Address[];
  removed: Address[];
};

function computeCurrentSignerList(
  addedLogs: GetLogsReturnType<typeof SignersAddedEvent>,
  removedLogs: GetLogsReturnType<typeof SignersRemovedEvent>
) {
  const merged: Array<SignerAddRemoveItem> = addedLogs
    .map((item) => ({
      blockNumber: item.blockNumber,
      added: item.args.signers || ([] as any),
      removed: [],
    }))
    .concat(
      removedLogs.map((item) => ({
        blockNumber: item.blockNumber,
        added: [],
        removed: item.args.signers || ([] as any),
      }))
    );
  }
  