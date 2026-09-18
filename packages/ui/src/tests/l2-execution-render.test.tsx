import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, type Address, type Hex } from "viem";
import { TaikoBridgeL1EventsAbi } from "@/artifacts/TaikoBridgeL1Events";
import { ProposalL2Execution } from "@/components/l2Execution/ProposalL2Execution";
import { useWalletChainPolicy, WalletChainPolicyProvider } from "@/context/WalletChainPolicy";
import { useL2LegExecution } from "@/hooks/useL2LegExecution";
import { bridgeSendMessageAbi } from "@/utils/l2-execution";
import { type RawAction } from "@/utils/types";

const mocks = vi.hoisted(() => {
  const getTransactionReceipt = vi.fn();
  return {
    client: { getTransactionReceipt },
    clientAvailable: true,
    isSynced: true,
    messageStatus: 0,
    addAlert: vi.fn(),
    writeContract: vi.fn(),
    resetWrite: vi.fn(),
  };
});

vi.mock("@/constants", () => ({
  PUB_CHAIN: { id: 1 },
  PUB_TAIKO_BRIDGE_ADDRESS: "0xd60247c6848B7Ca29eDdF63AA924E53dB6Ddd8EC",
  L1_SIGNAL_SERVICE_ADDRESS: "0x0000000000000000000000000000000000000001",
  TAIKO_L2_BRIDGE_ADDRESS: "0x0000000000000000000000000000000000000002",
  TAIKO_L2_CHAIN_ID: 167000,
}));

vi.mock("wagmi", () => ({
  usePublicClient: vi.fn(() => (mocks.clientAvailable ? mocks.client : undefined)),
  useAccount: () => ({ isConnected: true, chain: { id: 167000 } }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
  useReadContract: () => ({ data: mocks.messageStatus }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
  useWriteContract: () => ({
    writeContract: mocks.writeContract,
    status: "idle",
    reset: mocks.resetWrite,
  }),
}));

vi.mock("@/context/Alerts", () => ({ useAlerts: () => ({ addAlert: mocks.addAlert }) }));
vi.mock("@/hooks/useL2AnchorSync", () => ({
  useL2AnchorSync: () => ({ isSynced: mocks.isSynced, anchorBlockNumber: 100n }),
}));
vi.mock("@web3modal/wagmi/react", () => ({ useWeb3Modal: () => ({ open: vi.fn() }) }));
vi.mock("@aragon/ods", () => ({
  AlertInline: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  Spinner: () => <span role="status">Loading</span>,
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

const BRIDGE: Address = "0xd60247c6848B7Ca29eDdF63AA924E53dB6Ddd8EC";
const OTHER: Address = "0x0000000000000000000000000000000000000001";
const TX_A = `0x${"11".repeat(32)}` as Hex;
const TX_B = `0x${"22".repeat(32)}` as Hex;
const MESSAGE_HASH = `0x${"33".repeat(32)}` as Hex;
const message = {
  id: 1n,
  fee: 0n,
  gasLimit: 1_000_000,
  from: OTHER,
  srcChainId: 1n,
  srcOwner: OTHER,
  destChainId: 167000n,
  destOwner: OTHER,
  to: OTHER,
  value: 0n,
  data: "0x" as Hex,
};
const bridgeActions: RawAction[] = [
  {
    to: BRIDGE,
    value: 0n,
    data: encodeFunctionData({ abi: bridgeSendMessageAbi, functionName: "sendMessage", args: [message] }),
  },
];
const receiptWithMessage = {
  logs: [
    {
      address: BRIDGE,
      topics: encodeEventTopics({
        abi: TaikoBridgeL1EventsAbi,
        eventName: "MessageSent",
        args: { msgHash: MESSAGE_HASH },
      }),
      data: encodeAbiParameters([TaikoBridgeL1EventsAbi[0].inputs[1]], [message]),
    },
  ],
};
type Receipt = typeof receiptWithMessage;
const emptyReceipt: Receipt = { logs: [] };

function deferredReceipt() {
  let resolve!: (receipt: Receipt) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Receipt>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function AllowedChains() {
  const { allowedSecondaryChainIds } = useWalletChainPolicy();
  return <output data-testid="allowed-chains">{allowedSecondaryChainIds.join(",")}</output>;
}

function Card({ actions = bridgeActions }: { actions?: RawAction[] }) {
  return (
    <WalletChainPolicyProvider>
      <ProposalL2Execution actions={actions} executed={true} executorTxHash={TX_A} executionBlockNumber={100} />
      <AllowedChains />
    </WalletChainPolicyProvider>
  );
}

let container: HTMLDivElement;
let root: Root;
let hook: ReturnType<typeof useL2LegExecution>;

function HookHarness({ hash = TX_A }: { hash?: Hex }) {
  hook = useL2LegExecution(hash, 100n, true);
  return null;
}

async function render(element: ReactNode) {
  await act(async () => root.render(element));
}

const allowedChains = () => container.querySelector("output")?.textContent;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.client.getTransactionReceipt.mockReset();
  mocks.clientAvailable = true;
  mocks.isSynced = true;
  mocks.messageStatus = 0;
  const reportError = console.error;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (args[0] !== "Could not read the L1 transaction receipt") reportError(...args);
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("receipt extraction retries", () => {
  test.each([
    ["retained", bridgeActions],
    ["cleared", []],
  ])("Retry recovers for the same hash and stable L1 client with %s actions", async (_label, actions) => {
    const retry = deferredReceipt();
    mocks.client.getTransactionReceipt
      .mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockReturnValueOnce(retry.promise);

    await render(<Card actions={actions} />);
    expect(container.querySelector("[role=alert]")?.textContent).toBe("Could not read the L1 transaction receipt.");
    expect(allowedChains()).toBe("");
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Retry");

    await act(async () => button!.click());
    expect(mocks.client.getTransactionReceipt.mock.calls).toEqual([[{ hash: TX_A }], [{ hash: TX_A }]]);
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(container.textContent).toContain("Extracting bridge message");
    expect(allowedChains()).toBe("167000");

    await act(async () => retry.resolve(receiptWithMessage));
    expect(container.querySelector("button")?.textContent).toBe("Execute L2 leg");
    expect(allowedChains()).toBe("167000");
  });

  test("retry clears a no-message verdict before the next attempt settles", async () => {
    const retry = deferredReceipt();
    mocks.client.getTransactionReceipt.mockResolvedValueOnce(emptyReceipt).mockReturnValueOnce(retry.promise);
    await render(<HookHarness />);
    expect(hook.noMessageFound).toBe(true);

    await act(async () => hook.retryExtraction());
    expect(hook.noMessageFound).toBe(false);
    expect(hook.extractError).toBeNull();
    expect(hook.isExtracting).toBe(true);

    await act(async () => retry.resolve(receiptWithMessage));
    expect(hook.msgHash).toBe(MESSAGE_HASH);
    expect(hook.noMessageFound).toBe(false);
    expect(hook.isExtracting).toBe(false);
  });

  test("an older same-hash request cannot replace the retry result", async () => {
    const first = deferredReceipt();
    const retry = deferredReceipt();
    mocks.client.getTransactionReceipt.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    await render(<HookHarness />);
    await act(async () => hook.retryExtraction());
    await act(async () => retry.resolve(emptyReceipt));
    await act(async () => first.resolve(receiptWithMessage));

    expect(hook.message).toBeNull();
    expect(hook.msgHash).toBeNull();
    expect(hook.noMessageFound).toBe(true);
    expect(hook.isExtracting).toBe(false);
  });

  test.each(["success", "error"])("ignores a cancelled hash's late %s", async (outcome) => {
    const first = deferredReceipt();
    const second = deferredReceipt();
    mocks.client.getTransactionReceipt.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await render(<HookHarness />);
    await render(<HookHarness hash={TX_B} />);
    await act(async () => {
      if (outcome === "success") first.resolve(receiptWithMessage);
      else first.reject(new Error("stale RPC error"));
    });

    expect(hook.message).toBeNull();
    expect(hook.extractError).toBeNull();
    expect(hook.noMessageFound).toBe(false);
    expect(hook.isExtracting).toBe(true);
    expect(console.error).not.toHaveBeenCalled();

    await act(async () => second.resolve(emptyReceipt));
    expect(hook.noMessageFound).toBe(true);
    expect(hook.isExtracting).toBe(false);
  });

  test("losing the L1 client cancels extraction and clears the spinner", async () => {
    const request = deferredReceipt();
    mocks.client.getTransactionReceipt.mockReturnValueOnce(request.promise);
    await render(<HookHarness />);
    expect(hook.isExtracting).toBe(true);
    mocks.clientAvailable = false;
    await render(<HookHarness />);
    expect(hook.isExtracting).toBe(false);

    await act(async () => request.resolve(receiptWithMessage));
    expect(hook.message).toBeNull();
    expect(hook.msgHash).toBeNull();
  });
});

describe("L2 card wallet policy", () => {
  test.each(["no-message", "error"])("revokes Taiko for a terminal %s even with bridge actions", async (outcome) => {
    const request = deferredReceipt();
    mocks.client.getTransactionReceipt.mockReturnValueOnce(request.promise);
    await render(<Card />);
    expect(allowedChains()).toBe("167000");
    await act(async () => {
      if (outcome === "no-message") request.resolve(emptyReceipt);
      else request.reject(new Error("RPC unavailable"));
    });

    expect(allowedChains()).toBe("");
    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      outcome === "no-message"
        ? "No bridge message was found in the L1 execution transaction."
        : "Could not read the L1 transaction receipt."
    );
    expect(container.textContent).not.toContain("Execute L2 leg");
  });

  test("keeps a normal L1-only receipt hidden and revokes Taiko", async () => {
    mocks.client.getTransactionReceipt.mockResolvedValueOnce(emptyReceipt);
    await render(<Card actions={[]} />);
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[role=status]")).toBeNull();
    expect(allowedChains()).toBe("");
  });

  test("allows Taiko while waiting for anchor sync and after extraction, then revokes it on completion", async () => {
    mocks.isSynced = false;
    await render(<Card />);
    expect(container.textContent).toContain("Waiting for Taiko L2 to sync");
    expect(allowedChains()).toBe("167000");
    expect(mocks.client.getTransactionReceipt).not.toHaveBeenCalled();

    mocks.isSynced = true;
    mocks.client.getTransactionReceipt.mockResolvedValueOnce(receiptWithMessage);
    await render(<Card />);
    expect(container.querySelector("button")?.textContent).toBe("Execute L2 leg");
    expect(allowedChains()).toBe("167000");

    mocks.messageStatus = 2;
    await render(<Card />);
    expect(container.textContent).toContain("L2 leg has been executed successfully.");
    expect(allowedChains()).toBe("");
  });
});
