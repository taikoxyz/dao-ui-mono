import { useCallback, useEffect, useState } from "react";
import {
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  type Address,
  type Hex,
  decodeEventLog,
  encodeAbiParameters,
  encodePacked,
  keccak256,
} from "viem";
import { TaikoBridgeL1EventsAbi } from "@/artifacts/TaikoBridgeL1Events";
import { TaikoBridgeL2Abi } from "@/artifacts/TaikoBridgeL2";
import {
  PUB_CHAIN,
  L1_SIGNAL_SERVICE_ADDRESS,
  PUB_TAIKO_BRIDGE_ADDRESS,
  TAIKO_L2_BRIDGE_ADDRESS,
  TAIKO_L2_CHAIN_ID,
} from "@/constants";
import { AlertContextProps, useAlerts } from "@/context/Alerts";
import { getConfirmedL2MessageOutcome } from "@/utils/l2-execution";

// Bridge message status: 0 = NEW, 1 = RETRIABLE, 2 = DONE, 3 = FAILED, 4 = PROVEN
const MESSAGE_STATUS_DONE = 2;

interface BridgeMessage {
  id: bigint;
  fee: bigint;
  gasLimit: number;
  from: Address;
  srcChainId: bigint;
  srcOwner: Address;
  destChainId: bigint;
  destOwner: Address;
  to: Address;
  value: bigint;
  data: Hex;
}

const HOP_PROOF_TYPE = [
  {
    type: "tuple[]",
    components: [
      { name: "chainId", type: "uint64" },
      { name: "blockId", type: "uint64" },
      { name: "rootHash", type: "bytes32" },
      { name: "cacheOption", type: "uint8" },
      { name: "accountProof", type: "bytes[]" },
      { name: "storageProof", type: "bytes[]" },
    ],
  },
] as const;

export function useL2LegExecution(
  l1TxHash?: Hex,
  anchorBlockNumber?: bigint,
  isSynced?: boolean
) {
  const { addAlert } = useAlerts() as AlertContextProps;
  const l1Client = usePublicClient({ chainId: PUB_CHAIN.id });

  const [message, setMessage] = useState<BridgeMessage | null>(null);
  const [msgHash, setMsgHash] = useState<Hex | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Reset extraction state when the tx hash changes (e.g. navigating between proposals)
  useEffect(() => {
    setMessage(null);
    setMsgHash(null);
    setExtractError(null);
  }, [l1TxHash]);

  // Step 1: Extract message from L1 tx receipt
  useEffect(() => {
    if (!l1TxHash || !l1Client || message) return;

    let cancelled = false;

    setIsExtracting(true);
    l1Client
      .getTransactionReceipt({ hash: l1TxHash })
      .then((receipt) => {
        if (cancelled) return;
        let found = false;
        const bridgeAddr = PUB_TAIKO_BRIDGE_ADDRESS.toLowerCase();
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== bridgeAddr) continue;
          try {
            const decoded = decodeEventLog({
              abi: TaikoBridgeL1EventsAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "MessageSent") {
              setMessage(decoded.args.message as unknown as BridgeMessage);
              setMsgHash(decoded.args.msgHash as Hex);
              found = true;
              break;
            }
          } catch {
            // Not a MessageSent event, skip
          }
        }
        if (!found) {
          setExtractError("No bridge message found in this transaction");
        }
        setIsExtracting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setExtractError("Failed to read L1 transaction");
        setIsExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [l1TxHash, l1Client, message]);

  // Step 2: Write contract setup (declared early so l2TxHash is available for status polling)
  const {
    writeContract,
    data: l2TxHash,
    error: writeError,
    status: writeStatus,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isL2Confirming, isSuccess: isL2Confirmed } =
    useWaitForTransactionReceipt({ hash: l2TxHash });

  // Step 3: Check message status on L2 (re-polls after processMessage tx until DONE)
  const { data: messageStatusResult } = useReadContract({
    address: TAIKO_L2_BRIDGE_ADDRESS,
    abi: TaikoBridgeL2Abi,
    chainId: TAIKO_L2_CHAIN_ID,
    functionName: "messageStatus",
    args: msgHash ? [msgHash] : undefined,
    query: {
      enabled: !!msgHash,
      refetchInterval: (query) => {
        if (l2TxHash && query.state.data !== MESSAGE_STATUS_DONE) return 5_000;
        return false;
      },
    },
  });

  const isMessageDone = messageStatusResult === MESSAGE_STATUS_DONE;

  // Step 4: Build proof and execute
  const executeL2 = useCallback(async () => {
    if (!message || !msgHash || !l1Client || !isSynced || !anchorBlockNumber) {
      return;
    }

    try {
      // Compute signal slot: keccak256(abi.encodePacked("SIGNAL", chainId, app, signal))
      const signalSlot = keccak256(
        encodePacked(
          ["string", "uint64", "address", "bytes32"],
          ["SIGNAL", BigInt(PUB_CHAIN.id), PUB_TAIKO_BRIDGE_ADDRESS, msgHash]
        )
      );

      // Get storage proof from L1
      const proof = await l1Client.getProof({
        address: L1_SIGNAL_SERVICE_ADDRESS,
        storageKeys: [signalSlot],
        blockNumber: anchorBlockNumber,
      });

      // Get the L1 block for the state root
      const block = await l1Client.getBlock({
        blockNumber: anchorBlockNumber,
      });

      // Encode HopProof — chainId is the destination chain (L2), not the source
      const hopProofs = [
        {
          chainId: BigInt(TAIKO_L2_CHAIN_ID),
          blockId: anchorBlockNumber,
          rootHash: block.stateRoot,
          cacheOption: 0,
          accountProof: proof.accountProof,
          storageProof: proof.storageProof[0]?.proof ?? [],
        },
      ];

      const encodedProof = encodeAbiParameters(HOP_PROOF_TYPE, [hopProofs]);

      // Call processMessage on L2 Bridge
      writeContract({
        chainId: TAIKO_L2_CHAIN_ID,
        address: TAIKO_L2_BRIDGE_ADDRESS,
        abi: TaikoBridgeL2Abi,
        functionName: "processMessage",
        args: [
          {
            id: message.id,
            fee: message.fee,
            gasLimit: message.gasLimit,
            from: message.from,
            srcChainId: message.srcChainId,
            srcOwner: message.srcOwner,
            destChainId: message.destChainId,
            destOwner: message.destOwner,
            to: message.to,
            value: message.value,
            data: message.data,
          },
          encodedProof,
        ],
      });
    } catch (err: any) {
      addAlert("Failed to build L2 proof", {
        type: "error",
        description: err?.message ?? "Could not construct the merkle proof",
      });
    }
  }, [message, msgHash, l1Client, isSynced, anchorBlockNumber, writeContract, addAlert]);

  // Handle write status alerts
  useEffect(() => {
    if (writeStatus === "idle" || writeStatus === "pending") return;

    if (writeStatus === "error") {
      if (writeError?.message?.startsWith("User rejected the request")) {
        addAlert("Transaction signature was declined", {
          description: "Nothing will be sent to the network",
          timeout: 4000,
        });
      } else {
        addAlert("Could not execute L2 leg", {
          type: "error",
          description: writeError?.message ?? "Unknown error",
        });
      }
      resetWrite();
      return;
    }

    if (!l2TxHash) return;
    if (isL2Confirming) {
      addAlert("L2 transaction submitted", {
        description: "Waiting for the transaction to be validated on Taiko L2",
        type: "info",
      });
      return;
    }
    if (isL2Confirmed) {
      const messageOutcome = getConfirmedL2MessageOutcome(messageStatusResult);

      if (messageOutcome === "success") {
        addAlert("L2 leg executed successfully", {
          description: "The cross-chain proposal actions have been executed on L2",
          type: "success",
        });
        return;
      }

      if (messageOutcome === "failed") {
        addAlert("L2 transaction confirmed but message processing failed", {
          description: "The bridge message failed on L2. Check the transaction and retry if needed.",
          type: "error",
        });
        return;
      }

      addAlert("L2 transaction confirmed; waiting for message processing", {
        description: "The transaction was confirmed on Taiko L2 and the bridge message is still being finalized.",
        type: "info",
      });
    }
  }, [
    writeStatus,
    writeError,
    l2TxHash,
    isL2Confirming,
    isL2Confirmed,
    messageStatusResult,
    addAlert,
    resetWrite,
  ]);

  return {
    message,
    msgHash,
    isExtracting,
    extractError,
    executeL2,
    isL2Confirming: writeStatus === "pending" || isL2Confirming,
    isL2Confirmed: isMessageDone,
  };
}
