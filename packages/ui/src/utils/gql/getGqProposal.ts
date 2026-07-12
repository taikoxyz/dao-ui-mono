import { PUB_SUBGRAPH_URL } from "@/constants";
import { ApolloClient, gql, InMemoryCache } from "@apollo/client";
import { GQL_GET_RELATED_PROPOSAL_SINGLE, GQL_GET_PROPOSAL_MULTIPLE, GQL_GET_PROPOSAL_SINGLE } from "./queries.gql";
import { IGqlProposalMixin } from "./types";

export async function getGqlProposalMultiple(
  isStandard: boolean = false,
  isEmergency: boolean = false,
  isOptimistic: boolean = false
): Promise<IGqlProposalMixin[] | undefined> {
  try {
    const client = new ApolloClient({
      uri: PUB_SUBGRAPH_URL,
      cache: new InMemoryCache(),
    });

    const res: any = await client.query({
      query: gql(GQL_GET_PROPOSAL_MULTIPLE),
      variables: {
        isStandard: isStandard,
        isEmergency: isEmergency,
        isOptimistic: isOptimistic,
      },
    });

    if (!res.data || !res.data.proposalMixins || !res.data.proposalMixins.length) {
      // Empty result is a valid "no proposals" state, not an error.
      return [];
    }
    return res.data.proposalMixins as IGqlProposalMixin[];
  } catch (e) {
    // Rethrow so callers can tell an unreachable subgraph from an empty result.
    console.error("GQL Error:", GQL_GET_PROPOSAL_MULTIPLE, e);
    throw e;
  }
}

export async function getGqlProposalSingle(
  proposalId: string,
  isStandard: boolean = false,
  isEmergency: boolean = false,
  isOptimistic: boolean = false
): Promise<IGqlProposalMixin | undefined> {
  try {
    const client = new ApolloClient({
      uri: PUB_SUBGRAPH_URL,
      cache: new InMemoryCache(),
    });

    const res: any = await client.query({
      query: gql(GQL_GET_PROPOSAL_SINGLE),
      variables: {
        proposalId: proposalId,
        isStandard: isStandard,
        isEmergency: isEmergency,
        isOptimistic: isOptimistic,
      },
    });

    if (!res.data || !res.data.proposalMixins || !res.data.proposalMixins.length) {
      // No match is a normal "not found" state (e.g. a nonexistent proposal id,
      // or an optimistic proposal with no related Security Council proposal),
      // not an error. Return undefined so callers can render a not-found state
      // instead of surfacing a runtime error.
      return undefined;
    }

    return res.data.proposalMixins[0] as IGqlProposalMixin;
  } catch (e) {
    // Rethrow so callers can tell an unreachable subgraph from a genuine
    // not-found; both previously rendered as an indistinguishable empty state.
    console.error("GQL Error:", e);
    throw e;
  }
}

export async function getRelatedProposalTo(
  executionBlockNumber: number,
  isStandard: boolean = false,
  isEmergency: boolean = false
): Promise<IGqlProposalMixin | undefined> {
  try {
    const client = new ApolloClient({
      uri: PUB_SUBGRAPH_URL,
      cache: new InMemoryCache(),
    });

    const res: any = await client.query({
      query: gql(GQL_GET_RELATED_PROPOSAL_SINGLE),
      variables: {
        executionBlockNumber: executionBlockNumber,
        isStandard: isStandard,
        isEmergency: isEmergency,
      },
    });

    if (!res.data || !res.data.proposalMixins || !res.data.proposalMixins.length) {
      // No match is a normal "not found" state (e.g. a nonexistent proposal id,
      // or an optimistic proposal with no related Security Council proposal),
      // not an error. Return undefined so callers can render a not-found state
      // instead of surfacing a runtime error.
      return undefined;
    }

    return res.data.proposalMixins[0] as IGqlProposalMixin;
  } catch (e) {
    // Rethrow so callers can tell an unreachable subgraph from a genuine
    // not-found; both previously rendered as an indistinguishable empty state.
    console.error("GQL Error:", e);
    throw e;
  }
}
