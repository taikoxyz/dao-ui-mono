import { Address, isAddressEqual } from "viem";
import SecurityCouncilProfiles from "@/data/security-council-profiles.json";

export interface ISecurityCouncilMemberProfile {
  owner: Address;
  appointedAgent?: Address;
  name: string;
}
export default function getSecurityCouncilMemberData(address: Address): ISecurityCouncilMemberProfile {
  const profile = SecurityCouncilProfiles.find((p) => isAddressEqual(p.address as Address, address));
  return {
    owner: address,
    name: profile?.name ?? "",
  };
}
