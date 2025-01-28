import { type IProgressProps } from '../../../../../core';
export interface IProposalVotingProgressItemDescription {
    /**
     * Value of the description highlighted (e.g. current vote amount)
     */
    value: string | number | null;
    /**
     * Text of the description (e.g. minimum required vote amount)
     */
    text: string;
}
export interface IProposalVotingProgressItemProps extends IProgressProps {
    /**
     * Name of the voting progress.
     */
    name: string;
    /**
     * Description of the voting progress displayed below the progress bar.
     */
    description: IProposalVotingProgressItemDescription;
    /**
     * Displays the progress bar value as percentage when set to true.
     */
    showPercentage?: boolean;
    /**
     * Displays a status icon based on the progress bar and indicator values when set to true. The component renders a
     * "success" status icon when value is equal or greater than indicator, and a "failed" status icon otherwise.
     */
    showStatusIcon?: boolean;
}
export declare const ProposalVotingProgressItem: React.FC<IProposalVotingProgressItemProps>;
