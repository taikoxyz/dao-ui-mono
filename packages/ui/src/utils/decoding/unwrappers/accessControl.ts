import type { Address } from "viem";
import type { Unwrapper } from "../types";

const TRANSFER_OWNERSHIP = "0xf2fde38b";
const ACCEPT_OWNERSHIP = "0x79ba5097";
const GRANT_ROLE = "0x2f2ff15d";
const REVOKE_ROLE = "0xd547741f";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const accessControl: Unwrapper = {
  id: "access-control",
  match: (node) =>
    [TRANSFER_OWNERSHIP, ACCEPT_OWNERSHIP, GRANT_ROLE, REVOKE_ROLE].includes(node.selector ?? ""),
  apply: async (node) => {
    if (node.selector === TRANSFER_OWNERSHIP) {
      return { summary: `Transfers ownership of ${short(node.to)} → ${short(node.params[0]?.value as Address)}`, children: [] };
    }
    if (node.selector === ACCEPT_OWNERSHIP) {
      return { summary: `Accepts ownership of ${short(node.to)}`, children: [] };
    }
    const verb = node.selector === GRANT_ROLE ? "Grants" : "Revokes";
    return { summary: `${verb} a role on ${short(node.to)}`, children: [] };
  },
};
