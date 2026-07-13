import { useEffect } from "react";
import { Address, isAddress } from "viem";
import { usePublicClient } from "wagmi";
import { AbiFunction } from "abitype";
import { useQuery } from "@tanstack/react-query";
import { PUB_CHAIN } from "@/constants";
import { useAlerts } from "@/context/Alerts";
import { fetchAbiResolution, abiQueryKey } from "@/utils/decoding/abiResolver";

const DAY = 1000 * 60 * 60 * 24;
const CLEAN_ABI_STALE = DAY * 30;

export const useAbi = (contractAddress: Address) => {
  const { addAlert } = useAlerts();
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });

  const { data, isLoading, error } = useQuery({
    queryKey: abiQueryKey(publicClient?.chain.id, contractAddress),
    // Shared, side-effect-free queryFn (same one useActionTree uses for the app
    // chain) so this contract's ABI is cached once regardless of fetch order.
    queryFn: () => fetchAbiResolution(publicClient, contractAddress),
    retry: 6,
    retryOnMount: true,
    // A transiently-degraded resolution (Etherscan/RPC outage) is `retryable`: keep
    // it stale so a mount/reconnect/focus refetches until it recovers, instead of
    // pinning the failure as a 30-day "unknown". A clean result stays cached 30d and,
    // being fresh, is never refetched. Mirrors useActionTree's handling of the flag.
    staleTime: (query) => (query.state.data?.retryable ? 0 : CLEAN_ABI_STALE),
  });

  // The "Cannot fetch" alert lives here, not in the queryFn, so it can't depend on
  // cache ordering between this hook and useActionTree. Only alert once the query
  // has settled on a complete, valid address with an empty/unknown resolution.
  // (addAlert dedupes by message, so a re-fire on re-render won't spam.)
  useEffect(() => {
    if (isLoading || !data) return;
    if (!contractAddress || !publicClient || !isAddress(contractAddress)) return;
    // A retryable resolution is a transient outage, not a missing contract — it will
    // refetch, so don't fire the "not publicly available" alert on it.
    if (data.retryable) return;
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
