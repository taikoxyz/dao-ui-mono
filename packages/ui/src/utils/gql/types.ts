import { Address } from "viem";

export interface IGqlActor {
  id: string;
  address: Address;
  txHash: string;
}

export interface IGqlProposalMixin {
  id: string;
  creator: Address;
  approvers: IGqlActor[];
  executor?: IGqlActor;
  isEmergency: boolean;
  isStandard: boolean;
  isOptimistic: boolean;
  proposalId: string;
  metadata: string;
  vetoes: IGqlActor[];
  creationTxHash: string;
  creationBlockNumber: number;
  executionBlockNumber?: number;
}
export interface UseGqlProposalMultipleResult {
  data: IGqlProposalMixin[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseGqlProposalMultipleParams {
  isStandard?: boolean;
  isEmergency?: boolean;
  isOptimistic?: boolean;
  enabled?: boolean; // Optional flag to control when the query runs
}
