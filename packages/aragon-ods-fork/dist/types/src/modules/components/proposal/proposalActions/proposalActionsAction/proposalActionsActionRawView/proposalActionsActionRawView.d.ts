import type { IProposalAction } from '../../proposalActionsTypes';
export interface IProposalActionsActionRawViewProps {
    /**
     * Proposal action to render raw view for.
     */
    action: IProposalAction;
}
export declare const ProposalActionsActionRawView: React.FC<IProposalActionsActionRawViewProps>;
