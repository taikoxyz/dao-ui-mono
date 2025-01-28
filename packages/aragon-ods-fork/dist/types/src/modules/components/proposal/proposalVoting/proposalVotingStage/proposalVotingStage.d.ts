import { type ComponentProps } from 'react';
import { ProposalVotingStatus } from '../../proposalUtils';
import { ProposalVotingTab } from '../proposalVotingDefinitions';
export interface IProposalVotingStageProps extends ComponentProps<'div'> {
    /**
     * Status of the stage.
     */
    status: ProposalVotingStatus;
    /**
     * Start date of the stage in timestamp or ISO format.
     */
    startDate: number | string;
    /**
     * Start date of the stage in timestamp or ISO format.
     */
    endDate: number | string;
    /**
     * Default tab displayed for the current stage. Defaults to details tab for pending and unreached states and to
     * breakdown tab for active, accepted and rejected states.
     */
    defaultTab?: ProposalVotingTab;
    /**
     * Name of the proposal stage displayed for multi-stage proposals.
     */
    name?: string;
    /**
     * Index of the stage set automatically by the ProposalVotingContainer for multi-stage proposals.
     */
    index?: number;
    /**
     * Defines if the proposal has multiple stages or not.
     */
    isMultiStage?: boolean;
}
export declare const ProposalVotingStage: React.FC<IProposalVotingStageProps>;
