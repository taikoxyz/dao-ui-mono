import type { DecodedNode } from "./types";

/** Truncate a hex string (address / hash) to `0x1234…abcd`; short inputs are returned unchanged. */
export function shortHex(value: string): string {
  return value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/**
 * Summary text for display. Any decode that did NOT come from a verified ABI
 * source — a community signature DB (openchain.xyz, where anyone can register a
 * selector→name mapping), a bytecode guess, or an unknown target — has its
 * friendly sentence prefixed with "Unverified:" so the caveat travels with the
 * claim itself, not only the adjacent trust badge. This is the single source of
 * truth for the caveat: unwrappers never prefix their own summaries.
 */
export function displaySummary(node: Pick<DecodedNode, "summary" | "trust">): string | null {
  if (!node.summary) return null;
  return node.trust !== "verified" ? `Unverified: ${node.summary}` : node.summary;
}
