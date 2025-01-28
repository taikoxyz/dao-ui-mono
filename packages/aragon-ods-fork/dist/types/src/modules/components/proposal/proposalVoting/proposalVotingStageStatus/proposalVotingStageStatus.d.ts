import type { ComponentProps } from 'react';
import { ProposalVotingStatus } from '../../proposalUtils';
export interface IProposalVotingStageStatusProps extends ComponentProps<'div'> {
    /**
     * Status of the proposal.
     * @default ProposalVotingStatus.PENDING
     */
    status?: ProposalVotingStatus;
    /**
     * End date of the proposal in timestamp or ISO format.
     */
    endDate: string | number;
    /**
     * Defines if the proposal is a multi-stage proposal.
     */
    isMultiStage?: boolean;
}
export declare const ProposalVotingStageStatus: React.FC<IProposalVotingStageStatusProps>;
