import type { Address } from "viem";
import type { DecodedNode } from "./types";
import {
  PUB_DAO_ADDRESS,
  PUB_TAIKO_BRIDGE_ADDRESS,
  L1_SIGNAL_SERVICE_ADDRESS,
  TAIKO_DAO_CONTROLLER_ADDRESS,
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

// DAO executor addresses: the env-configured OSx DAO plus the checked-in
// TaikoDAOController (the contract standard proposals actually route execute()
// through). PUB_DAO_ADDRESS is env-derived (EMPTY in tests/unconfigured envs);
// TAIKO_DAO_CONTROLLER_ADDRESS is always present, so the set is non-empty in prod.
const EXECUTOR_ADDRESSES = lowerSet([PUB_DAO_ADDRESS, TAIKO_DAO_CONTROLLER_ADDRESS]);

/** True if `address` is a known Taiko bridge / signal-service contract. Set is always non-empty. */
export function isKnownBridge(address: Address): boolean {
  return BRIDGE_ADDRESSES.has(address.toLowerCase());
}

/**
 * True if `node` targets a known DAO executor whose execute(bytes) we will
 * confidently expand into an OSx-style action batch.
 *
 * Gated purely by ADDRESS: the configured OSx DAO (PUB_DAO_ADDRESS) or the
 * checked-in TaikoDAOController (TAIKO_DAO_CONTROLLER_ADDRESS). A verified
 * contract *name* is deliberately NOT trusted — the name is deployer-chosen
 * metadata (anyone can verify a contract literally named "DAO"/"TaikoDAOController"),
 * so it is not an identity boundary. Mirrors isKnownBridge's address gate.
 *
 * The set is empty only when BOTH the env DAO and the controller are unset (a
 * fully-mocked test); there we return true to keep the decode path exercised. In
 * prod the hardcoded controller is always present, so a foreign address is NOT
 * dressed up as a batch.
 */
export function isKnownExecutor(node: Pick<DecodedNode, "to">): boolean {
  if (EXECUTOR_ADDRESSES.size === 0) return true;
  return EXECUTOR_ADDRESSES.has(node.to.toLowerCase());
}
