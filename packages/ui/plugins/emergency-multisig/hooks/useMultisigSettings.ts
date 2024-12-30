import { PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { EmergencyMultisigPluginAbi } from "../artifacts/EmergencyMultisigPlugin";
import { useQuery } from "@tanstack/react-query";
import { readContract, Config } from "@wagmi/core";
import { useConfig } from "wagmi";

export function useMultisigSettings() {
  const config = useConfig() as Config;

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["emergency-multisig-settings", PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS],
    queryFn: () => {
      return readContract(config, {
        abi: EmergencyMultisigPluginAbi,
        address: PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS,
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
      /** The contract defining the members of the multisig */
      signerList: settings?.[2],
      /** In seconds */
      proposalExpirationPeriod: settings?.[3],
    },
    isLoading,
    error,
    refetch,
  };
}
