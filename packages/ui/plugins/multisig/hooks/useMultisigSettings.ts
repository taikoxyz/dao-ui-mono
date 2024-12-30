import { PUB_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { useConfig } from "wagmi";
import { MultisigPluginAbi } from "../artifacts/MultisigPlugin";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";

export function useMultisigSettings() {
  const config = useConfig();

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["multisig-settings", PUB_MULTISIG_PLUGIN_ADDRESS],
    queryFn: () => {
      return readContract(config, {
        abi: MultisigPluginAbi,
        address: PUB_MULTISIG_PLUGIN_ADDRESS,
        functionName: "multisigSettings",
        args: [],
      });
    },
    retry: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 60,
  });

  return {
    settings: {
      /** Whether only multisig members can create proposals or everyone can */
      onlyListed: settings?.[0],
      /** The required amount of approvals for a proposal to pass */
      minApprovals: settings?.[1],
      /** In seconds, the minimum amount that the proposal will last on the optimistic voting plugin */
      destinationProposalDuration: settings?.[2],
      /** The contract defining the members of the multisig */
      signerList: settings?.[3],
      /** In seconds */
      proposalExpirationPeriod: settings?.[4],
    },
    isLoading,
    error,
    refetch,
  };
}
