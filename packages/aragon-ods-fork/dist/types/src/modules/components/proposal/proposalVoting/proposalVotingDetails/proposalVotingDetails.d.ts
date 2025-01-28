import { type ITabsContentProps } from '../../../../../core';
export interface IProposalVotingDetailsSetting {
    /**
     * Term of the setting.
     */
    term: string;
    /**
     * Value of the setting.
     */
    definition: string;
}
export interface IProposalVotingDetailsProps extends Omit<ITabsContentProps, 'value'> {
    /**
     * Governance settings displayed on the details tab.
     */
    settings?: IProposalVotingDetailsSetting[];
}
export declare const ProposalVotingDetails: React.FC<IProposalVotingDetailsProps>;
