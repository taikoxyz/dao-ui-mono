import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { AlertContextProps, useAlerts } from "@/context/Alerts";
import { useRouter } from "next/router";
import { PUB_CHAIN, PUB_MULTISIG_PLUGIN_ADDRESS } from "@/constants";
import { MultisigPluginAbi } from "../artifacts/MultisigPlugin";
import {
  CONNECT_WALLET_EXECUTE_ALERT_DESCRIPTION,
  CONNECT_WALLET_EXECUTE_ALERT_MESSAGE,
  isWalletDisconnectedError,
} from "@/utils/wallet-errors";

export function useProposalExecute(proposalId: string) {
  const { push } = useRouter();
  const [isExecuting, setIsExecuting] = useState(false);
  const { addAlert } = useAlerts() as AlertContextProps;
  const { isConnected } = useAccount();

  const {
    data: canExecute,
    isError: isCanVoteError,
    isLoading: isCanVoteLoading,
  } = useReadContract({
    address: PUB_MULTISIG_PLUGIN_ADDRESS,
    abi: MultisigPluginAbi,
    chainId: PUB_CHAIN.id,
    functionName: "canExecute",
    args: [BigInt(proposalId)],
  });
  const {
    writeContract: executeWrite,
    data: executeTxHash,
    error: executingError,
    status: executingStatus,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: executeTxHash });

  const executeProposal = () => {
    if (!isConnected) {
      addAlert(CONNECT_WALLET_EXECUTE_ALERT_MESSAGE, {
        type: "error",
        description: CONNECT_WALLET_EXECUTE_ALERT_DESCRIPTION,
      });
      return;
    } else if (!canExecute) return;

    setIsExecuting(true);

    executeWrite({
      chainId: PUB_CHAIN.id,
      abi: MultisigPluginAbi,
      address: PUB_MULTISIG_PLUGIN_ADDRESS,
      functionName: "execute",
      args: [BigInt(proposalId)],
    });
  };

  useEffect(() => {
    if (executingStatus === "idle" || executingStatus === "pending") return;
    else if (executingStatus === "error") {
      if (executingError?.message?.startsWith("User rejected the request")) {
        addAlert("The transaction signature was declined", {
          description: "Nothing will be sent to the network",
          timeout: 4 * 1000,
        });
      } else if (isWalletDisconnectedError(executingError) || (!executingError?.message && !isConnected)) {
        addAlert(CONNECT_WALLET_EXECUTE_ALERT_MESSAGE, {
          type: "error",
          description: CONNECT_WALLET_EXECUTE_ALERT_DESCRIPTION,
        });
      } else {
        console.error(executingError);
        addAlert("Could not execute the proposal", {
          type: "error",
          description: "The proposal may contain actions with invalid operations",
        });
      }
      setIsExecuting(false);
      return;
    }

    // success
    if (!executeTxHash) return;
    else if (isConfirming) {
      addAlert("Transaction submitted", {
        description: "Waiting for the transaction to be validated",
        type: "info",
        txHash: executeTxHash,
      });
      return;
    } else if (!isConfirmed) return;

    addAlert("Proposal passed to the community stage", {
      description: "The transaction has been validated",
      type: "success",
      txHash: executeTxHash,
    });

    setTimeout(() => {
      push("/");
      window.scroll(0, 0);
    }, 1000 * 2);
  }, [executingStatus, executeTxHash, isConfirming, isConfirmed, addAlert, executingError, isConnected, push]);

  return {
    executeProposal,
    canExecute: isConnected && !isCanVoteError && !isCanVoteLoading && !isConfirmed && !!canExecute,
    isConfirming: isExecuting || isConfirming,
    isConfirmed,
  };
}
