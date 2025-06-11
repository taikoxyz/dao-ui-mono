import { useState, useEffect, useCallback } from "react";
import { PublicClient, Block } from "viem";

interface UseBlockByTimestampOptions {
  tolerance?: number;
  enabled?: boolean;
}

interface UseBlockByTimestampReturn {
  block: Block | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBlockByTimestamp(
  client: PublicClient,
  targetTimestamp: number | null,
  options: UseBlockByTimestampOptions = {}
): UseBlockByTimestampReturn {
  const { tolerance = 15, enabled = true } = options;

  const [block, setBlock] = useState<Block | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getBlockByTimestamp = useCallback(
    async (timestamp: number): Promise<Block | null> => {
      let low = 0n;
      let high = await client.getBlockNumber();
      let closestBlock: Block | null = null;
      let closestDiff = Infinity;

      while (low <= high) {
        const mid = (low + high) / 2n;
        const currentBlock = await client.getBlock({ blockNumber: mid });
        const blockTimestamp = Number(currentBlock.timestamp);
        const diff = Math.abs(blockTimestamp - timestamp);

        // Track the closest block found
        if (diff < closestDiff) {
          closestDiff = diff;
          closestBlock = currentBlock;
        }

        // If we're within tolerance, return this block
        if (diff <= tolerance) {
          return currentBlock;
        }

        if (blockTimestamp < timestamp) {
          low = mid + 1n;
        } else {
          high = mid - 1n;
        }
      }

      return closestBlock;
    },
    [client, tolerance]
  );

  const fetchBlock = useCallback(async () => {
    if (!targetTimestamp || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getBlockByTimestamp(targetTimestamp);
      setBlock(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch block"));
      setBlock(null);
    } finally {
      setLoading(false);
    }
  }, [targetTimestamp, enabled, getBlockByTimestamp]);

  const refetch = useCallback(async () => {
    await fetchBlock();
  }, [fetchBlock]);

  useEffect(() => {
    fetchBlock();
  }, [fetchBlock]);

  return {
    block,
    loading,
    error,
    refetch,
  };
}
