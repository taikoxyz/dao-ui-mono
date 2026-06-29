import { Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { AbiFunction } from "abitype";
import { useQuery } from "@tanstack/react-query";
import { PUB_CHAIN } from "@/constants";
import { useAlerts } from "@/context/Alerts";
import { loadAbiWith, abiQueryKey } from "@/utils/decoding/abiResolver";

export const useAbi = (contractAddress: Address) => {
  const { addAlert } = useAlerts();
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });

  const { data, isLoading, error } = useQuery({
    queryKey: abiQueryKey(publicClient?.chain.id, contractAddress),
    queryFn: async () => {
      // Skip (and don't alert) for empty or still-being-typed / invalid addresses —
      // only a complete, valid address should trigger a fetch and a "Cannot fetch" alert.
      if (!contractAddress || !publicClient || !isAddress(contractAddress)) {
        return { abi: [], trust: "unknown", isProxy: false, implementation: null };
      }
      const res = await loadAbiWith(publicClient, contractAddress);
      if (!res.abi.length && res.trust === "unknown") {
        addAlert("Cannot fetch", {
          description: "The details of the contract cannot be fetched or are not publicly available",
          type: "error",
        });
      }
      return res;
    },
    retry: 6,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  const abi: AbiFunction[] = data?.abi ?? [];
  return {
    abi,
    isLoading,
    error,
    isProxy: data?.isProxy ?? false,
    implementation: data?.implementation ?? null,
  };
};
