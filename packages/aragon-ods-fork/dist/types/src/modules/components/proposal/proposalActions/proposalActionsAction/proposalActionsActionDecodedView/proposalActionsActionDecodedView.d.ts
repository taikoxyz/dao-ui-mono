import type { IProposalAction } from '../../proposalActionsTypes';
export interface IProposalActionsActionDecodedViewProps {
    /**
     * Proposal action to render decoded view for.
     */
    action: IProposalAction;
}
export declare const ProposalActionsActionDecodedView: React.FC<IProposalActionsActionDecodedViewProps>;
