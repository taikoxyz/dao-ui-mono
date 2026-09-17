import { describe, expect, test } from "vitest";
import { getAddress } from "viem";
import { computeCurrentSignerList } from "@/plugins/security-council/utils/fetchSignerList";
import { getSecurityCouncilDirectoryAddresses } from "@/utils/getSecurityCouncilMemberData";

const TAIKO_LABS = getAddress("0xb47fE76aC588101BFBdA9E68F66433bA51E8029a");
const CHAINBOUND = getAddress("0x436a1075099A145417EBFc74BBaC9605e3e4f1A7");
const DANIEL_WANG = getAddress("0xF74F2bBaEd41e3e4AbAcbA24563a5Ce5aB071C8A");
const GUSTAVO = getAddress("0xe63E61BbB3aa1b82d44471AbcAb490102C17c986");

describe("computeCurrentSignerList", () => {
  test("replays adds and removes in block and log order", () => {
    const result = computeCurrentSignerList([
      { blockNumber: 1n, logIndex: 0, added: [TAIKO_LABS, CHAINBOUND], removed: [] },
      { blockNumber: 2n, logIndex: 5, added: [DANIEL_WANG, GUSTAVO], removed: [] },
      { blockNumber: 2n, logIndex: 6, added: [], removed: [CHAINBOUND] },
    ]);
    expect(result).toEqual([TAIKO_LABS, DANIEL_WANG, GUSTAVO]);
  });

  test("treats mixed-case addresses as the same seat", () => {
    const result = computeCurrentSignerList([
      { blockNumber: 1n, logIndex: 0, added: [CHAINBOUND.toLowerCase() as typeof CHAINBOUND], removed: [] },
      { blockNumber: 1n, logIndex: 1, added: [], removed: [CHAINBOUND] },
    ]);
    expect(result).toEqual([]);
  });

  test("replays mutations across block numbers larger than Number.MAX_SAFE_INTEGER deltas", () => {
    const later = 2n ** 60n;
    const result = computeCurrentSignerList([
      { blockNumber: later, logIndex: 0, added: [], removed: [CHAINBOUND] },
      { blockNumber: 1n, logIndex: 0, added: [TAIKO_LABS, CHAINBOUND], removed: [] },
    ]);
    expect(result).toEqual([TAIKO_LABS]);
  });

  test("checksums overlay addresses before they are used as SignerList candidates", () => {
    for (const address of getSecurityCouncilDirectoryAddresses()) {
      expect(address).toBe(getAddress(address));
    }
  });
});
