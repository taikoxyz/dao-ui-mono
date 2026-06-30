import type { Address } from "viem";
import type { DecodedNode } from "./types";
import {
  PUB_DAO_ADDRESS,
  PUB_TAIKO_BRIDGE_ADDRESS,
  L1_SIGNAL_SERVICE_ADDRESS,
  TAIKO_L2_BRIDGE_ADDRESS,
  TAIKO_L2_SIGNAL_SERVICE_ADDRESS,
} from "@/constants";

/**
 * Single source of truth for "is this address a known protocol contract".
 *
 * Used by unwrappers as an identity gate so a foreign contract that merely
 * exposes a known-looking function signature cannot impersonate a trusted
 * protocol action (e.g. a random contract exposing `sendMessage((tuple))`).
 */

/** Lowercase an address set, dropping any empty/falsy entries (env-derived addresses can be ""). */
function lowerSet(addresses: readonly (Address | string)[]): Set<string> {
  return new Set(addresses.filter((a): a is string => Boolean(a)).map((a) => a.toLowerCase()));
}

// Taiko bridge + signal-service contracts (L1 env-configured, L2 deterministic precompiles).
// Always non-empty: the L2 addresses are hardcoded constants.
const BRIDGE_ADDRESSES = lowerSet([
  PUB_TAIKO_BRIDGE_ADDRESS,
  L1_SIGNAL_SERVICE_ADDRESS,
  TAIKO_L2_BRIDGE_ADDRESS,
  TAIKO_L2_SIGNAL_SERVICE_ADDRESS,
]);

// The DAO executor address. Env-derived, so EMPTY in tests/unconfigured envs.
const EXECUTOR_ADDRESSES = lowerSet([PUB_DAO_ADDRESS]);

// Verified contract names whose execute(bytes) we trust as an OSx-style action
// batch. A node's `name` is only ever populated from a verified Etherscan source,
// so a name match implies trust==="verified". This is the deployment-agnostic
// signal (no per-network executor env var): on mainnet the OSx DAO (0x9CDf…) is
// "DAO" and proposals route execute() through the "TaikoDAOController" (0x75Ba…,
// a separate address from the DAO — see isKnownExecutor). Mirrors
// delegateControllerCall's DELEGATE_NAMES name-gate.
const EXECUTOR_NAMES = new Set(["DAO", "TaikoDAOController"]);

/** True if `address` is a known Taiko bridge / signal-service contract. Set is always non-empty. */
export function isKnownBridge(address: Address): boolean {
  return BRIDGE_ADDRESSES.has(address.toLowerCase());
}

/**
 * True if `node` targets a known DAO executor whose execute(bytes) we will
 * confidently expand into an OSx-style action batch.
 *
 * Recognized two ways: (1) by VERIFIED contract name — the robust,
 * deployment-agnostic signal, since `node.name` is only set from a verified
 * source and the executor address differs per network (and the controller has no
 * env var); (2) by the configured DAO address (PUB_DAO_ADDRESS). The address set
 * is env-derived and EMPTY in tests/unconfigured envs, so when it is empty AND no
 * name matches we return true to keep the decode path exercised; in prod (set
 * populated) a foreign contract whose name isn't allow-listed and whose address
 * isn't the DAO is NOT dressed up as a batch.
 */
export function isKnownExecutor(node: Pick<DecodedNode, "to" | "name">): boolean {
  if (node.name && EXECUTOR_NAMES.has(node.name)) return true;
  if (EXECUTOR_ADDRESSES.size === 0) return true;
  return EXECUTOR_ADDRESSES.has(node.to.toLowerCase());
}
