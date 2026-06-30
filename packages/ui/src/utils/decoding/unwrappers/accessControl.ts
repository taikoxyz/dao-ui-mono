import { keccak256, toBytes, type Address } from "viem";
import type { Unwrapper } from "../types";
import { shortHex } from "../format";

const TRANSFER_OWNERSHIP = "0xf2fde38b";
const ACCEPT_OWNERSHIP = "0x79ba5097";
const GRANT_ROLE = "0x2f2ff15d";

// Well-known OpenZeppelin AccessControl role hashes → human labels, so a privilege
// change like granting DEFAULT_ADMIN_ROLE reads as an escalation rather than an
// opaque 32-byte hash. DEFAULT_ADMIN_ROLE is the zero hash by convention; every
// other role is keccak256(<role name>). Keys are lowercase to match how role
// bytes32 values arrive from the decoder.
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const KNOWN_ROLES: Record<string, string> = {
  [DEFAULT_ADMIN_ROLE]: "DEFAULT_ADMIN_ROLE",
  ...Object.fromEntries(
    ["MINTER_ROLE", "BURNER_ROLE", "PAUSER_ROLE", "UPGRADER_ROLE"].map((name) => [keccak256(toBytes(name)), name]),
  ),
};

/** Human label for a role hash when it's a recognized role, otherwise its short hex. */
function roleLabel(role: string): string {
  return KNOWN_ROLES[role.toLowerCase()] ?? shortHex(role);
}

// Gate on the resolved signature so a selector collision on an unrelated contract
// can't be mislabeled as an ownership/role change.
const SIGNATURES = new Set([
  "transferOwnership(address)",
  "acceptOwnership()",
  "grantRole(bytes32,address)",
  "revokeRole(bytes32,address)",
]);

export const accessControl: Unwrapper = {
  id: "access-control",
  match: (node) => node.signature != null && SIGNATURES.has(node.signature),
  apply: async (node) => {
    if (node.selector === TRANSFER_OWNERSHIP) {
      return {
        summary: `Transfers ownership of ${shortHex(node.to)} → ${shortHex(node.params[0]?.value as Address)}`,
        children: [],
      };
    }
    if (node.selector === ACCEPT_OWNERSHIP) {
      return { summary: `Accepts ownership of ${shortHex(node.to)}`, children: [] };
    }
    const verb = node.selector === GRANT_ROLE ? "Grants" : "Revokes";
    const role = node.params[0]?.value as string | undefined;
    const account = node.params[1]?.value as Address | undefined;
    // Defensive fallback: a malformed decode could leave the role/account params
    // missing. Surface the old shape rather than render "to undefined".
    if (role == null || account == null) {
      return { summary: `${verb} a role on ${shortHex(node.to)}`, children: [] };
    }
    const preposition = node.selector === GRANT_ROLE ? "to" : "from";
    return { summary: `${verb} role ${roleLabel(role)} ${preposition} ${shortHex(account)}`, children: [] };
  },
};
