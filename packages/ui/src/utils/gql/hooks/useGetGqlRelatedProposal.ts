import { useState, useEffect, useCallback } from "react";
import { getRelatedProposalTo } from "../getGqProposal";
import { IGqlProposalMixin } from "../types";

interface UseGqlProposalRelatedResult {
  data: IGqlProposalMixin | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseGqlProposalRelatedParams {
  executionBlockNumber: number;
  isStandard?: boolean;
  isEmergency?: boolean;
  enabled?: boolean; // Optional flag to control when the query runs
}

export function useGetGqlRelatedProposal({
  executionBlockNumber,
  isStandard = false,
  isEmergency = false,
  enabled = true,
}: UseGqlProposalRelatedParams): UseGqlProposalRelatedResult {
  const [data, setData] = useState<IGqlProposalMixin | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!enabled || !executionBlockNumber) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getRelatedProposalTo(executionBlockNumber, isStandard, isEmergency);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [executionBlockNumber, isStandard, isEmergency, enabled]);

  const refetch = useCallback(() => {
    fetchProposal();
  }, [fetchProposal]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  return { data, loading, error, refetch };
}
