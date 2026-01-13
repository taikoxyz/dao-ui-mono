import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

/**
 * Hook to get the timestamp of a specific block number.
 * Returns the timestamp in milliseconds (JavaScript Date compatible).
 */
export function useBlockTimestamp(blockNumber: number | bigint | undefined | null) {
  const publicClient = usePublicClient();

  const {
    data: timestamp,
    isLoading,
    error,
  } = useQuery<number | undefined>({
    queryKey: ["block-timestamp", blockNumber?.toString(), !!publicClient, publicClient?.chain.id],
    queryFn: async () => {
      if (!blockNumber || !publicClient) return undefined;

      const block = await publicClient.getBlock({
        blockNumber: BigInt(blockNumber),
      });

      // Convert from seconds to milliseconds
      return Number(block.timestamp) * 1000;
    },
    retry: 3,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    enabled: !!blockNumber && !!publicClient,
    staleTime: Infinity, // Block timestamps never change
  });

  return {
    timestamp,
    isLoading,
    error,
  };
}
