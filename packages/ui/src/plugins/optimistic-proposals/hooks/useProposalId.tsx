import { useReadContract } from "wagmi";
import { PUB_CHAIN, PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS } from "@/constants";
import { OptimisticTokenVotingPluginAbi } from "../artifacts/OptimisticTokenVotingPlugin.sol";

export function useProposalId(index: number) {
  const {
    data: proposalId,
    error: proposalIdError,
    fetchStatus: proposalIdFetchStatus,
  } = useReadContract({
    address: PUB_DUAL_GOVERNANCE_PLUGIN_ADDRESS,
    abi: OptimisticTokenVotingPluginAbi,
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
