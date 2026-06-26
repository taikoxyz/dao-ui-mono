import { getAddress, type Address, type Hex } from "viem";
import type { RawCall, Unwrapper } from "../types";
import { shortHex } from "../format";

const UPGRADE_TO_AND_CALL = "0x4f1ef286";

// Gate on the resolved signature, not the bare selector, to avoid mislabeling a
// colliding function on an unrelated contract as a proxy upgrade.
const SIGNATURES = new Set(["upgradeTo(address)", "upgradeToAndCall(address,bytes)"]);

export const uupsUpgrade: Unwrapper = {
  id: "uups-upgrade",
  match: (node) => node.signature != null && SIGNATURES.has(node.signature),
  apply: async (node) => {
    const newImpl = node.params[0]?.value as Address | undefined;
    const summary = newImpl
      ? `Upgrades proxy ${shortHex(node.to)} → implementation ${shortHex(newImpl)}`
      : `Upgrades proxy ${shortHex(node.to)}`;

    const children: RawCall[] = [];
    if (node.selector === UPGRADE_TO_AND_CALL && newImpl) {
      const inner = node.params[1]?.value as Hex | undefined;
      if (inner && inner !== "0x") children.push({ to: getAddress(newImpl), value: 0n, data: inner });
    }
    return { summary, children };
  },
};
