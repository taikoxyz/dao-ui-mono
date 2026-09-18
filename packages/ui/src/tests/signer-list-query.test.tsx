import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useSignerList as useCouncilSigners } from "@/plugins/security-council/hooks/useSignerList";
import { useSignerList as useDelegateSigners } from "@/plugins/delegates/hooks/useSignerList";

const mocks = vi.hoisted(() => ({ query: vi.fn(), getLogs: vi.fn() }));
vi.mock("@apollo/client", () => ({
  ApolloClient: class {
    query = mocks.query;
  },
  InMemoryCache: class {},
  gql: (q: string) => q,
}));
vi.mock("@/constants", () => ({
  PUB_CHAIN: { id: 1 },
  PUB_DEPLOYMENT_BLOCK: 100n,
  PUB_SIGNER_LIST_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
  PUB_SUBGRAPH_URL: "https://subgraph.example",
}));
vi.mock("wagmi", () => ({
  useConfig: () => ({}),
  usePublicClient: () => ({ getBlockNumber: async () => 101n, getLogs: mocks.getLogs }),
}));
const MEMBER = "0x00000000000000000000000000000000000000aa";
const OLD_MEMBER = "0x00000000000000000000000000000000000000bb";
let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
function Council() {
  const { data } = useCouncilSigners();
  return <output data-page="council">{data?.join(",")}</output>;
}
function Delegates() {
  const { data } = useDelegateSigners();
  return <output data-page="delegates">{data?.join(",")}</output>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.query.mockReset().mockResolvedValue({ data: { signers: [{ id: MEMBER }] } });
  mocks.getLogs
    .mockReset()
    .mockImplementation(async ({ event }) =>
      event.name === "SignersAdded" ? [{ blockNumber: 100n, logIndex: 0, args: { signers: [OLD_MEMBER] } }] : []
    );
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function render(delegateFirst: boolean) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        {delegateFirst ? (
          <>
            <Delegates />
            <Council />
          </>
        ) : (
          <>
            <Council />
            <Delegates />
          </>
        )}
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
}

test.each([true, false])(
  "both pages show the same subgraph members regardless of mount order (delegates first: %s)",
  async (delegateFirst) => {
    await render(delegateFirst);
    expect(container.querySelector('[data-page="council"]')?.textContent).toBe(MEMBER);
    expect(container.querySelector('[data-page="delegates"]')?.textContent).toBe(MEMBER);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.getLogs).not.toHaveBeenCalled();
  }
);
test("does not reuse a cached roster produced by a different source", async () => {
  client.setQueryData(["signer-list-fetch", "0x0000000000000000000000000000000000000001"], [OLD_MEMBER]);
  await render(false);
  expect(container.querySelector('[data-page="council"]')?.textContent).toBe(MEMBER);
  expect(container.querySelector('[data-page="delegates"]')?.textContent).toBe(MEMBER);
  expect(mocks.query).toHaveBeenCalledTimes(1);
});
