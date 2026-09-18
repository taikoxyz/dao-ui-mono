import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountList } from "@/plugins/security-council/components/AccountList";

const state = vi.hoisted(() => ({ signers: vi.fn(), encryption: vi.fn() }));
vi.mock("@/plugins/security-council/hooks/useSignerList", () => ({ useSignerList: state.signers }));
vi.mock("@/plugins/security-council/hooks/useEncryptionAccounts", () => ({ useEncryptionAccounts: state.encryption }));
vi.mock("@/plugins/security-council/components/AccountListItem", () => ({
  AccountListItemPending: ({ owner }: { owner: string }) => <div>Unknown key status: {owner}</div>,
  AccountListItemReady: ({ owner }: { owner: string }) => <div>Ready: {owner}</div>,
}));
vi.mock("@aragon/ods", () => ({
  AlertInline: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  CardEmptyState: ({ description }: { description: string }) => <div>{description}</div>,
  DataList: {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Container: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Filter: ({ placeholder }: { placeholder: string }) => <input placeholder={placeholder} />,
  },
}));
vi.mock("@/components/please-wait", () => ({ PleaseWaitSpinner: () => <div>Loading</div> }));
const MEMBER = "0x00000000000000000000000000000000000000aa";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  state.signers.mockReturnValue({ data: [MEMBER], isLoading: false, error: null });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

test.each([undefined, [{ owner: MEMBER, publicKey: `0x${"11".repeat(32)}` }]])(
  "keeps members visible with a registry error, ignoring stale keys: %j",
  (data) => {
    state.encryption.mockReturnValue({ data, isLoading: false, error: new Error("Registry offline") });
    act(() => root.render(<AccountList />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Member key status is unavailable");
    expect(container.textContent).toContain(MEMBER);
    expect(container.textContent).not.toContain("Ready:");
    expect(container.querySelector("input")?.placeholder).toBe("Filter by name or address");
  }
);

test("renders current keys without a warning when the registry read succeeds", () => {
  state.encryption.mockReturnValue({
    data: [{ owner: MEMBER, publicKey: `0x${"11".repeat(32)}` }],
    isLoading: false,
    error: null,
  });
  act(() => root.render(<AccountList />));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain(`Ready: ${MEMBER}`);
});
