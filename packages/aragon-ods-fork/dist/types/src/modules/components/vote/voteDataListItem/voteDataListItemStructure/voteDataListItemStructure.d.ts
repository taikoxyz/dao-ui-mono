import { type IDataListItemProps } from '../../../../../core';
import { type ICompositeAddress } from '../../../../types';
import { type VoteIndicator } from '../../voteUtils';
export interface IVoteDataListItemStructureProps extends IDataListItemProps {
    /**
     * The account details of the voter.
     */
    voter: ICompositeAddress;
    /**
     * Whether the voter is a delegate of the current user or not.
     */
    isDelegate?: boolean;
    /**
     * The vote of the user.
     */
    voteIndicator: VoteIndicator;
    /**
     * If token-based voting, the amount of token voting power used.
     */
    votingPower?: number | string;
    /**
     * If token-based voting, the symbol of the voting power used.
     */
    tokenSymbol?: string;
}
export declare const VoteDataListItemStructure: React.FC<IVoteDataListItemStructureProps>;
