import { useEffect } from "react";
import { AlertInline, Button, Spinner } from "@aragon/ods";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { decodeFunctionData, type Hex } from "viem";
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

// The Taiko bridge `Message` struct, mirrored from the MessageSent event so the
// derived `sendMessage` selector matches on-chain calldata exactly.
const bridgeMessageComponents = [
  { name: "id", type: "uint64" },
  { name: "fee", type: "uint64" },
  { name: "gasLimit", type: "uint32" },
  { name: "from", type: "address" },
  { name: "srcChainId", type: "uint64" },
  { name: "srcOwner", type: "address" },
  { name: "destChainId", type: "uint64" },
  { name: "destOwner", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "data", type: "bytes" },
] as const;

const bridgeSendMessageAbi = [
  {
    type: "function",
    name: "sendMessage",
    stateMutability: "payable",
    inputs: [{ name: "_message", type: "tuple", components: bridgeMessageComponents }],
    outputs: [
      { name: "msgHash_", type: "bytes32" },
      { name: "message_", type: "tuple", components: bridgeMessageComponents },
    ],
  },
] as const;

// A cross-chain L2 leg is specifically a `sendMessage` call to the bridge
// destined for Taiko L2 — the thing that emits MessageSent and needs a follow-up
// L2 execution. Merely targeting the bridge (e.g. L1-only governance on the
// bridge itself) or having the bridge address appear somewhere in calldata does
// NOT require an L2 execution, so those must not be flagged.
function isBridgeL2Send(action: RawAction): boolean {
  if (!PUB_TAIKO_BRIDGE_ADDRESS) return false;
  if (action.to.toLowerCase() !== PUB_TAIKO_BRIDGE_ADDRESS.toLowerCase()) return false;
  try {
    const { functionName, args } = decodeFunctionData({ abi: bridgeSendMessageAbi, data: action.data });
    if (functionName !== "sendMessage") return false;
    const message = args[0] as { destChainId: bigint };
    return Number(message.destChainId) === TAIKO_L2_CHAIN_ID;
  } catch {
    // Not a sendMessage call (e.g. a governance call on the bridge) — no L2 leg.
    return false;
  }
}

function hasL2LegFromActions(actions: RawAction[]): boolean {
  return actions.some(isBridgeL2Send);
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
  // Allow Taiko L2 only while still determining L2 leg status or when a confirmed L2 leg exists.
  // Without this guard, executed proposals with no L2 leg keep the secondary chain allowed indefinitely.
  const shouldAllowTaikoL2 = executed && shouldCheckL2 && !isL2Confirmed && (!isSynced || isExtracting || hasL2Leg);

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
