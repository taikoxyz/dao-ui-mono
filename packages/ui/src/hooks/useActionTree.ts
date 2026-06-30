import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { keccak256, toHex, type Address, type PublicClient } from "viem";
import { PUB_CHAIN } from "@/constants";
import type { RawAction } from "@/utils/types";
import type { AbiResolution, DecodedNode } from "@/utils/decoding/types";
import { decodeAction } from "@/utils/decoding/decodeAction";
import {
  fetchAbiResolution,
  loadVerifiedAbiFrom,
  loadTokenWith,
  abiQueryKey,
  chainClient,
  isVerifiedAbiChainSupported,
} from "@/utils/decoding/abiResolver";

const MAX_DEPTH = 4;

const DAY = 1000 * 60 * 60 * 24;
const CLEAN_TREE_STALE = DAY * 7;
const CLEAN_ABI_STALE = DAY * 30;
const TOKEN_STALE = DAY * 30;

export function useActionTree(action: RawAction): { node: DecodedNode | null; isLoading: boolean; isError: boolean } {
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "actionTree",
      publicClient?.chain.id,
      action.to,
      keccak256(toHex(action.data ?? "0x")),
      action.value?.toString() ?? "0",
    ],
    enabled: !!publicClient,
    // A transiently-degraded tree (a fetch threw somewhere in the subtree) is
    // marked stale so the next mount refetches; a clean result stays cached 7d.
    staleTime: (query) => (query.state.data?.retryable ? 0 : CLEAN_TREE_STALE),
    queryFn: async (): Promise<DecodedNode> => {
      const client = publicClient as PublicClient;
      const appChainId = client.chain?.id ?? PUB_CHAIN.id;
      const ctx = {
        chainId: appChainId,
        loadAbi: (addr: Address, chainId: number): Promise<AbiResolution> =>
          queryClient.fetchQuery({
            queryKey: abiQueryKey(chainId, addr),
            queryFn: () => {
              if (chainId === appChainId) return fetchAbiResolution(client, addr);
              if (!isVerifiedAbiChainSupported(chainId)) {
                return Promise.resolve<AbiResolution>({
                  abi: [],
                  trust: "unknown",
                  isProxy: false,
                  implementation: null,
                });
              }
              return loadVerifiedAbiFrom(chainId, addr);
            },
            // A transient ABI failure must not be pinned 30d, or the outer tree
            // refetch would just re-read the stale retryable ABI and never recover.
            staleTime: (q) => (q.state.data?.retryable ? 0 : CLEAN_ABI_STALE),
          }),
        // Token metadata reads from the call's OWN chain: a bridged L2 ERC-20
        // reads decimals/symbol from the L2, not the app chain. Cache key includes
        // chainId so the same address on two chains can't collide.
        loadToken: (addr: Address, chainId: number) =>
          queryClient.fetchQuery({
            queryKey: ["token", chainId, addr.toLowerCase()],
            queryFn: () => {
              const tokenClient = chainId === appChainId ? client : chainClient(chainId);
              if (!tokenClient) return Promise.resolve(null);
              return loadTokenWith(tokenClient, addr);
            },
            staleTime: TOKEN_STALE,
          }),
        depth: 0,
        maxDepth: MAX_DEPTH,
        seen: new Set<string>(),
      };
      return decodeAction({ to: action.to, value: action.value, data: action.data }, ctx);
    },
  });

  // `enabled: false` (no client) leaves isLoading/isError false and node null — the
  // caller renders an honest raw fallback rather than a permanent spinner.
  return { node: data ?? null, isLoading, isError };
}
