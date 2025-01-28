import { type IProposalDataListItemStructureProps } from '../proposalDataListItemStructure';
export interface IProposalDataListItemStatusProps extends Pick<IProposalDataListItemStructureProps, 'date' | 'status' | 'voted'> {
}
export declare const ProposalDataListItemStatus: React.FC<IProposalDataListItemStatusProps>;
