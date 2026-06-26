import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";
import { uupsUpgrade } from "./uupsUpgrade";

export const UNWRAPPERS: Unwrapper[] = [osxActionArray, uupsUpgrade];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
