import { ProposalStatus } from '../proposalUtils';
declare class ProposalDataListItemUtils {
    ongoingStatuses: ProposalStatus[];
    isOngoingStatus: (status: ProposalStatus) => boolean;
}
export declare const proposalDataListItemUtils: ProposalDataListItemUtils;
export {};
