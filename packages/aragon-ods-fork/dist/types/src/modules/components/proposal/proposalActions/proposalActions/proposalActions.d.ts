import { type ReactNode } from 'react';
import type { IWeb3ComponentProps } from '../../../../types';
import type { IProposalAction, ProposalActionComponent } from '../proposalActionsTypes';
export interface IProposalActionsProps extends IWeb3ComponentProps {
    /**
     * Actions to render.
     */
    actions: IProposalAction[];
    /**
     * Map of action-type <=> action-name displayed on the action header.
     */
    actionNames?: Record<string, string>;
    /**
     * Map of action-type <=> custom-component to customize how actions are displayed.
     */
    customActionComponents?: Record<string, ProposalActionComponent>;
    /**
     * Additional classes for the component.
     */
    className?: string;
    /**
     * Children of the component.
     */
    children?: ReactNode;
}
export declare const ProposalActions: React.FC<IProposalActionsProps>;
