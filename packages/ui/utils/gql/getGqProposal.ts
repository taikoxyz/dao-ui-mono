import { PUB_SUBGRAPH_URL } from "@/constants";
import { ApolloClient, gql, InMemoryCache } from "@apollo/client";
import { GQL_GET_PROPOSAL_MULTIPLE, GQL_GET_PROPOSAL_SINGLE } from "./queries.gql";
import { Address, zeroAddress } from "viem";

export async function getGqlProposalMultiple(
  isStandard: boolean = false,
  isEmergency: boolean = false,
  isOptimistic: boolean = false
) {
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

    console.log("GQL multiple Response:", res);

    if (!res.data || !res.data.emergencyProposal || !res.data.emergencyProposal.creator) {
      throw new Error("No emergencyProposal found");
    }
    return res.data.emergencyProposal;
  } catch (e) {
    console.error("GQL Error:", GQL_GET_PROPOSAL_MULTIPLE, e);
    return { creator: zeroAddress };
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

    console.log("GQL single Response:", res);

    if (!res.data || !res.data.proposalMixins || !res.data.proposalMixins.length) {
      throw new Error("No proposalMixins found");
    }

    return res.data.proposalMixins[0] as IGqlProposalMixin;
  } catch (e) {
    console.error("GQL Error:", e);
  }
}

export interface IGqlActor {
  id: string;
  address: Address;
  txHash: string;
}

export interface IGqlProposalMixin {
  id: string;
  creator: Address;
  approvers: IGqlActor[];
  executor?: IGqlActor;
  isEmergency: boolean;
  isStandard: boolean;
  isOptimistic: boolean;
  proposalId: string;
  metadata: string;
  vetoes: IGqlActor[];
  creationTxHash: string;
}
