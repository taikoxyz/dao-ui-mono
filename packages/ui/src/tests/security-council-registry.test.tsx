import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountList } from "@/plugins/security-council/components/AccountList";
import { useEncryptionAccounts } from "@/plugins/security-council/hooks/useEncryptionAccounts";

const mocks = vi.hoisted(() => ({ query: vi.fn(), readContract: vi.fn() }));
vi.mock("@apollo/client", () => ({
  ApolloClient: class {
    query = mocks.query;
  },
  InMemoryCache: class {},
  gql: (q: string) => q,
}));
vi.mock("@wagmi/core", () => ({ readContract: mocks.readContract }));
vi.mock("@/constants", () => ({
  PUB_CHAIN: { id: 1, blockExplorers: { default: { url: "https://etherscan.io" } } },
  PUB_SIGNER_LIST_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
  PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000002",
  PUB_SUBGRAPH_URL: "https://subgraph.example",
}));
vi.mock("wagmi", () => ({
  useConfig: () => ({}),
  useAccount: () => ({ isConnected: false, chain: { id: 167000 } }),
  usePublicClient: () => ({ chain: { id: 167000 }, getCode: async () => "0x" }),
}));
vi.mock("@/components/text/address", () => ({
  AddressText: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock("@aragon/ods", () => ({
  AlertInline: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  CardEmptyState: ({ heading, description }: { heading: string; description: string }) => (
    <div>
      {heading}: {description}
    </div>
  ),
  MemberAvatar: () => null,
  Tag: ({ label }: { label: string }) => <span>{label}</span>,
  DataList: {
    Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Container: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Item: ({ children }: React.PropsWithChildren) => <article>{children}</article>,
    Filter: () => <input />,
  },
}));
vi.mock("@/components/please-wait", () => ({ PleaseWaitSpinner: () => <div role="status">Loading</div> }));
const MEMBER = "0x000000000000000000000000000000000000dead";
const KEY = `0x${"11".repeat(32)}`;
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let accounts: ReturnType<typeof useEncryptionAccounts>;
function RegistryProbe() {
  accounts = useEncryptionAccounts();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.query.mockReset().mockResolvedValue({ data: { signers: [{ id: MEMBER }] } });
  mocks.readContract.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 5, gcTime: Infinity } } });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function render(content: React.ReactNode) {
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{content}</QueryClientProvider>);
  });
}
async function until(assertion: () => void) {
  // Advance retries and query notifications inside act, with a bounded deadline.
  for (let elapsed = 0; elapsed < 1000; elapsed += 10) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    try {
      assertion();
      return;
    } catch (error) {
      if (elapsed === 990) throw error;
    }
  }
}

test("a registry failure settles without hiding/remounting the real member rows", async () => {
  mocks.readContract.mockRejectedValue(new Error("Registry unavailable"));
  await render(<AccountList />);
  await until(() => {
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("key status is unavailable");
    expect(container.querySelector("article")?.textContent).toContain("Cannot load status");
  });
  expect(mocks.readContract).toHaveBeenCalledTimes(3);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(mocks.readContract).toHaveBeenCalledTimes(3);
  expect(container.querySelector("article")?.textContent).toContain("0x0000...dead");
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test.each([false, true])("a page remount recovers after an outage (cached keys: %s)", async (cachedKeys) => {
  if (cachedKeys) {
    client.setQueryData(
      ["encryption-registry-accounts-fetch", 1, "0x0000000000000000000000000000000000000002"],
      [{ owner: MEMBER, appointedAgent: "0x0000000000000000000000000000000000000000", publicKey: KEY }],
      { updatedAt: Date.now() - 300_001 }
    );
  }
  mocks.readContract.mockRejectedValue(new Error("Registry unavailable"));
  await render(<AccountList />);
  await until(() => {
    expect(container.querySelector("article")?.textContent).toContain("Cannot load status");
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(mocks.readContract).toHaveBeenCalledTimes(3);

  // Keep the same query client, as navigation does, while the RPC recovers.
  await render(null);
  mocks.readContract.mockImplementation(async (_config, request) =>
    request.functionName === "getRegisteredAccounts" ? [MEMBER] : ["0x0000000000000000000000000000000000000000", KEY]
  );
  await render(<AccountList />);
  await until(() => {
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector("article")?.textContent).toContain("Self-appointed");
  });
  expect(mocks.readContract).toHaveBeenCalledTimes(5);
});

test("unknown listed members have a visible address heading before registration", async () => {
  mocks.readContract.mockResolvedValue([]);
  await render(<AccountList />);
  await until(() => {
    const heading = container.querySelector("article p.text-lg");
    expect(heading?.textContent).toBe("0x0000...dead");
    expect(container.querySelector("article")?.textContent).toContain("define a public key");
  });
});

test("registry account discovery and key reads stay on L1 while the wallet is on Taiko", async () => {
  mocks.readContract.mockImplementation(async (_config, request) =>
    request.functionName === "getRegisteredAccounts" ? [MEMBER] : ["0x0000000000000000000000000000000000000000", KEY]
  );
  await render(<RegistryProbe />);
  await until(() => expect(accounts.data?.[0]?.publicKey).toBe(KEY));
  expect(mocks.readContract).toHaveBeenCalledTimes(2);
  for (const [, request] of mocks.readContract.mock.calls) expect(request.chainId).toBe(1);
});
