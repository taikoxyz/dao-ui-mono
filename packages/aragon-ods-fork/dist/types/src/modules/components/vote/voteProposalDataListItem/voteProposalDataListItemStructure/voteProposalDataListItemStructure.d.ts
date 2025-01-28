import { type IDataListItemProps } from '../../../../../core';
import { type VoteIndicator } from '../../voteUtils';
export interface IVoteProposalDataListItemStructureProps extends IDataListItemProps {
    /**
     * The ID of proposal.
     */
    proposalId: string;
    /**
     * The title of the proposal the user voted on.
     */
    proposalTitle: string;
    /**
     * The vote of the user.
     */
    voteIndicator: VoteIndicator;
    /**
     *  Date of the vote on the proposal in ISO format or as a timestamp
     */
    date?: number | string;
}
export declare const VoteProposalDataListItemStructure: React.FC<IVoteProposalDataListItemStructureProps>;
