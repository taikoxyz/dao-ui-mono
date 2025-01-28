import { type IProposalAction, type IProposalActionChangeMembers, type IProposalActionChangeSettings, type IProposalActionTokenMint, type IProposalActionUpdateMetadata, type IProposalActionWithdrawToken } from './proposalActionsTypes';
declare class ProposalActionsUtils {
    isWithdrawTokenAction: (action: Partial<IProposalAction>) => action is IProposalActionWithdrawToken;
    isChangeMembersAction: (action: Partial<IProposalAction>) => action is IProposalActionChangeMembers;
    isUpdateMetadataAction: (action: Partial<IProposalAction>) => action is IProposalActionUpdateMetadata;
    isTokenMintAction: (action: Partial<IProposalAction>) => action is IProposalActionTokenMint;
    isChangeSettingsAction: (action: Partial<IProposalAction>) => action is IProposalActionChangeSettings;
}
export declare const proposalActionsUtils: ProposalActionsUtils;
export {};
