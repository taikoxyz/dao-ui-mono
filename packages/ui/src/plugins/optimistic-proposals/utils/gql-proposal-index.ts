import { type IGqlProposalMixin } from "@/utils/gql/types";
import { parseProposalId } from "./proposal-id";

/**
 * Indexes subgraph proposals by their on-chain proposal index.
 *
 * The subgraph returns `proposalMixins` in its own order (and capped by the
 * default page size), so a proposal's position in that array says nothing about
 * its index in the plugin's `proposalIds` array. The on-chain proposal id
 * encodes the index in its low 64 bits, so decode that instead of trusting the
 * array position.
 */
export function groupGqlProposalsByIndex(
  proposals: IGqlProposalMixin[] | null | undefined
): Map<number, IGqlProposalMixin> {
  const byIndex = new Map<number, IGqlProposalMixin>();
  if (!proposals) return byIndex;

  for (const proposal of proposals) {
    if (!proposal?.proposalId) continue;

    let index: number;
    try {
      index = parseProposalId(BigInt(proposal.proposalId)).index;
    } catch {
      // A proposal id the subgraph could not express as an integer tells us
      // nothing about which proposal it belongs to. Skipping it renders the
      // card without subgraph data, which is what a missing entry already does
      // — but log it, so malformed subgraph data is distinguishable from a
      // proposal the subgraph simply has not indexed.
      console.warn(`Skipping subgraph proposal with an unparseable proposalId: ${proposal.proposalId}`);
      continue;
    }

    // The subgraph is the source of truth for a given id, so the first entry
    // wins; a duplicate would be the same proposal.
    if (!byIndex.has(index)) byIndex.set(index, proposal);
  }

  return byIndex;
}
