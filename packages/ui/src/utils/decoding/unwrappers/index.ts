import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";
import { delegateControllerCall } from "./delegateControllerCall";
import { taikoBridgeMessage } from "./taikoBridgeMessage";
import { uupsUpgrade } from "./uupsUpgrade";
import { erc20 } from "./erc20";
import { accessControl } from "./accessControl";

// First matching unwrapper wins. The match predicates are mutually exclusive by
// function/identity (delegateControllerCall → onMessageInvocation on a named delegate;
// taikoBridgeMessage → sendMessage on a known bridge), so ordering here is not
// load-bearing for correctness — it only sets evaluation order.
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, delegateControllerCall, taikoBridgeMessage, uupsUpgrade, erc20, accessControl];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
