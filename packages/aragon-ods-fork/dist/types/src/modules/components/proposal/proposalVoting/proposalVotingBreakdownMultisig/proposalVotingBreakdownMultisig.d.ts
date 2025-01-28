import { type ITabsContentProps } from '../../../../../core';
export interface IProposalVotingBreakdownMultisigProps extends Omit<ITabsContentProps, 'value'> {
    /**
     * Current number of approvals for the proposal.
     */
    approvalsAmount: number;
    /**
     * Minimum numbers of approvals required for a proposal to pass.
     */
    minApprovals: number;
}
export declare const ProposalVotingBreakdownMultisig: React.FC<IProposalVotingBreakdownMultisigProps>;
