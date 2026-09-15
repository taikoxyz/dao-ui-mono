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
 *
 * Assumes the caller's query is scoped to a single plugin — the index alone is
 * only unique within one. `GQL_GET_PROPOSAL_MULTIPLE` is filtered on
 * `isOptimistic`, which the one optimistic plugin satisfies. Reusing this for a
 * broader `proposalMixins` query would let equal indexes from different plugins
 * collide, and the first entry would silently win.
 */
export function groupGqlProposalsByIndex(
  proposals: IGqlProposalMixin[] | null | undefined
): Map<number, IGqlProposalMixin> {
  const byIndex = new Map<number, IGqlProposalMixin>();
  if (!proposals) return byIndex;

  // Collected rather than warned one by one: a subgraph returning many bad
  // records would otherwise flood the console with a line per entry.
  const skipped: string[] = [];

  for (const proposal of proposals) {
    if (!proposal?.proposalId) {
      // An entry with no proposalId is malformed subgraph data too, so it
      // belongs in the same report rather than vanishing silently.
      if (proposal) skipped.push(`(no proposalId, entity id ${proposal.id || "unknown"})`);
      continue;
    }

    let index: number;
    try {
      index = parseProposalId(BigInt(proposal.proposalId)).index;
    } catch {
      // A proposal id the subgraph could not express as an integer tells us
      // nothing about which proposal it belongs to.
      skipped.push(proposal.proposalId);
      continue;
    }

    // parseProposalId narrows the low 64 bits to a JS number, which is lossy
    // above 2^53. A real index never gets close, but a corrupt id could decode
    // to a value where distinct ids collapse onto the same key — exactly the
    // misattribution this map exists to prevent. Drop it instead.
    if (!Number.isSafeInteger(index)) {
      skipped.push(proposal.proposalId);
      continue;
    }

    // The subgraph is the source of truth for a given id, so the first entry
    // wins; a duplicate would be the same proposal.
    if (!byIndex.has(index)) byIndex.set(index, proposal);
  }

  // Skipping renders the card without subgraph data, which is what a missing
  // entry already does — but say so, or malformed subgraph data is
  // indistinguishable from a proposal the subgraph has not indexed.
  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} subgraph proposal(s) with an unusable proposalId: ${skipped.join(", ")}`);
  }

  return byIndex;
}
