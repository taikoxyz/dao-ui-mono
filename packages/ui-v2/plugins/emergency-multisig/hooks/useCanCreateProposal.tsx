import { useAccount, useReadContract } from "wagmi";
import { PUB_SIGNER_LIST_CONTRACT_ADDRESS } from "@/constants";
import { SignerListAbi } from "@/plugins/security-council/artifacts/SignerList";

export function useCanCreateProposal() {
  const { address } = useAccount();
  const {
    data: canCreate,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    abi: SignerListAbi,
    address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
    functionName: "isListedOrAppointedByListed",
    args: [address!],

    query: {
      retry: true,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retryOnMount: true,
      enabled: !!address,
      staleTime: 1000 * 60 * 5,
    },
  });

  return { canCreate, isLoading, error, refetch };
}
