import { describe, expect, it } from "vitest";
import { parseAbiItem, type Address, type PublicClient } from "viem";
import { getLogsUntilNow } from "@/utils/evm";

const WINDOW = 2000n;
const CONTRACT = "0x0000000000000000000000000000000000001234" as Address;
const event = parseAbiItem("event VetoCast(uint256 indexed proposalId, address indexed voter, uint256 votingPower)");

type FakeLog = { blockNumber: bigint; logIndex: number };
type Range = { fromBlock: bigint; toBlock: bigint };

// A public client whose logs live at fixed block heights. getLogs returns every
// fixture log inside the requested inclusive range and records the range, so a
// test can check both what came back and how the range was paged.
function fakeClient(head: bigint, logBlocks: bigint[]) {
  const ranges: Range[] = [];
  const client = {
    getBlockNumber: async () => head,
    getLogs: async ({ fromBlock, toBlock }: Range) => {
      ranges.push({ fromBlock, toBlock });
      return logBlocks
        .filter((block) => block >= fromBlock && block <= toBlock)
        .map((block, index): FakeLog => ({ blockNumber: block, logIndex: index }));
    },
  };
  return { client: client as unknown as PublicClient, ranges };
}

function blocksOf(logs: unknown[]): bigint[] {
  return (logs as FakeLog[]).map((log) => log.blockNumber);
}

describe("getLogsUntilNow", () => {
  it("returns each log exactly once, including logs on window boundary blocks", async () => {
    const start = 100n;
    // Logs on the first block, on both sides of every 2000-block boundary
    // (start + 2000, start + 4000) and on the head itself.
    const logBlocks = [start, start + WINDOW - 1n, start + WINDOW, start + 2n * WINDOW, 5000n];
    const { client } = fakeClient(5000n, logBlocks);

    const logs = await getLogsUntilNow(CONTRACT, event, {}, client, start);

    expect(blocksOf(logs)).toEqual(logBlocks);
  });

  it("pages through inclusive, contiguous, non-overlapping windows up to the head", async () => {
    const start = 100n;
    const head = 5000n;
    const { client, ranges } = fakeClient(head, []);

    await getLogsUntilNow(CONTRACT, event, {}, client, start);

    expect(ranges).toEqual([
      { fromBlock: 100n, toBlock: 2099n },
      { fromBlock: 2100n, toBlock: 4099n },
      { fromBlock: 4100n, toBlock: 5000n },
    ]);
  });

  it("still scans the head block when the range is an exact multiple of the window size", async () => {
    const start = 1000n;
    const head = start + 2n * WINDOW; // 5000: exactly two full windows plus the head block
    const { client, ranges } = fakeClient(head, [head]);

    const logs = await getLogsUntilNow(CONTRACT, event, {}, client, start);

    expect(blocksOf(logs)).toEqual([head]);
    expect(ranges.at(-1)).toEqual({ fromBlock: head, toBlock: head });
  });

  it("scans a single window when the whole range fits in one", async () => {
    const { client, ranges } = fakeClient(150n, [120n]);

    const logs = await getLogsUntilNow(CONTRACT, event, {}, client, 100n);

    expect(blocksOf(logs)).toEqual([120n]);
    expect(ranges).toEqual([{ fromBlock: 100n, toBlock: 150n }]);
  });

  it("makes no request when the start block is beyond the head", async () => {
    const { client, ranges } = fakeClient(100n, [100n]);

    const logs = await getLogsUntilNow(CONTRACT, event, {}, client, 101n);

    expect(logs).toEqual([]);
    expect(ranges).toEqual([]);
  });
});
