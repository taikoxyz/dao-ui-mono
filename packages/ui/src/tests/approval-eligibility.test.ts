import { describe, expect, test } from "bun:test";
import { getApprovalButtonState } from "../utils/approval-eligibility";

describe("getApprovalButtonState", () => {
  test("shows checking while the initial eligibility read is in flight", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: true, hasError: false })).toBe("checking");
  });

  test("shows retry when the read failed and eligibility was never determined", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: false, hasError: true })).toBe("retry");
  });

  test("shows checking while a retried read is in flight after a failure", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: true, hasError: true })).toBe("checking");
  });

  test("shows unable when the read never ran and there is no error (e.g. disconnected wallet)", () => {
    expect(getApprovalButtonState({ canApprove: undefined, isFetching: false, hasError: false })).toBe("unable");
  });

  test("shows unable when the read succeeded and denied eligibility", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: false, hasError: false })).toBe("unable");
  });

  test("keeps unable when a later background refetch errors after a confirmed denial", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: false, hasError: true })).toBe("unable");
  });

  test("keeps unable while a background refetch runs after a confirmed denial", () => {
    expect(getApprovalButtonState({ canApprove: false, isFetching: true, hasError: false })).toBe("unable");
  });

  test("shows approve when the read succeeded and allowed eligibility", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: false, hasError: false })).toBe("approve");
  });

  test("keeps approve when a later background refetch errors after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: false, hasError: true })).toBe("approve");
  });

  test("keeps approve while a background refetch runs after a positive read", () => {
    expect(getApprovalButtonState({ canApprove: true, isFetching: true, hasError: false })).toBe("approve");
  });
});
