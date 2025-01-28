import React, { type ComponentProps } from 'react';
export interface IProposalVotingContainerProps extends ComponentProps<'div'> {
    /**
     * Title displayed on top.
     */
    title: string;
    /**
     * Description of the proposal voting.
     */
    description: string;
    /**
     * Active stage that will be expanded by default for multi-stage proposals.
     */
    activeStage?: string;
}
export declare const ProposalVotingContainer: React.FC<IProposalVotingContainerProps>;
