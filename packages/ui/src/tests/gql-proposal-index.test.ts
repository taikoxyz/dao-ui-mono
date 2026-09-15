import { groupGqlProposalsByIndex } from "@/plugins/optimistic-proposals/utils/gql-proposal-index";
import { type IGqlProposalMixin } from "@/utils/gql/types";
import { expect, test, describe } from "vitest";

// Real-shaped proposal ids: the low 64 bits carry the on-chain index.
// 585286874342463589627155947503667611999762644992n -> index 0
// 585287214624830510565619420101647080622749910226n -> index 1234
const ID_INDEX_0 = "585286874342463589627155947503667611999762644992";
const ID_INDEX_1234 = "585287214624830510565619420101647080622749910226";

function gqlProposal(proposalId: string, creator: string): IGqlProposalMixin {
  return {
    id: proposalId,
    creator: creator as IGqlProposalMixin["creator"],
    approvers: [],
    isEmergency: false,
    isStandard: true,
    isOptimistic: true,
    proposalId,
    metadata: "",
    vetoes: [],
    creationTxHash: "0x",
    creationBlockNumber: 1,
  };
}

describe("groupGqlProposalsByIndex", () => {
  test("keys proposals by the index encoded in the proposal id, not by array position", () => {
    const first = gqlProposal(ID_INDEX_1234, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const second = gqlProposal(ID_INDEX_0, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

    const byIndex = groupGqlProposalsByIndex([first, second]);

    // Array position 0 holds the proposal whose on-chain index is 1234.
    expect(byIndex.get(1234)).toBe(first);
    expect(byIndex.get(0)).toBe(second);
  });

  test("returns an empty map for missing data", () => {
    expect(groupGqlProposalsByIndex(undefined).size).toBe(0);
    expect(groupGqlProposalsByIndex(null).size).toBe(0);
    expect(groupGqlProposalsByIndex([]).size).toBe(0);
  });

  test("skips entries whose proposal id is absent or unparseable", () => {
    const usable = gqlProposal(ID_INDEX_0, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    const noId = gqlProposal("", "0xcccccccccccccccccccccccccccccccccccccccc");
    const badId = gqlProposal("not-a-number", "0xdddddddddddddddddddddddddddddddddddddddd");

    const byIndex = groupGqlProposalsByIndex([noId, badId, usable]);

    expect(byIndex.size).toBe(1);
    expect(byIndex.get(0)).toBe(usable);
  });

  test("keeps the first entry when an index repeats", () => {
    const first = gqlProposal(ID_INDEX_0, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const duplicate = gqlProposal(ID_INDEX_0, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

    expect(groupGqlProposalsByIndex([first, duplicate]).get(0)).toBe(first);
  });
});
