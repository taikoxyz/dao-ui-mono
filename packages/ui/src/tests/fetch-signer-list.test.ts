import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type Address, type PublicClient } from "viem";
import { type Config } from "@wagmi/core";
import { fetchSignerListFromChain } from "@/plugins/security-council/utils/fetchSignerList";

const mocks = vi.hoisted(() => ({ readContract: vi.fn(), query: vi.fn() }));
vi.mock("@wagmi/core", () => ({ readContract: mocks.readContract }));
vi.mock("@apollo/client", () => ({
  ApolloClient: class {
    query = mocks.query;
  },
  InMemoryCache: class {},
  gql: (query: TemplateStringsArray) => query,
}));
vi.mock("@/constants", () => ({
  PUB_CHAIN: { id: 1 },
  PUB_SIGNER_LIST_CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000001",
  PUB_DEPLOYMENT_BLOCK: 100n,
  PUB_SUBGRAPH_URL: "https://subgraph.example",
}));
vi.mock("@/utils/getSecurityCouncilMemberData", () => ({
  getSecurityCouncilDirectoryAddresses: () => ["0x00000000000000000000000000000000000000aA"],
}));

const KNOWN: Address = "0x00000000000000000000000000000000000000aA";
const INDEXED: Address = "0x00000000000000000000000000000000000000bb";
const UNKNOWN: Address = "0x00000000000000000000000000000000000000cc";
const config = {} as Config;
const getLogs = vi.fn();
const getBlockNumber = vi.fn();
const client = { getLogs, getBlockNumber } as unknown as PublicClient;
let members: Address[];

beforeEach(() => {
  vi.resetAllMocks();
  members = [KNOWN, INDEXED];
  getBlockNumber.mockResolvedValue(4200n);
  getLogs.mockResolvedValue([]);
  mocks.query.mockResolvedValue({ data: { signers: [{ id: KNOWN.toLowerCase() }, { id: INDEXED }] } });
  mocks.readContract.mockImplementation(async (_config, request) => {
    if (request.functionName === "addresslistLength") return BigInt(members.length);
    return members.some((member) => member.toLowerCase() === request.args[0].toLowerCase());
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("fetchSignerListFromChain", () => {
  test("validates directory and subgraph candidates without any log requests", async () => {
    expect(await fetchSignerListFromChain(client, config)).toEqual([KNOWN, INDEXED]);
    expect(getLogs).not.toHaveBeenCalled();
    expect(mocks.readContract).toHaveBeenCalledTimes(3);
    for (const [, request] of mocks.readContract.mock.calls) {
      expect(request).toMatchObject({ chainId: 1, blockNumber: 4200n });
    }
  });
  test("filters departed candidates even during a same-size membership change", async () => {
    members = [INDEXED, UNKNOWN];
    getLogs.mockResolvedValue([{ args: { signers: [UNKNOWN] } }]);
    expect(await fetchSignerListFromChain(client, config)).toEqual([INDEXED, UNKNOWN]);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });
  test("bounds discovery windows to the same snapshot as membership reads", async () => {
    members.push(UNKNOWN);
    getLogs.mockImplementation(async ({ toBlock }) =>
      toBlock === 4200n ? [{ args: { signers: [UNKNOWN, KNOWN] } }] : []
    );
    expect(await fetchSignerListFromChain(client, config)).toEqual([KNOWN, INDEXED, UNKNOWN]);
    expect(getLogs.mock.calls.map(([{ fromBlock, toBlock }]) => ({ fromBlock, toBlock }))).toEqual([
      { fromBlock: 100n, toBlock: 2099n },
      { fromBlock: 2100n, toBlock: 4099n },
      { fromBlock: 4100n, toBlock: 4200n },
    ]);
    expect(getBlockNumber).toHaveBeenCalledTimes(1);
    for (const [, request] of mocks.readContract.mock.calls) {
      expect(request).toMatchObject({ chainId: 1, blockNumber: 4200n });
    }
  });
  test("revalidates cached discoveries without replaying history", async () => {
    members.push(UNKNOWN);
    expect(await fetchSignerListFromChain(client, config, [UNKNOWN])).toEqual([KNOWN, UNKNOWN, INDEXED]);
    expect(getLogs).not.toHaveBeenCalled();
  });
  test("can use directory members while the subgraph is unavailable", async () => {
    members = [KNOWN];
    mocks.query.mockRejectedValue(new Error("subgraph offline"));
    expect(await fetchSignerListFromChain(client, config)).toEqual([KNOWN]);
    expect(getLogs).not.toHaveBeenCalled();
  });
  test("returns verified members and warns when discovery fails", async () => {
    members.push(UNKNOWN);
    getLogs.mockRejectedValue(new Error("log provider unavailable"));
    expect(await fetchSignerListFromChain(client, config)).toEqual([KNOWN, INDEXED]);
    expect(console.warn).toHaveBeenCalled();
  });
  test("keeps a verified partial roster when the log history is incomplete", async () => {
    members.push(UNKNOWN);
    expect(await fetchSignerListFromChain(client, config)).toEqual([KNOWN, INDEXED]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("2 of 3"));
  });
  test("surfaces authoritative RPC failures instead of trusting candidate data", async () => {
    mocks.readContract.mockRejectedValue(new Error("L1 unavailable"));
    await expect(fetchSignerListFromChain(client, config)).rejects.toThrow("L1 unavailable");
    expect(getLogs).not.toHaveBeenCalled();
  });
});
