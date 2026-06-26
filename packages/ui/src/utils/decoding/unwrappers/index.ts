import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";
import { uupsUpgrade } from "./uupsUpgrade";
import { erc20 } from "./erc20";
import { accessControl } from "./accessControl";

export const UNWRAPPERS: Unwrapper[] = [osxActionArray, uupsUpgrade, erc20, accessControl];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
