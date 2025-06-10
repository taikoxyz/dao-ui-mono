import { PUB_TOKEN_ADDRESS } from "@/constants";
import { useBlock, usePublicClient, useReadContract } from "wagmi";
import { BlockTag, parseAbi } from "viem";
import { OptimisticProposal } from "../utils/types";
import { useBlockByTimestamp } from "./useBlockByTimestamp";

const erc20Votes = parseAbi(["function getPastTotalSupply(uint256 blockNumber) view returns (uint256)"]);

export function usePastSupply(blockNumber: bigint) {
  const { data: pastSupply } = useReadContract({
    address: PUB_TOKEN_ADDRESS,
    abi: erc20Votes,
    functionName: "getPastTotalSupply",
    args: [blockNumber],
  });

  return pastSupply || BigInt(0);
}
