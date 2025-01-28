import type { ComponentProps } from 'react';
export interface IProposalVotingProgressContainerProps extends ComponentProps<'div'> {
    /**
     * Flex direction of the ProposalVotingProgress components. On small screens, the components will be rendered
     * in a flex column container regardeless.
     * @default row;
     */
    direction?: 'row' | 'col';
}
export declare const ProposalVotingProgressContainer: React.FC<IProposalVotingProgressContainerProps>;
