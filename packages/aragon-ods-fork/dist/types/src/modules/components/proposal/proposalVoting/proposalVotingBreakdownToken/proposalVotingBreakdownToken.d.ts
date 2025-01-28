import { type ITabsContentProps } from '../../../../../core';
export interface IProposalVotingBreakdownTokenProps extends Omit<ITabsContentProps, 'value'> {
    /**
     * Total voting power of users that voted yes.
     */
    totalYes: number | string;
    /**
     * Total voting power of users that voted no.
     */
    totalNo: number | string;
    /**
     * Total voting power of users that voted abstain.
     */
    totalAbstain: number | string;
    /**
     * Percentage of tokens that need to vote "Yes" for a proposal to pass.
     */
    supportThreshold: number;
    /**
     * Percentage of tokens that need to participate in a vote for it to be valid.
     */
    minParticipation: number;
    /**
     * Symbol of the governance token.
     */
    tokenSymbol: string;
    /**
     * Total supply of the governance token.
     */
    tokenTotalSupply: number | string;
}
export declare const ProposalVotingBreakdownToken: React.FC<IProposalVotingBreakdownTokenProps>;
