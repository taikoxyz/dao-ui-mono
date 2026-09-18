import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountList } from "@/plugins/security-council/components/AccountList";
import { BYTES32_ZERO } from "@/utils/evm";

const mocks = vi.hoisted(() => ({ roster: vi.fn(), registry: vi.fn() }));
vi.mock("@/plugins/security-council/hooks/useSignerList", () => ({ useSignerList: mocks.roster }));
vi.mock("@/plugins/security-council/hooks/useEncryptionAccounts", () => ({ useEncryptionAccounts: mocks.registry }));
vi.mock("@/plugins/security-council/components/AccountListItem", () => ({
  AccountListItemPending: ({ owner }: { owner: string }) => <div data-state="pending">{owner}</div>,
  AccountListItemReady: ({ owner }: { owner: string }) => <div data-state="ready">{owner}</div>,
}));
vi.mock("@aragon/ods", () => ({
  AlertInline: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  CardEmptyState: ({ heading, description }: { heading: string; description: string }) => (
    <div>
      {heading}: {description}
    </div>
  ),
  DataList: {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Container: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Filter: () => <input />,
  },
}));
vi.mock("@/components/please-wait", () => ({ PleaseWaitSpinner: () => <div role="status">Loading</div> }));

const MEMBER = "0x00000000000000000000000000000000000000aa";
const KEY = `0x${"11".repeat(32)}`;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  root = createRoot(container);
  mocks.roster.mockReturnValue({ data: [MEMBER], isLoading: false, error: null });
  mocks.registry.mockReturnValue({ data: [], isLoading: false, error: null });
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});
const render = () => act(() => root.render(<AccountList />));

test("shows listed members before anyone registers an encryption key", () => {
  render();
  expect(container.querySelector('[data-state="pending"]')?.textContent).toBe(MEMBER);
  expect(container.textContent).not.toContain("No members listed");
});
test("treats a zero public key as unregistered", () => {
  mocks.registry.mockReturnValue({ data: [{ owner: MEMBER, publicKey: BYTES32_ZERO }], isLoading: false, error: null });
  render();
  expect(container.querySelector('[data-state="pending"]')?.textContent).toBe(MEMBER);
  expect(container.querySelector('[data-state="ready"]')).toBeNull();
});
test("renders a registered member as ready", () => {
  mocks.registry.mockReturnValue({ data: [{ owner: MEMBER, publicKey: KEY }], isLoading: false, error: null });
  render();
  expect(container.querySelector('[data-state="ready"]')?.textContent).toBe(MEMBER);
});
test("uses the roster to show the empty state even if historical keys remain", () => {
  mocks.roster.mockReturnValue({ data: [], isLoading: false, error: null });
  mocks.registry.mockReturnValue({ data: [{ owner: MEMBER, publicKey: KEY }], isLoading: false, error: null });
  render();
  expect(container.textContent).toContain("No members listed");
  expect(container.querySelector("[data-state]")).toBeNull();
});
test.each([undefined, [{ owner: MEMBER, publicKey: KEY }]])(
  "a registry outage preserves the roster and marks key status unavailable (cached data: %j)",
  (data) => {
    mocks.registry.mockReturnValue({ data, isLoading: false, error: new Error("Registry unavailable") });
    render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("key status is unavailable");
    expect(container.querySelector('[data-state="pending"]')?.textContent).toBe(MEMBER);
    expect(container.querySelector('[data-state="ready"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  }
);
test("shows a roster error instead of presenting registry accounts as members", () => {
  mocks.roster.mockReturnValue({ data: undefined, isLoading: false, error: new Error("Subgraph unavailable") });
  mocks.registry.mockReturnValue({ data: [{ owner: MEMBER, publicKey: KEY }], isLoading: false, error: null });
  render();
  expect(container.textContent).toContain("Subgraph unavailable");
  expect(container.querySelector("[data-state]")).toBeNull();
});
test("keeps listed members visible while the initial registry read is pending", () => {
  mocks.registry.mockReturnValue({ data: undefined, isLoading: true, error: null });
  render();
  expect(container.querySelector('[data-state="pending"]')?.textContent).toBe(MEMBER);
  expect(container.querySelector('[data-state="ready"]')).toBeNull();
});
