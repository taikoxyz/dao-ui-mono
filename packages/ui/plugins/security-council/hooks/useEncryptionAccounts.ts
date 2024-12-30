import { EncryptionRegistryAbi } from "../artifacts/EncryptionRegistry";
import { useConfig } from "wagmi";
import { readContract } from "@wagmi/core";
import { PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS } from "@/constants";
import { useQuery } from "@tanstack/react-query";

/**
 * Returns the list of accounts that have been registered on the encryption registry.
 */
export function useEncryptionAccounts() {
  const config = useConfig();

  return useQuery({
    queryKey: ["encryption-registry-accounts-fetch", PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS],
    queryFn: () => {
      return readContract(config, {
        abi: EncryptionRegistryAbi,
        address: PUB_ENCRYPTION_REGISTRY_CONTRACT_ADDRESS,
        functionName: "getRegisteredAccounts",
      }).then((accounts) => {
        return Promise.all(
          accounts.map((accountAddress) =>
            readContract(config, {
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
    retry: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 5,
  });
}
