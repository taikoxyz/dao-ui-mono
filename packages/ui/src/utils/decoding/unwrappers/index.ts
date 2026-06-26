import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";

export const UNWRAPPERS: Unwrapper[] = [osxActionArray];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
