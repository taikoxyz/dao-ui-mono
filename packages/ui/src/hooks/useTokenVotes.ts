import { iVotesAbi } from "../plugins/security-council/artifacts/iVotes.sol";
import { PUB_CHAIN, PUB_TOKEN_ADDRESS } from "@/constants";
import { type Address, parseAbi } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

const ERC20_ABI = parseAbi(["function totalSupply() view returns (uint256)"]);

/** Returns the delegate (if any) for the given address */
export const useTokenVotes = (address?: Address) => {
  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      {
        chainId: PUB_CHAIN.id,
        abi: iVotesAbi,
        functionName: "delegates",
        args: [address!],
        address: PUB_TOKEN_ADDRESS,
      },
      {
        chainId: PUB_CHAIN.id,
        abi: iVotesAbi,
        functionName: "getVotes",
        args: [address!],
        address: PUB_TOKEN_ADDRESS,
      },
      {
        chainId: PUB_CHAIN.id,
        abi: iVotesAbi,
        functionName: "balanceOf",
        args: [address!],
        address: PUB_TOKEN_ADDRESS,
      },
    ],
    query: { enabled: !!address },
  });

  return {
    delegatesTo: data?.[0].result,
    votingPower: data?.[1].result,
    balance: data?.[2].result,
    isLoading,
    isError,
    refetch,
  };
};

/** Returns the total supply of the token */
export const useTokenTotalSupply = () => {
  const { data, isLoading, isError } = useReadContract({
    abi: ERC20_ABI,
    address: PUB_TOKEN_ADDRESS,
    functionName: "totalSupply",
    query: {
      staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    },
  });

  return {
    totalSupply: data,
    isLoading,
    isError,
  };
};
