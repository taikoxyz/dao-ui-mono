import { PUB_CHAIN } from "@/constants";
import { decodeCamelCase } from "@/utils/case";
import { displaySummary } from "@/utils/decoding/format";
import type { DecodedNode, TrustLevel } from "@/utils/decoding/types";

// Pure view-model helpers for the proposal-action tree. No JSX lives here — the
// rendering components in actionNode.tsx consume these.

export type Lead = { text: string; hex?: string };

// Trust ranking, most → least trusted. Single source of truth for ordering trust
// levels (used by worstTrust to fold a subtree to its weakest link).
const TRUST_RANK: Record<TrustLevel, number> = {
  verified: 3,
  bytecode: 2,
  "signature-db": 1,
  unknown: 0,
};

/**
 * The least-trusted trust level across `node` AND all its descendants. A
 * collapsed wrapper (bridge/batch) can be "verified" itself while hiding an
 * unverified child; the collapsed header shows THIS so an unverified descendant
 * can't masquerade as verified until the row is expanded.
 */
export function worstTrust(node: DecodedNode): TrustLevel {
  let worst = node.trust;
  for (const child of node.children) {
    const childWorst = worstTrust(child);
    if (TRUST_RANK[childWorst] < TRUST_RANK[worst]) worst = childWorst;
  }
  return worst;
}

// Carry displaySummary's "Unverified:" caveat onto a NON-summary fallback lead
// (a guessed function-name / setXTrusted text), so a guess carries the caveat in
// the headline too. Matches displaySummary's wording; the summary path is already
// caveated there, so it must NOT be passed through this.
function caveatLead(text: string, trust: TrustLevel): string {
  return trust !== "verified" ? `Unverified: ${text}` : text;
}

/**
 * Plain-English "impact" lead for a call. Priority:
 *  1. a recognized-pattern summary (upgrade / transfer / ownership / batch)
 *  2. a `set<Thing>Trusted(id, bool)` heuristic → "Trust/Untrust <thing> <id>"
 *  3. the friendly function name (never invented)
 *
 * Structured so the embedded identifier (a key/hash, not an address) can be made copyable.
 */
export function leadParts(node: DecodedNode): Lead {
  const summary = displaySummary(node);
  if (summary) return { text: summary };
  const fn = node.functionName;
  if (!fn) return { text: node.selector ? "Unrecognized call" : `Transfer ${PUB_CHAIN.nativeCurrency.symbol}` };

  // Strict set<Thing>Trusted(id, bool): require EXACTLY one bool param so the
  // trust flag is unambiguous. The old "first positional bool" heuristic could
  // invert Trust/Untrust on multi-bool calldata — fall back to the plain name then.
  const boolParams = node.params.filter((p) => p.type === "bool");
  if (/trusted$/i.test(fn) && boolParams.length === 1) {
    const subject = decodeCamelCase(fn.replace(/^set/i, "").replace(/trusted$/i, "")).toLowerCase().trim();
    const idParam = node.params.find((p) => p.type !== "bool");
    const verb = boolParams[0].value ? "Trust" : "Untrust";
    return { text: caveatLead(`${verb} ${subject}`.trim(), node.trust), hex: idParam ? String(idParam.value) : undefined };
  }
  return { text: caveatLead(decodeCamelCase(fn), node.trust) };
}

/**
 * Display label for a call target's verified contract name(s).
 *  - proxy + impl (distinct) → "Proxy → Impl"
 *  - just one name           → that name
 *  - identical names         → the single name
 *  - neither                 → null (caller renders hex only)
 */
export function contractLabel(node: Pick<DecodedNode, "name" | "proxyName">): string | null {
  const { name, proxyName } = node;
  if (name && proxyName && name !== proxyName) return `${proxyName} → ${name}`;
  return name ?? proxyName ?? null;
}

const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 167000: "Taiko", 167009: "Taiko Hekla" };

/** Short label for a call's chain when it differs from the app chain; null for the app chain. */
export function chainLabel(chainId: number): string | null {
  if (chainId === PUB_CHAIN.id) return null;
  return CHAIN_NAMES[chainId] ?? `chain ${chainId}`;
}

/** Hierarchical action number: childNumber("", 0)→"1", childNumber("3", 1)→"3.2". */
export function childNumber(prefix: string, index: number): string {
  return prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
}

/** Short, human type for a param: the struct name from internalType, else the solidity type. */
function shortType(p: DecodedNode["params"][number]): string {
  const it = p.internalType;
  if (it && it.startsWith("struct ")) return it.slice("struct ".length); // "IBridge.Message" / "IBridge.Message[]"
  return p.type;
}

/**
 * A readable signature for the inputs panel. `short` names each param with a
 * friendly type (struct names instead of inlined tuples); `full` is the
 * canonical signature for the "full signature" toggle. `short` is null when the
 * function name is unknown.
 */
export function friendlySignature(
  node: Pick<DecodedNode, "functionName" | "signature" | "params">,
): { short: string | null; full: string | null } {
  const fn = node.functionName;
  if (!fn) return { short: null, full: node.signature };
  const args = node.params.map((p) => `${shortType(p)} ${p.name}`.trim()).join(", ");
  return { short: `${fn}(${args})`, full: node.signature };
}
