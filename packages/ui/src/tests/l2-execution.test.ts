import { describe, expect, test } from "bun:test";
import {
  getConfirmedL2MessageOutcome,
  shouldRenderL2ExecutionCard,
} from "../utils/l2-execution";

describe("shouldRenderL2ExecutionCard", () => {
  test("keeps the card visible while an executed proposal with a tx hash is still being checked", () => {
    expect(
      shouldRenderL2ExecutionCard({
        hasL2Leg: false,
        isExtracting: false,
        shouldCheckExecutedProposal: true,
      })
    ).toBe(true);
  });

  test("hides the card when there is no detected L2 leg and no active check", () => {
    expect(
      shouldRenderL2ExecutionCard({
        hasL2Leg: false,
        isExtracting: false,
        shouldCheckExecutedProposal: false,
      })
    ).toBe(false);
  });
});

describe("getConfirmedL2MessageOutcome", () => {
  test("treats DONE as a success", () => {
    expect(getConfirmedL2MessageOutcome(2)).toBe("success");
  });

  test("treats FAILED as a failure", () => {
    expect(getConfirmedL2MessageOutcome(3)).toBe("failed");
  });

  test("treats all other statuses as pending bridge processing", () => {
    expect(getConfirmedL2MessageOutcome(0)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(1)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(4)).toBe("pending");
    expect(getConfirmedL2MessageOutcome(undefined)).toBe("pending");
  });
});
