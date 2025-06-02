import { gql } from "@apollo/client";

export const GQL_GET_PROPOSAL_MULTIPLE = `query getProposals(
    $isStandard: Boolean,
    $isEmergency: Boolean,
    $isOptimistic: Boolean
) {
    proposalMixins(where: {
        isStandard: $isStandard,
        isEmergency: $isEmergency,
        isOptimistic: $isOptimistic
    }) {
        id,
        proposalId,
        metadata,
        creator,
        isEmergency,
        isStandard,
        isOptimistic,
        approvers {
        id, 
        txHash,
        address 
},
executor {
id, txHash, address},
vetoes { id, txHash, address },
creationTxHash
}
    }`;

export const GQL_GET_PROPOSAL_SINGLE = `query getProposal(
$proposalId: BigInt,
    $isStandard: Boolean,
    $isEmergency: Boolean,
    $isOptimistic: Boolean
) {
    proposalMixins(where: {
    proposalId: $proposalId,
        isStandard: $isStandard,
        isEmergency: $isEmergency,
        isOptimistic: $isOptimistic
    }) {
        id,
        proposalId,
        metadata,
        creator,
        isEmergency,
        isStandard,
        isOptimistic,
        approvers {
        id, 
        txHash,
        address 
},
executor {
id, txHash, address},
vetoes { id, txHash, address },
creationTxHash
}
    }`;
