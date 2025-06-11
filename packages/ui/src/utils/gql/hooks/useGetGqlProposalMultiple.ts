import { useState, useEffect, useCallback } from "react";
import { getGqlProposalMultiple } from "../getGqProposal";
import { IGqlProposalMixin, UseGqlProposalMultipleParams, UseGqlProposalMultipleResult } from "../types";

export function useGqlProposalMultiple({
  isStandard = false,
  isEmergency = false,
  isOptimistic = false,
  enabled = true,
}: UseGqlProposalMultipleParams = {}): UseGqlProposalMultipleResult {
  const [data, setData] = useState<IGqlProposalMixin[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getGqlProposalMultiple(isStandard, isEmergency, isOptimistic);
      if (!result || result.length === 0) {
        throw new Error("No proposals found");
      }
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isStandard, isEmergency, isOptimistic, enabled]);

  const refetch = useCallback(() => {
    fetchProposal();
  }, [fetchProposal]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  return { data, loading, error, refetch };
}
