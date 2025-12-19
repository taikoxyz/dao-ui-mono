import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";

export function useExecutionTimestamp(executionBlockNumber?: number) {
  const publicClient = usePublicClient();

  const { data: executionTimestamp, isLoading } = useQuery({
    queryKey: ["execution-block-timestamp", executionBlockNumber],
    queryFn: async () => {
      if (!publicClient || !executionBlockNumber) return null;
      const block = await publicClient.getBlock({ blockNumber: BigInt(executionBlockNumber) });
      return Number(block.timestamp) * 1000; // Convert to milliseconds
    },
    enabled: !!publicClient && !!executionBlockNumber,
    staleTime: Infinity, // Block data never changes
  });

  return { executionTimestamp, isLoading };
}
