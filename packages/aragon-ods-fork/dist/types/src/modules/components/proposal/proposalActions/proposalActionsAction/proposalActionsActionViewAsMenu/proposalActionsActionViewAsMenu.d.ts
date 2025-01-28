import { ProposalActionViewMode } from '../../proposalActionsTypes';
export interface IProposalActionsActionViewAsMenuProps {
    /**
     * Current selected view mode for the action.
     */
    viewMode: ProposalActionViewMode;
    /**
     * Flag to disable basic view mode.
     */
    disableBasic: boolean;
    /**
     * Flag to disable decoded view mode.
     */
    disableDecoded: boolean;
    /**
     * Callback to handle dropdown value change.
     */
    onViewModeChange: (value: ProposalActionViewMode) => void;
}
export declare const ProposalActionsActionViewAsMenu: React.FC<IProposalActionsActionViewAsMenuProps>;
