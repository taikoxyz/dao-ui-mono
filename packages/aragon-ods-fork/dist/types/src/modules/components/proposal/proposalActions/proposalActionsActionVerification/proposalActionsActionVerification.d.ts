import { type ComponentProps } from 'react';
import { type IProposalAction } from '../proposalActionsTypes';
export interface IProposalActionsActionVerificationProps extends ComponentProps<'div'> {
    /**
     * Proposal action base.
     */
    action: IProposalAction;
}
export declare const ProposalActionsActionVerification: React.FC<IProposalActionsActionVerificationProps>;
