import { useEffect } from "react";
import { Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { AbiFunction } from "abitype";
import { useQuery } from "@tanstack/react-query";
import { PUB_CHAIN } from "@/constants";
import { useAlerts } from "@/context/Alerts";
import { fetchAbiResolution, abiQueryKey } from "@/utils/decoding/abiResolver";

export const useAbi = (contractAddress: Address) => {
  const { addAlert } = useAlerts();
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });

  const { data, isLoading, error } = useQuery({
    queryKey: abiQueryKey(publicClient?.chain.id, contractAddress),
    // Shared, side-effect-free queryFn (same one useActionTree uses for the app
    // chain) so this contract's ABI is cached once regardless of fetch order.
    queryFn: () => fetchAbiResolution(publicClient, contractAddress),
    retry: 6,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  // The "Cannot fetch" alert lives here, not in the queryFn, so it can't depend on
  // cache ordering between this hook and useActionTree. Only alert once the query
  // has settled on a complete, valid address with an empty/unknown resolution.
  // (addAlert dedupes by message, so a re-fire on re-render won't spam.)
  useEffect(() => {
    if (isLoading || !data) return;
    if (!contractAddress || !publicClient || !isAddress(contractAddress)) return;
    if (!data.abi.length && data.trust === "unknown") {
      addAlert("Cannot fetch", {
        description: "The details of the contract cannot be fetched or are not publicly available",
        type: "error",
      });
    }
  }, [data, isLoading, contractAddress, publicClient, addAlert]);

  const abi: AbiFunction[] = data?.abi ?? [];
  return {
    abi,
    isLoading,
    error,
    isProxy: data?.isProxy ?? false,
    implementation: data?.implementation ?? null,
  };
};
