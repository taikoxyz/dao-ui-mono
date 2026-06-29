import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";
import { delegateControllerCall } from "./delegateControllerCall";
import { taikoBridgeMessage } from "./taikoBridgeMessage";
import { uupsUpgrade } from "./uupsUpgrade";
import { erc20 } from "./erc20";
import { accessControl } from "./accessControl";

// Order matters: delegateControllerCall must precede taikoBridgeMessage — both
// match onMessageInvocation, and the stricter (name-gated) one must win; others fall through.
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, delegateControllerCall, taikoBridgeMessage, uupsUpgrade, erc20, accessControl];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
