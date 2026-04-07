import { useEffect } from "react";
import { AlertInline, Button, Spinner } from "@aragon/ods";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { type Hex } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PUB_TAIKO_BRIDGE_ADDRESS, TAIKO_L2_CHAIN_ID } from "@/constants";
import { useWalletChainPolicy } from "@/context/WalletChainPolicy";
import { useL2AnchorSync } from "@/hooks/useL2AnchorSync";
import { useL2LegExecution } from "@/hooks/useL2LegExecution";
import { shouldRenderL2ExecutionCard } from "@/utils/l2-execution";
import { type RawAction } from "@/utils/types";

interface ProposalL2ExecutionProps {
  actions: RawAction[];
  executed: boolean;
  executorTxHash?: string;
  executionBlockNumber?: number;
}

function hasL2LegFromActions(actions: RawAction[]): boolean {
  if (!PUB_TAIKO_BRIDGE_ADDRESS || !actions.length) return false;
  const bridgeAddrLower = PUB_TAIKO_BRIDGE_ADDRESS.toLowerCase().replace("0x", "");
  return actions.some((action) => {
    // Direct target: action calls the bridge
    if (action.to.toLowerCase() === PUB_TAIKO_BRIDGE_ADDRESS.toLowerCase()) return true;
    // Nested target: bridge address encoded inside the action data
    // (e.g. DAO.execute wrapping inner actions that include a bridge call)
    if (action.data.toLowerCase().includes(bridgeAddrLower)) return true;
    return false;
  });
}

export function ProposalL2Execution({
  actions,
  executed,
  executorTxHash,
  executionBlockNumber,
}: ProposalL2ExecutionProps) {
  const { isConnected, chain } = useAccount();
  const { open } = useWeb3Modal();
  const { switchChain } = useSwitchChain();
  const { setAllowedSecondaryChainIds } = useWalletChainPolicy();

  const l1BlockNumber = executionBlockNumber ? BigInt(executionBlockNumber) : undefined;
  const l1TxHash = executorTxHash as Hex | undefined;

  // Pre-execution detection: check action data for bridge address
  const detectedFromActions = hasL2LegFromActions(actions);

  // For executed proposals, always try anchor sync + message extraction
  // (actions may be cleared from the contract after execution)
  const shouldCheckL2 = detectedFromActions || (executed && !!l1TxHash);

  const { isSynced, anchorBlockNumber } = useL2AnchorSync(
    shouldCheckL2 && executed ? l1BlockNumber : undefined
  );

  const {
    message,
    isExtracting,
    extractError,
    executeL2,
    isL2Confirming,
    isL2Confirmed,
  } = useL2LegExecution(
    shouldCheckL2 && executed && isSynced ? l1TxHash : undefined,
    anchorBlockNumber,
    isSynced
  );

  // Post-execution detection: a MessageSent event was found in the L1 tx
  const detectedFromTx = !!message;

  const hasL2Leg = detectedFromActions || detectedFromTx;
  const shouldAllowTaikoL2 = executed && shouldCheckL2 && !isL2Confirmed;

  useEffect(() => {
    setAllowedSecondaryChainIds(shouldAllowTaikoL2 ? [TAIKO_L2_CHAIN_ID] : []);

    return () => {
      setAllowedSecondaryChainIds([]);
    };
  }, [setAllowedSecondaryChainIds, shouldAllowTaikoL2]);

  // Don't render if no L2 leg detected (and not still checking)
  if (!shouldRenderL2ExecutionCard({ hasL2Leg, isExtracting, shouldCheckExecutedProposal: shouldCheckL2 })) {
    return null;
  }

  // Pre-execution: show informational message
  if (!executed) {
    return (
      <div className="mt-4">
        <AlertInline
          message="This proposal includes cross-chain actions. After L1 execution, you'll need to execute the L2 leg on Taiko."
          variant="info"
        />
      </div>
    );
  }

  // L2 already confirmed
  if (isL2Confirmed) {
    return (
      <div className="mt-4">
        <AlertInline message="L2 leg has been executed successfully." variant="success" />
      </div>
    );
  }

  // Waiting for subgraph data
  if (!l1BlockNumber || !l1TxHash) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-sm text-neutral-500">Loading L2 execution details...</span>
      </div>
    );
  }

  // Waiting for L2 anchor sync
  if (!isSynced) {
    return (
      <div className="mt-4 rounded-xl bg-neutral-0 p-4 shadow-neutral">
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-neutral-800">L2 Execution</p>
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-sm text-neutral-500">
              Waiting for Taiko L2 to sync L1 block...
              {anchorBlockNumber && l1BlockNumber && (
                <span>
                  {" "}
                  (L2 anchor: {anchorBlockNumber.toString()}, target: {l1BlockNumber.toString()})
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Extracting message from L1 tx
  if (isExtracting) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-sm text-neutral-500">Extracting bridge message from L1 transaction...</span>
      </div>
    );
  }

  // No MessageSent found after extraction — not an L2 proposal
  if (!message && !detectedFromActions) return null;

  // Extract error
  if (extractError) {
    return (
      <div className="mt-4">
        <AlertInline
          message={`Failed to read L1 transaction: ${extractError}`}
          variant="critical"
        />
      </div>
    );
  }

  // Check if on correct network
  const isOnTaikoL2 = chain?.id === TAIKO_L2_CHAIN_ID;

  const handleExecuteL2 = async () => {
    if (!isConnected) {
      open();
      return;
    }
    if (!isOnTaikoL2) {
      switchChain({ chainId: TAIKO_L2_CHAIN_ID });
      return;
    }
    executeL2();
  };

  // Ready to execute L2 leg
  return (
    <div className="mt-4 rounded-xl bg-neutral-0 p-4 shadow-neutral">
      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold text-neutral-800">L2 Execution</p>
        <p className="text-sm text-neutral-500">
          The L1 execution is complete and synced to Taiko L2. Execute the L2 leg to complete the
          cross-chain proposal.
        </p>
        <Button
          size="lg"
          variant="primary"
          isLoading={isL2Confirming}
          onClick={handleExecuteL2}
          className="w-full"
        >
          {!isConnected
            ? "Connect wallet"
            : !isOnTaikoL2
              ? "Switch to Taiko L2"
              : "Execute L2 leg"}
        </Button>
      </div>
    </div>
  );
}
