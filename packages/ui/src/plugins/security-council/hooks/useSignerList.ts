import { useConfig, usePublicClient } from "wagmi";
import { SignerListAbi } from "../artifacts/SignerList";
import { PUB_SIGNER_LIST_CONTRACT_ADDRESS } from "@/constants";
import { useQuery } from "@tanstack/react-query";
import { Config, readContract } from "@wagmi/core";
import { fetchSignerListFromChain } from "../utils/fetchSignerList";

/**
 * Live SignerList membership from Ethereum, not the subgraph.
 * Names still come from the JSON overlay via getSecurityCouncilProfile.
 */
export function useSignerList() {
  const publicClient = usePublicClient();
  const config = useConfig() as Config;

  return useQuery({
    queryKey: ["signer-list-fetch", PUB_SIGNER_LIST_CONTRACT_ADDRESS],
    queryFn: () => {
      if (!publicClient) {
        throw new Error("No public client");
      }
      return fetchSignerListFromChain(publicClient, config);
    },
    enabled: !!publicClient,
    retry: 2,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retryOnMount: true,
    staleTime: 1000 * 60,
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
    staleTime: 1000 * 60,
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
    staleTime: 1000 * 60,
  });
}
