import { useReadContract } from "wagmi";
import { PUB_CHAIN, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { TaikoOptimisticTokenVotingPluginAbi } from "../artifacts/TaikoOptimisticTokenVotingPlugin.sol";

export function useProposalId(index: number) {
  const {
    data: proposalId,
    error: proposalIdError,
    fetchStatus: proposalIdFetchStatus,
  } = useReadContract({
    address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
    abi: TaikoOptimisticTokenVotingPluginAbi,
    functionName: "proposalIds",
    args: [BigInt(index)],
    chainId: PUB_CHAIN.id,
  });
  return {
    proposalId,
    proposalIdError,
    proposalIdFetchStatus,
  };
}
