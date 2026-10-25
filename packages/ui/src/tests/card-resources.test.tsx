import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CardResources } from "@/components/proposal/cardResources";
import { IGqlProposalMixin } from "@/utils/gql/types";

vi.mock("@aragon/ods", () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardEmptyState: ({ heading }: { heading: string }) => <div>{heading}</div>,
  Heading: ({ children }: React.PropsWithChildren) => <h4>{children}</h4>,
  IconType: { LINK_EXTERNAL: "link-external" },
  Link: ({
    children,
    href,
    target,
  }: React.PropsWithChildren<{ href?: string; target?: string; variant?: string; iconRight?: string }>) => (
    <a href={href} target={target}>
      {children}
    </a>
  ),
}));

vi.mock("@/plugins/security-council/hooks/useEncryptionAccounts", () => ({
  useEncryptionAccounts: () => ({ data: [] }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

const renderCard = (props: React.ComponentProps<typeof CardResources>) => {
  act(() => {
    root.render(<CardResources {...props} />);
  });
};

describe("CardResources (TransactionsCard)", () => {
  test("renders optimistic proposal actual executor, not the stage-1 antecedent executor (Issue #193)", () => {
    const optimisticProposal: IGqlProposalMixin = {
      id: "opt-31",
      proposalId: "31",
      metadata: "",
      creator: "0xd7da1c25e915438720692bc55eb3a7170ca90321",
      creationTxHash: "0x172d0490ba0561708314e60e9982b3d6b8af6f910c70f49909422c60760dd99a",
      creationBlockNumber: 25331762,
      executionBlockNumber: 25456593,
      isOptimistic: true,
      isStandard: false,
      isEmergency: false,
      executor: {
        id: "exec-1",
        address: "0xa338378fdd2d1c8d911a367bf1e8bd69a490d1bb",
        txHash: "0xa3c1d4107e01bd81e80d392d0a04bd472fa497facd3abe105ac24a0a12ed7beb",
      },
      approvers: [],
      vetoes: [],
    };

    const relatedProposal: IGqlProposalMixin = {
      id: "std-20",
      proposalId: "20",
      metadata: "",
      creator: "0xac5898b0fffd23f4ef09f0e50fa1bc4896ef7163",
      creationTxHash: "0xcreationdraft",
      creationBlockNumber: 25300000,
      executionBlockNumber: 25331762,
      isOptimistic: false,
      isStandard: true,
      isEmergency: false,
      executor: {
        id: "antecedent-exec",
        address: "0x824dce8d292a393dab5ffdeb788dc1086257f678",
        txHash: "0x172d0490ba0561708314e60e9982b3d6b8af6f910c70f49909422c60760dd99a",
      },
      approvers: [],
      vetoes: [],
    };

    renderCard({
      title: "Resources",
      gqlProposal: optimisticProposal,
      relatedProposal: relatedProposal,
      resources: [],
    });

    const links = Array.from(container.querySelectorAll("a"));
    const hrefs = links.map((l) => l.getAttribute("href"));

    // Must link to the actual executor of the proposal (lianwu.eth: 0xa338...)
    expect(hrefs).toContain("https://etherscan.io/address/0xa338378fdd2d1c8d911a367bf1e8bd69a490d1bb");
    expect(hrefs).toContain(
      "https://etherscan.io/tx/0xa3c1d4107e01bd81e80d392d0a04bd472fa497facd3abe105ac24a0a12ed7beb"
    );

    // Must NOT link to the antecedent executor
    expect(hrefs).not.toContain("https://etherscan.io/address/0x824dce8d292a393dab5ffdeb788dc1086257f678");

    // Executor label must display shortened address, not empty string
    const execLink = links.find((l) => l.getAttribute("href")?.includes("0xa338378fdd2d1c8d911a367bf1e8bd69a490d1bb"));
    expect(execLink?.textContent).toBe("0xa338...d1bb");
  });

  test("hides execution row for unexecuted optimistic proposal even when relatedProposal has an executor", () => {
    const unexecutedOptimisticProposal: IGqlProposalMixin = {
      id: "opt-32",
      proposalId: "32",
      metadata: "",
      creator: "0xd7da1c25e915438720692bc55eb3a7170ca90321",
      creationTxHash: "0xcreationtx",
      creationBlockNumber: 25331762,
      executionBlockNumber: 0,
      isOptimistic: true,
      isStandard: false,
      isEmergency: false,
      executor: undefined,
      approvers: [],
      vetoes: [],
    };

    const relatedProposal: IGqlProposalMixin = {
      id: "std-21",
      proposalId: "21",
      metadata: "",
      creator: "0xac5898b0fffd23f4ef09f0e50fa1bc4896ef7163",
      creationTxHash: "0xcreationdraft",
      creationBlockNumber: 25300000,
      executionBlockNumber: 25331762,
      isOptimistic: false,
      isStandard: true,
      isEmergency: false,
      executor: {
        id: "antecedent-exec",
        address: "0x824dce8d292a393dab5ffdeb788dc1086257f678",
        txHash: "0x172d0490ba0561708314e60e9982b3d6b8af6f910c70f49909422c60760dd99a",
      },
      approvers: [],
      vetoes: [],
    };

    renderCard({
      title: "Resources",
      gqlProposal: unexecutedOptimisticProposal,
      relatedProposal: relatedProposal,
      resources: [],
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("Execution");
  });

  test("renders standard multisig executor correctly when relatedProposal is undefined", () => {
    const standardProposal: IGqlProposalMixin = {
      id: "std-10",
      proposalId: "10",
      metadata: "",
      creator: "0x1111111111111111111111111111111111111111",
      creationTxHash: "0xcreate10",
      creationBlockNumber: 25000000,
      executionBlockNumber: 25001000,
      isOptimistic: false,
      isStandard: true,
      isEmergency: false,
      executor: {
        id: "exec-std",
        address: "0x2222222222222222222222222222222222222222",
        txHash: "0xexec10",
      },
      approvers: [],
      vetoes: [],
    };

    renderCard({
      title: "Resources",
      gqlProposal: standardProposal,
      resources: [],
    });

    const links = Array.from(container.querySelectorAll("a"));
    const hrefs = links.map((l) => l.getAttribute("href"));

    expect(hrefs).toContain("https://etherscan.io/address/0x2222222222222222222222222222222222222222");
    expect(hrefs).toContain("https://etherscan.io/tx/0xexec10");
  });
});
