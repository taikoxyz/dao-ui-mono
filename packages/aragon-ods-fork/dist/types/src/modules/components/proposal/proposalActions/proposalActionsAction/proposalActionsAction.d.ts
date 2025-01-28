import type { IWeb3ComponentProps } from '../../../../types';
import type { IProposalAction, ProposalActionComponent } from '../proposalActionsTypes';
export interface IProposalActionsActionProps extends IWeb3ComponentProps {
    /**
     * Proposal action
     */
    action: IProposalAction;
    /**
     * Proposal action name
     */
    name?: string;
    /**
     * Index of the action being mapped by its parent ProposalActions.Container
     */
    index: number;
    /**
     * Custom component for the action
     */
    CustomComponent?: ProposalActionComponent;
}
export declare const ProposalActionsAction: React.FC<IProposalActionsActionProps>;
