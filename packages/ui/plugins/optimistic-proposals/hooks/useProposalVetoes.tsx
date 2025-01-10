import { getAbiItem } from "viem";
import { OptimisticTokenVotingPluginAbi } from "@/plugins/optimistic-proposals/artifacts/OptimisticTokenVotingPlugin.sol";
import { usePublicClient } from "wagmi";
import { PUB_DEPLOYMENT_BLOCK, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { getLogsUntilNow } from "@/utils/evm";
import { useQuery } from "@tanstack/react-query";

const vetoCastEvent = getAbiItem({
  abi: OptimisticTokenVotingPluginAbi,
  name: "VetoCast",
});

export function useProposalVetoes(proposalId?: bigint) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: [
      "optimistic-proposal-veto-cast-event",
      PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
      proposalId?.toString() || "",
      !!publicClient,
    ],
    queryFn: () => {
      if (!publicClient || typeof proposalId === "undefined") return [];

      return getLogsUntilNow(
        PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
        vetoCastEvent,
        {
          proposalId: BigInt(proposalId),
        },
        publicClient,
        PUB_DEPLOYMENT_BLOCK
      ).then((logs) => {
        return logs.flatMap((log) => log.args);
      });
    },
    retry: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 3,
  });
}
