import type { IProposalVotingStageProps } from '../proposalVotingStage/proposalVotingStage';
export interface IProposalVotingStageContext extends Pick<IProposalVotingStageProps, 'startDate' | 'endDate'> {
}
export declare const ProposalVotingStageContextProvider: import("react").Provider<IProposalVotingStageContext | null>;
export declare const useProposalVotingStageContext: () => IProposalVotingStageContext;
