import { getAddress, type Address, type Hex } from "viem";
import type { RawCall, Unwrapper } from "../types";

const UPGRADE_TO = "0x3659cfe6";
const UPGRADE_TO_AND_CALL = "0x4f1ef286";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const uupsUpgrade: Unwrapper = {
  id: "uups-upgrade",
  match: (node) => node.selector === UPGRADE_TO || node.selector === UPGRADE_TO_AND_CALL,
  apply: async (node) => {
    const newImpl = node.params[0]?.value as Address | undefined;
    const summary = newImpl
      ? `Upgrades proxy ${short(node.to)} → implementation ${short(newImpl)}`
      : `Upgrades proxy ${short(node.to)}`;

    const children: RawCall[] = [];
    if (node.selector === UPGRADE_TO_AND_CALL && newImpl) {
      const inner = node.params[1]?.value as Hex | undefined;
      if (inner && inner !== "0x") children.push({ to: getAddress(newImpl), value: 0n, data: inner });
    }
    return { summary, children };
  },
};
