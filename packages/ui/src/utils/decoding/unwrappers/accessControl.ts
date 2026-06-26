import type { Address } from "viem";
import type { Unwrapper } from "../types";
import { shortHex } from "../format";

const TRANSFER_OWNERSHIP = "0xf2fde38b";
const ACCEPT_OWNERSHIP = "0x79ba5097";
const GRANT_ROLE = "0x2f2ff15d";

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
    return { summary: `${verb} a role on ${shortHex(node.to)}`, children: [] };
  },
};
