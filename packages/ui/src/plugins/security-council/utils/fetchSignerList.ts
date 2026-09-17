import { Config, readContract } from "@wagmi/core";
import { Address, getAbiItem, isAddressEqual, PublicClient } from "viem";
import { SignerListAbi } from "@/plugins/security-council/artifacts/SignerList";
import { PUB_SIGNER_LIST_CONTRACT_ADDRESS } from "@/constants";
import { getLogsUntilNow } from "@/utils/evm";
import { getSecurityCouncilDirectoryAddresses } from "@/utils/getSecurityCouncilMemberData";

const SignersAddedEvent = getAbiItem({
  abi: SignerListAbi,
  name: "SignersAdded",
});
const SignersRemovedEvent = getAbiItem({
  abi: SignerListAbi,
  name: "SignersRemoved",
});

export type SignerListMutation = {
  blockNumber: bigint;
  logIndex: number;
  added: Address[];
  removed: Address[];
};

/**
 * Replay SignerList add/remove logs in chain order.
 * Addresses are compared case-insensitively so mixed-case event data cannot fork the set.
 */
export function computeCurrentSignerList(mutations: SignerListMutation[]): Address[] {
  const ordered = [...mutations].sort((a, b) => {
    if (a.blockNumber < b.blockNumber) return -1;
    if (a.blockNumber > b.blockNumber) return 1;
    return a.logIndex - b.logIndex;
  });

  const result: Address[] = [];
  for (const item of ordered) {
    for (const addr of item.added) {
      if (!result.some((existing) => isAddressEqual(existing, addr))) result.push(addr);
    }
    for (const addr of item.removed) {
      const idx = result.findIndex((existing) => isAddressEqual(existing, addr));
      if (idx >= 0) result.splice(idx, 1);
    }
  }
  return result;
}

function mergeUnique(left: Address[], right: Address[]): Address[] {
  const result = [...left];
  for (const addr of right) {
    if (!result.some((existing) => isAddressEqual(existing, addr))) result.push(addr);
  }
  return result;
}

async function isListed(config: Config, account: Address): Promise<boolean> {
  return readContract(config, {
    abi: SignerListAbi,
    address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
    functionName: "isListed",
    args: [account],
  });
}

/**
 * Live Security Council roster from SignerList, not the subgraph or the name overlay.
 *
 * Candidates come from add/remove logs (unknown seats) plus the name overlay
 * (known incoming seats). Every candidate is confirmed with on-chain `isListed`
 * so a same-size log gap cannot keep a departed member or drop an incoming one.
 */
export async function fetchSignerListFromChain(publicClient: PublicClient, config: Config): Promise<Address[]> {
  const [addedLogs, removedLogs, onChainLength] = await Promise.all([
    getLogsUntilNow(PUB_SIGNER_LIST_CONTRACT_ADDRESS, SignersAddedEvent, {}, publicClient),
    getLogsUntilNow(PUB_SIGNER_LIST_CONTRACT_ADDRESS, SignersRemovedEvent, {}, publicClient),
    readContract(config, {
      abi: SignerListAbi,
      address: PUB_SIGNER_LIST_CONTRACT_ADDRESS,
      functionName: "addresslistLength",
    }),
  ]);

  const mutations: SignerListMutation[] = [
    ...addedLogs.map((log) => ({
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      added: [...(log.args.signers ?? [])],
      removed: [] as Address[],
    })),
    ...removedLogs.map((log) => ({
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
      added: [] as Address[],
      removed: [...(log.args.signers ?? [])],
    })),
  ];

  const candidates = mergeUnique(computeCurrentSignerList(mutations), getSecurityCouncilDirectoryAddresses());
  const listedFlags = await Promise.all(candidates.map((account) => isListed(config, account)));
  const listed = candidates.filter((_, index) => listedFlags[index]);

  if (listed.length !== Number(onChainLength)) {
    throw new Error(
      `SignerList length mismatch: reconstructed ${listed.length} member(s), contract reports ${onChainLength}. ` +
        "One or more signer addresses are not reachable through log replay or the name overlay."
    );
  }

  return listed;
}
