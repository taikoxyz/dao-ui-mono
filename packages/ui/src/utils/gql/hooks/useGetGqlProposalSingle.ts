import { useState, useEffect, useCallback } from "react";
import { getGqlProposalSingle } from "../getGqProposal";
import { IGqlProposalMixin } from "../types";

interface UseGqlProposalSingleResult {
  data: IGqlProposalMixin | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseGqlProposalSingleParams {
  proposalId: string;
  isStandard?: boolean;
  isEmergency?: boolean;
  isOptimistic?: boolean;
  enabled?: boolean; // Optional flag to control when the query runs
}

export function useGqlProposalSingle({
  proposalId,
  isStandard = false,
  isEmergency = false,
  isOptimistic = false,
  enabled = true,
}: UseGqlProposalSingleParams): UseGqlProposalSingleResult {
  const [data, setData] = useState<IGqlProposalMixin | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!enabled || !proposalId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getGqlProposalSingle(proposalId, isStandard, isEmergency, isOptimistic);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [proposalId, isStandard, isEmergency, isOptimistic, enabled]);

  const refetch = useCallback(() => {
    fetchProposal();
  }, [fetchProposal]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  return { data, loading, error, refetch };
}
