import type { DecodedNode } from "./types";

/** Truncate a hex string (address / hash) to `0x1234…abcd`; short inputs are returned unchanged. */
export function shortHex(value: string): string {
  return value.startsWith("0x") && value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/**
 * Summary text for display. When the decode relied on a community signature DB
 * (openchain.xyz — anyone can register a selector→name mapping), the friendly
 * sentence is prefixed with "Unverified:" so the caveat travels with the claim
 * itself, not only the adjacent trust badge.
 */
export function displaySummary(node: Pick<DecodedNode, "summary" | "trust">): string | null {
  if (!node.summary) return null;
  return node.trust === "signature-db" ? `Unverified: ${node.summary}` : node.summary;
}
