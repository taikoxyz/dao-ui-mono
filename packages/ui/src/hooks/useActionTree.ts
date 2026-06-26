import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { keccak256, toHex, type Address, type PublicClient } from "viem";
import { PUB_CHAIN } from "@/constants";
import type { RawAction } from "@/utils/types";
import type { AbiResolution, DecodedNode } from "@/utils/decoding/types";
import { decodeAction } from "@/utils/decoding/decodeAction";
import { loadAbiWith, loadTokenWith, loadSignature } from "@/utils/decoding/abiResolver";

const MAX_DEPTH = 4;

export function useActionTree(action: RawAction): { node: DecodedNode | null; isLoading: boolean } {
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      "actionTree",
      publicClient?.chain.id,
      action.to,
      keccak256(toHex(action.data ?? "0x")),
      action.value?.toString() ?? "0",
    ],
    enabled: !!publicClient,
    staleTime: 1000 * 60 * 60 * 24 * 7,
    queryFn: async (): Promise<DecodedNode> => {
      const client = publicClient as PublicClient;
      const ctx = {
        loadAbi: (addr: Address): Promise<AbiResolution> =>
          queryClient.fetchQuery({
            queryKey: ["abi", client.chain?.id, addr],
            queryFn: () => loadAbiWith(client, addr),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        loadSignature,
        loadToken: (addr: Address) =>
          queryClient.fetchQuery({
            queryKey: ["token", client.chain?.id, addr],
            queryFn: () => loadTokenWith(client, addr),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        depth: 0,
        maxDepth: MAX_DEPTH,
        seen: new Set<string>(),
      };
      return decodeAction({ to: action.to, value: action.value, data: action.data }, ctx);
    },
  });

  return { node: data ?? null, isLoading };
}
