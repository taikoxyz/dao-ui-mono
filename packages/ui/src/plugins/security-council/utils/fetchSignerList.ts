import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { Config, readContract } from "@wagmi/core";
import { Address, getAbiItem, isAddress, PublicClient } from "viem";
import { SignerListAbi } from "@/plugins/security-council/artifacts/SignerList";
import { PUB_CHAIN, PUB_DEPLOYMENT_BLOCK, PUB_SIGNER_LIST_CONTRACT_ADDRESS, PUB_SUBGRAPH_URL } from "@/constants";
import { getSecurityCouncilDirectoryAddresses } from "@/utils/getSecurityCouncilMemberData";

const SignersAddedEvent = getAbiItem({ abi: SignerListAbi, name: "SignersAdded" });
const LOG_WINDOW_SIZE = 2000n;

async function getIndexedCandidates(): Promise<Address[]> {
  try {
    const client = new ApolloClient({ uri: PUB_SUBGRAPH_URL, cache: new InMemoryCache() });
    const { data } = await client.query<{ signers: { id: string }[] }>({
      query: gql`
        query GetSigners {
          signers {
            id
          }
        }
      `,
    });
    return (data?.signers ?? []).map(({ id }) => id).filter((id): id is Address => isAddress(id, { strict: false }));
  } catch (error) {
    // Indexing is only a discovery aid; known members can still be checked on L1.
    console.warn("Could not load indexed signer candidates", error);
    return [];
  }
}

/**
 * Validate cheap candidates at one L1 block. Historical logs are only needed if
 * the verified roster is shorter than the contract's count at that same block.
 * Cached discoveries are revalidated too, so departed members never persist.
 */
export async function fetchSignerListFromChain(
  publicClient: PublicClient,
  config: Config,
  cachedSigners: Address[] = []
): Promise<Address[]> {
  const [blockNumber, indexedCandidates] = await Promise.all([
    publicClient.getBlockNumber({ cacheTime: 0 }),
    getIndexedCandidates(),
  ]);
  const contract = {
    abi: SignerListAbi,
    address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
    chainId: PUB_CHAIN.id,
    blockNumber,
  } as const;
  const checked = new Set<string>();
  const listed: Address[] = [];

  async function confirm(candidates: Address[]) {
    const unchecked = candidates.filter((account) => {
      const key = account.toLowerCase();
      if (checked.has(key)) return false;
      checked.add(key);
      return true;
    });
    const flags = await Promise.all(
      unchecked.map((account) => readContract(config, { ...contract, functionName: "isListed", args: [account] }))
    );
    listed.push(...unchecked.filter((_, index) => flags[index]));
  }

  const [onChainLength] = await Promise.all([
    readContract(config, { ...contract, functionName: "addresslistLength" }),
    confirm([...getSecurityCouncilDirectoryAddresses(), ...cachedSigners, ...indexedCandidates]),
  ]);
  if (BigInt(listed.length) === onChainLength) return listed;

  try {
    // Add events discover addresses; isListed at the snapshot rejects removals
    // and stale subgraph/overlay entries. No removal replay is necessary.
    for (let fromBlock = PUB_DEPLOYMENT_BLOCK; fromBlock <= blockNumber; fromBlock += LOG_WINDOW_SIZE) {
      const windowEnd = fromBlock + LOG_WINDOW_SIZE - 1n;
      const logs = await publicClient.getLogs({
        address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
        event: SignersAddedEvent,
        fromBlock,
        toBlock: windowEnd < blockNumber ? windowEnd : blockNumber,
      });
      await confirm(logs.flatMap((log) => log.args.signers ?? []));
      if (BigInt(listed.length) === onChainLength) return listed;
    }
  } catch (error) {
    // Keep the members already verified at the snapshot, even if discovery is
    // unavailable. Returning them also avoids retrying the entire history.
    console.warn("Could not finish signer discovery", error);
  }
  console.warn(`Resolved ${listed.length} of ${onChainLength} Security Council members at block ${blockNumber}.`);
  return listed;
}
