import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VotingDetails } from "@/components/proposalVoting/votingDetails/votingDetails";
import { CommunityVetoStage } from "@/plugins/optimistic-proposals/components/vote/community-veto-stage";
import { formatExactTokenAmount } from "@/utils/numbers";

vi.mock("@/constants", () => ({
  PUB_CHAIN: {
    blockExplorers: { default: { url: "https://etherscan.io" } },
  },
  PUB_TOKEN_ADDRESS: "0x10dea67478c5f8c5e2d90e5e9b26dbe60c54d800",
}));

describe("formatExactTokenAmount helper", () => {
  test("preserves fractional precision and groups integer thousands", () => {
    expect(formatExactTokenAmount("1000000000.000000000000000001")).toBe("1,000,000,000.000000000000000001");
    expect(formatExactTokenAmount("1234567")).toBe("1,234,567");
    expect(formatExactTokenAmount("0.123456789")).toBe("0.123456789");
    expect(formatExactTokenAmount("")).toBe("-");
  });
});

describe("Proposal Total Voting Power Display (Issue #71)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("VotingDetails renders Total Voting Power when supplied with exact title", () => {
    // 1 Billion TAIKO plus 1 wei
    const supply = 1_000_000_000n * 10n ** 18n + 1n;

    act(() => {
      root.render(
        <VotingDetails
          endDate="Oct 30, 2026"
          snapshotTakenAt="Block 20000000"
          options="Veto / Pass"
          strategy="Token-based veto"
          totalVotingPower={supply}
          tokenSymbol="TAIKO"
        />
      );
    });

    expect(container.textContent).toContain("Total Voting Power");
    expect(container.textContent).toContain("1.00B TAIKO");
    // Verify exact tooltip title preserved with 18 decimal places
    const elem = container.querySelector('[title*="1,000,000,000.000000000000000001 TAIKO"]');
    expect(elem).not.toBeNull();
  });

  test("VotingDetails hides Total Voting Power when undefined", () => {
    act(() => {
      root.render(
        <VotingDetails
          endDate="Oct 30, 2026"
          snapshotTakenAt="Block 20000000"
          options="Veto / Pass"
          strategy="Token-based veto"
        />
      );
    });

    expect(container.textContent).not.toContain("Total Voting Power");
  });

  test("CommunityVetoStage renders Total Voting Power card and detail item", () => {
    const supply = 1_000_000_000n * 10n ** 18n;
    const vetoCount = 5_000_000n * 10n ** 18n;

    act(() => {
      root.render(
        <CommunityVetoStage
          vetoCount={vetoCount}
          totalSupply={supply}
          threshold={0.15}
          status="active"
          tokenSymbol="TAIKO"
          snapshotBlock={20000000}
        />
      );
    });

    expect(container.textContent).toContain("Total Voting Power");
    expect(container.textContent).toContain("1.00B");
  });

  test("CommunityVetoStage keeps unresolved supply (0n) distinct from zero", () => {
    act(() => {
      root.render(
        <CommunityVetoStage
          vetoCount={0n}
          totalSupply={0n}
          threshold={0.15}
          status="active"
          tokenSymbol="TAIKO"
          snapshotBlock={20000000}
        />
      );
    });

    // Should display "-" placeholder instead of misleading "0 TAIKO"
    expect(container.textContent).toContain("Total Voting Power");
    expect(container.textContent).not.toContain("0.00B");
  });
});
