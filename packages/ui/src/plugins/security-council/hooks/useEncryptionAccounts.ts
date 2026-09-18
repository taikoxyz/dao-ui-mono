import { EncryptionRegistryAbi } from "../artifacts/EncryptionRegistry";
import { useConfig } from "wagmi";
import { Config, readContract } from "@wagmi/core";
import { PUB_CHAIN, PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS } from "@/constants";
import { useQuery } from "@tanstack/react-query";

/**
 * Returns the list of accounts that have been registered on the encryption registry.
 */

export function useEncryptionAccounts({ refetchOnMount = true } = {}) {
  const config = useConfig() as Config;

  return useQuery({
    queryKey: ["encryption-registry-accounts-fetch", PUB_CHAIN.id, PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS],
    queryFn: () => {
      return readContract(config, {
        chainId: PUB_CHAIN.id,
        abi: EncryptionRegistryAbi,
        address: PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS,
        functionName: "getRegisteredAccounts",
      }).then((accounts) => {
        return Promise.all(
          accounts.map((accountAddress) =>
            readContract(config, {
              chainId: PUB_CHAIN.id,
              abi: EncryptionRegistryAbi,
              address: PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS,
              functionName: "accounts",
              args: [accountAddress],
            }).then((result) => {
              // zip values
              const [appointedAgent, publicKey] = result;
              return { owner: accountAddress, appointedAgent, publicKey };
            })
          )
        );
      });
    },
    retry: 2,
    // A failed explicit refresh retains dataUpdatedAt; retry even if cached keys
    // are still fresh. Rows can opt out while the parent owns recovery.
    refetchOnMount: refetchOnMount ? (query) => (query.state.status === "error" ? "always" : true) : false,
    refetchOnReconnect: true,
    retryOnMount: refetchOnMount,
    staleTime: 1000 * 60 * 5,
  });
}
