import { PUB_TOKEN_ADDRESS } from "@/constants";
import { useReadContract } from "wagmi";
import { parseAbi } from "viem";

const erc20Votes = parseAbi(["function getPastTotalSupply(uint256 blockNumber) view returns (uint256)"]);

export function usePastSupply(timePoint: bigint) {
  const { data: pastSupply } = useReadContract({
    address: PUB_TOKEN_ADDRESS,
    abi: erc20Votes,
    functionName: "getPastTotalSupply",
    args: [timePoint],
    query: {
      enabled: Boolean(PUB_TOKEN_ADDRESS && timePoint > 0n),
    },
  });

  return pastSupply ?? BigInt(0);
}
