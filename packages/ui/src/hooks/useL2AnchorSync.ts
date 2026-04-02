import { useReadContract } from "wagmi";
import { TaikoAnchorAbi } from "@/artifacts/TaikoAnchor";
import { TAIKO_L2_ANCHOR_ADDRESS, TAIKO_L2_CHAIN_ID } from "@/constants";

const POLL_INTERVAL_MS = 12_000; // 12 seconds

export function useL2AnchorSync(l1BlockNumber?: bigint) {
  const enabled = l1BlockNumber !== undefined && l1BlockNumber > 0n;

  const { data: blockState, isLoading } = useReadContract({
    address: TAIKO_L2_ANCHOR_ADDRESS,
    abi: TaikoAnchorAbi,
    chainId: TAIKO_L2_CHAIN_ID,
    functionName: "getBlockState",
    query: {
      enabled,
      refetchInterval: (query) => {
        // Stop polling once synced
        const anchorBlock = query.state.data?.anchorBlockNumber;
        if (anchorBlock && l1BlockNumber && BigInt(anchorBlock) >= l1BlockNumber) {
          return false;
        }
        return POLL_INTERVAL_MS;
      },
    },
  });

  const anchorBlockNumber = blockState ? BigInt(blockState.anchorBlockNumber) : undefined;
  const isSynced = anchorBlockNumber !== undefined && l1BlockNumber !== undefined && anchorBlockNumber >= l1BlockNumber;

  return {
    isSynced,
    anchorBlockNumber,
    isLoading: enabled && isLoading,
  };
}
