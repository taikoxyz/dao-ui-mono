import { Address, getAddress, isAddressEqual } from "viem";
import { formatHexString } from "@/utils/evm";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";

export interface ISecurityCouncilMemberProfile {
  owner: Address;
  appointedAgent?: Address;
  name: string;
}

export type SecurityCouncilProfileEntry = {
  address: string;
  name: string;
  description?: string;
  /** Members-tab sort key. Lower first. Omit for historical entries that should sort last if they reappear. */
  order?: number;
};

export type SecurityCouncilProfile = {
  owner: Address;
  name: string;
  description: string;
  order: number;
  hasDirectoryEntry: boolean;
};

function directory(): SecurityCouncilProfileEntry[] {
  return SecurityCouncilProfiles as SecurityCouncilProfileEntry[];
}

/** Overlay addresses only. Live membership comes from SignerList. */
export function getSecurityCouncilDirectoryAddresses(): Address[] {
  return directory().map((entry) => getAddress(entry.address));
}

/**
 * Overlay for on-chain SignerList addresses.
 * Keep departed members in the JSON so historical proposals still show names.
 * New on-chain signers render with a truncated address until a directory row is added.
 */
export function getSecurityCouncilProfile(address: Address): SecurityCouncilProfile {
  const index = directory().findIndex((p) => isAddressEqual(p.address as Address, address));
  const entry = index >= 0 ? directory()[index] : undefined;
  const order =
    entry?.order !== undefined && Number.isFinite(entry.order)
      ? entry.order
      : index >= 0
        ? index + 1
        : Number.POSITIVE_INFINITY;

  return {
    owner: address,
    name: entry?.name?.trim() || formatHexString(address),
    description: entry?.description ?? "",
    order,
    hasDirectoryEntry: index >= 0,
  };
}

export default function getSecurityCouncilMemberData(address: Address): ISecurityCouncilMemberProfile {
  const profile = getSecurityCouncilProfile(address);
  return {
    owner: profile.owner,
    name: profile.name,
  };
}

export function compareSecurityCouncilAddresses(a: Address, b: Address): number {
  const left = getSecurityCouncilProfile(a);
  const right = getSecurityCouncilProfile(b);
  if (left.order !== right.order) return left.order - right.order;
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

export function securityCouncilProfileMatchesQuery(address: Address, query: string | undefined): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const profile = getSecurityCouncilProfile(address);
  return (
    address.toLowerCase().includes(needle) ||
    profile.name.toLowerCase().includes(needle) ||
    profile.description.toLowerCase().includes(needle)
  );
}
