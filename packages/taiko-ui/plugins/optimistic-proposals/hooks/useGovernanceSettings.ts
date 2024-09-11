import { PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { useConfig } from "wagmi";
import { TaikoOptimisticTokenVotingPluginAbi } from "../artifacts/TaikoOptimisticTokenVotingPlugin.sol";
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
        abi: TaikoOptimisticTokenVotingPluginAbi,
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
      minVetoRatio: governanceSettings?.[0],
      minDuration: governanceSettings?.[1],
      l2InactivityPeriod: governanceSettings?.[2],
      l2AggregationGracePeriod: governanceSettings?.[3],
    },
    isLoading,
    error,
    refetch,
  };
}
