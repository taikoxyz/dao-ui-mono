import { describe, expect, test } from "bun:test";
import { ApprovalButtonState, getApprovalButtonState } from "../utils/approval-eligibility";

describe("getApprovalButtonState", () => {
  test("shows checking while the initial eligibility read is in flight", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: true, hasError: false })).toBe(
      ApprovalButtonState.CHECKING
    );
  });

  test("shows retry when the read failed and eligibility was never determined", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: false, hasError: true })).toBe(
      ApprovalButtonState.RETRY
    );
  });

  test("shows checking while a retried read is in flight after a failure", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: true, hasError: true })).toBe(
      ApprovalButtonState.CHECKING
    );
  });

  test("shows unable when the read never ran and there is no error (e.g. disconnected wallet)", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: false, hasError: false })).toBe(
      ApprovalButtonState.UNABLE
    );
  });

  test("shows unable when the read succeeded and denied eligibility", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: false, hasError: false })).toBe(
      ApprovalButtonState.UNABLE
    );
  });

  test("keeps unable when a later background refetch errors after a confirmed denial", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: false, hasError: true })).toBe(
      ApprovalButtonState.UNABLE
    );
  });

  test("keeps unable while a background refetch runs after a confirmed denial", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: true, hasError: false })).toBe(
      ApprovalButtonState.UNABLE
    );
  });

  test("shows approve when the read succeeded and allowed eligibility", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: false, hasError: false })).toBe(
      ApprovalButtonState.APPROVE
    );
  });

  test("keeps approve when a later background refetch errors after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: false, hasError: true })).toBe(
      ApprovalButtonState.APPROVE
    );
  });

  test("keeps approve while a background refetch runs after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: true, hasError: false })).toBe(
      ApprovalButtonState.APPROVE
    );
  });
});
