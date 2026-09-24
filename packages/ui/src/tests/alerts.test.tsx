import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AlertProvider, useAlerts, type AlertContextProps } from "@/context/Alerts";
import { useProposalApprove as useStandardApprove } from "@/plugins/multisig/hooks/useProposalApprove";
import { useProposalApprove as useEmergencyApprove } from "@/plugins/emergency-multisig/hooks/useProposalApprove";

const mocks = vi.hoisted(() => {
  const refetchProposal = vi.fn();
  const refetchApprovals = vi.fn();
  const refetchCanApprove = vi.fn();
  return {
    txHash: `0x${"ab".repeat(32)}`,
    receipt: { isLoading: true, isSuccess: false },
    push: vi.fn(),
    refetchProposal,
    refetchApprovals,
    refetchCanApprove,
    // The data hooks of both plugins, with stable refetchers like TanStack Query's.
    proposalHooks: {
      useProposal: () => ({ proposal: null, status: {}, refetch: refetchProposal }),
      useProposalApprovals: () => ({ data: [], refetch: refetchApprovals }),
      useUserCanApprove: () => ({ canApprove: true, isFetching: false, error: null, refetch: refetchCanApprove }),
    },
  };
});

vi.mock("@/constants", () => ({
  PUB_MULTISIG_PLUGIN_ADDRESS: "0x0000000000000000000000000000000000000001",
  PUB_EMERGENCY_MULTISIG_PLUGIN_ADDRESS: "0x0000000000000000000000000000000000000002",
}));
vi.mock("next/router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("wagmi", () => ({
  usePublicClient: () => ({ chain: { blockExplorers: { default: { url: "https://etherscan.io" } } } }),
  // The approval is already signed; each test drives its receipt.
  useWriteContract: () => ({ writeContract: vi.fn(), data: mocks.txHash, error: null, status: "success" }),
  useWaitForTransactionReceipt: () => mocks.receipt,
}));
vi.mock("@/plugins/multisig/hooks/useProposal", () => mocks.proposalHooks);
vi.mock("@/plugins/multisig/hooks/useProposalApprovals", () => mocks.proposalHooks);
vi.mock("@/plugins/multisig/hooks/useUserCanApprove", () => mocks.proposalHooks);
vi.mock("@/plugins/emergency-multisig/hooks/useProposal", () => mocks.proposalHooks);
vi.mock("@/plugins/emergency-multisig/hooks/useProposalApprovals", () => mocks.proposalHooks);
vi.mock("@/plugins/emergency-multisig/hooks/useUserCanApprove", () => mocks.proposalHooks);

const RENDER_LIMIT = 50;
const TX_A = `0x${"11".repeat(32)}`;
const TX_B = `0x${"22".repeat(32)}`;

let container: HTMLDivElement;
let root: Root;
let api: AlertContextProps;
let probeRenders: number;
let approveRenders: number;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  // The approval hooks scroll to the top after navigating; jsdom does not implement it.
  vi.spyOn(window, "scroll").mockImplementation(() => undefined);
  mocks.receipt = { isLoading: true, isSuccess: false };
  probeRenders = 0;
  approveRenders = 0;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type UseApprove = (proposalId: string) => unknown;

function AlertsProbe({ useApprove }: { useApprove?: UseApprove }) {
  probeRenders++;
  api = useAlerts();
  // Unmount the approval hook once it re-renders in a loop, so a regression fails
  // the assertions instead of hanging the run.
  return useApprove && approveRenders < RENDER_LIMIT ? <ApproveProbe useApprove={useApprove} /> : null;
}
function ApproveProbe({ useApprove }: { useApprove: UseApprove }) {
  approveRenders++;
  useApprove("1");
  return null;
}

async function render(useApprove?: UseApprove) {
  await act(async () => {
    root.render(
      <AlertProvider>
        <AlertsProbe useApprove={useApprove} />
      </AlertProvider>
    );
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
const messages = () => api.alerts.map((alert) => alert.message);

describe.each([
  ["standard", useStandardApprove],
  ["emergency", useEmergencyApprove],
])("approving a %s proposal", (_kind, useApprove) => {
  test("shows a single alert while the transaction confirms", async () => {
    await render(useApprove);
    await advance(3000);

    expect(messages()).toEqual(["Approval submitted"]);
    expect(approveRenders).toBeLessThan(5);
  });

  test("handles the confirmation once", async () => {
    await render(useApprove);
    mocks.receipt = { isLoading: false, isSuccess: true };
    await render(useApprove);
    await advance(2000);

    expect(messages()).toEqual(["Approval submitted", "Approval registered"]);
    expect(mocks.refetchProposal).toHaveBeenCalledTimes(1);
    expect(mocks.refetchApprovals).toHaveBeenCalledTimes(1);
    expect(mocks.refetchCanApprove).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });
});

describe("AlertProvider", () => {
  test("keeps addAlert stable, and a repeat of an alert on screen changes nothing", async () => {
    await render();
    const { addAlert } = api;
    await act(async () => addAlert("Approval submitted", { description: "Waiting", txHash: TX_A }));
    expect(api.addAlert).toBe(addAlert);

    const renders = probeRenders;
    await act(async () => addAlert("Approval submitted", { description: "Waiting", txHash: TX_A }));
    expect(probeRenders).toBe(renders);
    expect(api.alerts).toEqual([
      {
        id: expect.any(Number),
        message: "Approval submitted",
        description: "Waiting",
        type: "info",
        explorerLink: `https://etherscan.io/tx/${TX_A}`,
      },
    ]);
  });

  test("a repeat pushes back the dismissal of the alert on screen", async () => {
    await render();
    await act(async () => api.addAlert("Saved"));
    await advance(5000);
    await act(async () => api.addAlert("Saved"));
    expect(messages()).toEqual(["Saved"]);
    await advance(5000);
    expect(messages()).toEqual(["Saved"]);
    await advance(2000);
    expect(messages()).toEqual([]);
  });

  test("keeps alerts for different transactions apart", async () => {
    await render();
    await act(async () => {
      api.addAlert("Transaction submitted", { txHash: TX_A });
      api.addAlert("Transaction submitted", { txHash: TX_B });
    });
    expect(api.alerts.map((alert) => alert.explorerLink)).toEqual([
      `https://etherscan.io/tx/${TX_A}`,
      `https://etherscan.io/tx/${TX_B}`,
    ]);
  });

  test("dismisses alerts raised in the same millisecond independently", async () => {
    await render();
    await act(async () => {
      api.addAlert("First", { timeout: 1000 });
      api.addAlert("Second", { timeout: 3000 });
    });
    await advance(1000);
    expect(messages()).toEqual(["Second"]);
    await advance(2000);
    expect(messages()).toEqual([]);
  });
});
