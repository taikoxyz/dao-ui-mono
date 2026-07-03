import { describe, expect, test } from "bun:test";
import { getApprovalButtonState } from "../utils/approval-eligibility";

describe("getApprovalButtonState", () => {
  test("shows checking state while the initial eligibility read is loading", () => {
    expect(getApprovalButtonState({ canApprove: false, isLoading: true, hasError: false })).toBe("checking");
  });

  test("shows retry when the read failed and there is no positive eligibility", () => {
    expect(getApprovalButtonState({ canApprove: false, isLoading: false, hasError: true })).toBe("retry");
  });

  test("shows unable when the read succeeded and denied eligibility", () => {
    expect(getApprovalButtonState({ canApprove: false, isLoading: false, hasError: false })).toBe("unable");
  });

  test("shows approve when the read succeeded and allowed eligibility", () => {
    expect(getApprovalButtonState({ canApprove: true, isLoading: false, hasError: false })).toBe("approve");
  });

  test("keeps approve when a later background refetch errors after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isLoading: false, hasError: true })).toBe("approve");
  });

  test("keeps approve even if a refetch reports loading after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isLoading: true, hasError: false })).toBe("approve");
  });

  test("prefers checking over retry while a retried read is still in flight", () => {
    expect(getApprovalButtonState({ canApprove: false, isLoading: true, hasError: true })).toBe("checking");
  });
});
