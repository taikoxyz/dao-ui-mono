import { type RefObject } from 'react';
import { type ITabsRootProps } from '../../../../../core';
import { ProposalVotingTab } from '../proposalVotingDefinitions';
export interface IProposalVotingTabsProps extends ITabsRootProps {
    /**
     * Default proposal voting tab selected.
     * @default ProposalVotingTab.BREAKDOWN
     */
    defaultValue?: ProposalVotingTab;
    /**
     * Reference object of the parent accordion component (on multi-stage proposals) to update its height on tab change.
     */
    accordionRef?: RefObject<HTMLDivElement>;
}
export declare const ProposalVotingTabs: React.FC<IProposalVotingTabsProps>;
