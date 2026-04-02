import { AlertInline, Button, Spinner } from "@aragon/ods";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { type Hex } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { PUB_TAIKO_BRIDGE_ADDRESS, TAIKO_L2_CHAIN_ID } from "@/constants";
import { useL2AnchorSync } from "@/hooks/useL2AnchorSync";
import { useL2LegExecution } from "@/hooks/useL2LegExecution";
import { type RawAction } from "@/utils/types";

interface ProposalL2ExecutionProps {
  actions: RawAction[];
  executed: boolean;
  executorTxHash?: string;
  executionBlockNumber?: number;
}

function hasL2Leg(actions: RawAction[]): boolean {
  return actions.some(
    (action) => action.to.toLowerCase() === PUB_TAIKO_BRIDGE_ADDRESS.toLowerCase()
  );
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

  const l1BlockNumber = executionBlockNumber ? BigInt(executionBlockNumber) : undefined;
  const l1TxHash = executorTxHash as Hex | undefined;

  const { isSynced, anchorBlockNumber } =
    useL2AnchorSync(executed ? l1BlockNumber : undefined);

  const {
    isExtracting,
    extractError,
    isAlreadyProcessed,
    executeL2,
    isL2Confirming,
    isL2Confirmed,
  } = useL2LegExecution(
    executed && isSynced ? l1TxHash : undefined,
    anchorBlockNumber,
    isSynced
  );

  // Don't render anything if no L2 leg
  if (!hasL2Leg(actions)) return null;

  // Don't render if bridge address is not configured
  if (!PUB_TAIKO_BRIDGE_ADDRESS) return null;

  // L1 not yet executed — show informational message
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

  // Waiting for subgraph data (executed but no block number yet)
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
