import type { IProposalVotingStageProps } from '../proposalVotingStage/proposalVotingStage';
export interface IProposalVotingStageContext extends Pick<IProposalVotingStageProps, 'startDate' | 'endDate'> {
}
export declare const ProposalVotingStageContextProvider: any;
export declare const useProposalVotingStageContext: () => IProposalVotingStageContext;
