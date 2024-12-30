import { PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { useConfig } from "wagmi";
import { OptimisticTokenVotingPluginAbi } from "../artifacts/OptimisticTokenVotingPlugin.sol";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "@wagmi/core";

export function useGovernanceSettings() {
  const config = useConfig();

  const {
    data: governanceSettings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["governance-settings", PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS],
    queryFn: () => {
      return readContract(config, {
        abi: OptimisticTokenVotingPluginAbi,
        address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
        functionName: "governanceSettings",
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
    governanceSettings: {
      /** 100% is represented as 1_000_000  */
      minVetoRatio: governanceSettings?.[0],
      /** In seconds */
      minDuration: governanceSettings?.[1],
      /** In seconds */
      timelockPeriod: governanceSettings?.[2],
      /** In seconds */
      l2InactivityPeriod: governanceSettings?.[3],
      /** In seconds */
      l2AggregationGracePeriod: governanceSettings?.[4],
    },
    isLoading,
    error,
    refetch,
  };
}
