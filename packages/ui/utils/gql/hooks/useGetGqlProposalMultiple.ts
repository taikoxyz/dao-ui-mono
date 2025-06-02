import { useState, useEffect, useCallback } from "react";
import { zeroAddress } from "viem";
import { getGqlProposalMultiple } from "../getGqProposal";

interface ProposalData {
  creator: string;
  // Add other properties based on your actual emergencyProposal structure
}

interface UseGqlProposalMultipleResult {
  data: ProposalData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface UseGqlProposalMultipleParams {
  isStandard?: boolean;
  isEmergency?: boolean;
  isOptimistic?: boolean;
  enabled?: boolean; // Optional flag to control when the query runs
}

export function useGqlProposalMultiple({
  isStandard = false,
  isEmergency = false,
  isOptimistic = false,
  enabled = true,
}: UseGqlProposalMultipleParams = {}): UseGqlProposalMultipleResult {
  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getGqlProposalMultiple(isStandard, isEmergency, isOptimistic);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setData({ creator: zeroAddress });
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
