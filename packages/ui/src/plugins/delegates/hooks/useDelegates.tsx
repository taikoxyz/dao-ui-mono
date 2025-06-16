import { useReadContract } from "wagmi";
import { PUB_DELEGATION_WALL_CONTRACT_ADDRESS } from "@/constants";
import { DelegateAnnouncerAbi } from "../artifacts/DelegationWall.sol";

/** Returns the list of delegates who posted a candidacy */
export function useDelegates() {
  const { data, status, refetch } = useReadContract({
    abi: DelegateAnnouncerAbi,
    address: PUB_DELEGATION_WALL_CONTRACT_ADDRESS,
    functionName: "getCandidateAddresses",

    query: {
      retry: true,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retryOnMount: true,
      staleTime: 1000 * 60 * 10,
    },
  });

  return { delegates:data, status, refetch };
}
