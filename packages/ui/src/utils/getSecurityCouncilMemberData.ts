import { Address, isAddressEqual } from "viem";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";

export interface ISecurityCouncilMemberProfile {
  owner: Address;
  appointedAgent?: Address;
  name: string;
}

type DirectoryEntry = {
  address: string;
  name: string;
  description?: string;
  priorNames?: { name: string; untilBlock: number }[];
};

const DIRECTORY: DirectoryEntry[] = (SecurityCouncilProfiles as DirectoryEntry[]).map((entry) => ({
  ...entry,
  priorNames: entry.priorNames?.slice().sort((left, right) => left.untilBlock - right.untilBlock),
}));

function nameAtBlock(entry: DirectoryEntry | undefined, asOfBlock?: number | bigint | null): string {
  if (!entry) return "";
  if (asOfBlock === undefined || asOfBlock === null) return entry.name ?? "";
  const block = Number(asOfBlock);
  if (!Number.isFinite(block)) return entry.name ?? "";
  const prior = entry.priorNames?.find((alias) => block < alias.untilBlock);
  return prior?.name ?? entry.name ?? "";
}

/**
 * Overlay for a listed address. Pass a proposal's `creationBlockNumber` so a
 * reused council wallet can show its earlier name. L2BEAT → Sebastian Kugler
 * at L1 block 25997731 (9→5 roster execute, tx 0x89453a1b).
 * Omit the block for the live Members tab.
 */
export default function getSecurityCouncilMemberData(
  address: Address,
  asOfBlock?: number | bigint | null
): ISecurityCouncilMemberProfile {
  const profile = DIRECTORY.find((entry) => isAddressEqual(entry.address as Address, address));
  return {
    owner: address,
    name: nameAtBlock(profile, asOfBlock),
  };
}
