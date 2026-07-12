import { useAccount, useBlockNumber, useReadContract } from "wagmi";
import { useEffect } from "react";
import { PUB_CHAIN, PUB_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { MultisigPluginAbi } from "../artifacts/MultisigPlugin";

export function useUserCanApprove(proposalId: string | bigint | number) {
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const {
    data: canApprove,
    isFetching,
    error,
    refetch,
  } = useReadContract({
    chainId: PUB_CHAIN.id,
    address: PUB_MULTISIG_PLUGIN_ADDRESS,
    abi: MultisigPluginAbi,
    functionName: "canApprove",
    args: [BigInt(proposalId), address!],
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    // refetch() bypasses `enabled`, so without this guard a disconnected visitor
    // fires a read with an undefined address every other block, which always errors
    if (!address) return;
    if (Number(blockNumber) % 2 === 0) {
      refetch();
    }
  }, [address, blockNumber, refetch]);

  // No wallet is a settled "cannot approve", not an undetermined eligibility
  if (!address) return { canApprove: false, isFetching: false, error: null, refetch };

  return { canApprove, isFetching, error, refetch };
}
