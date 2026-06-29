import { PUB_CHAIN } from "@/constants";
import { decodeCamelCase } from "@/utils/case";
import { displaySummary } from "@/utils/decoding/format";
import type { DecodedNode } from "@/utils/decoding/types";

// Pure view-model helpers for the proposal-action tree. No JSX lives here — the
// rendering components in actionNode.tsx consume these.

export type Lead = { text: string; hex?: string };

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

  const boolParam = node.params.find((p) => p.type === "bool");
  if (/trusted$/i.test(fn) && boolParam) {
    const subject = decodeCamelCase(fn.replace(/^set/i, "").replace(/trusted$/i, "")).toLowerCase().trim();
    const idParam = node.params.find((p) => p.type !== "bool");
    const verb = boolParam.value ? "Trust" : "Untrust";
    return { text: `${verb} ${subject}`.trim(), hex: idParam ? String(idParam.value) : undefined };
  }
  return { text: decodeCamelCase(fn) };
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
