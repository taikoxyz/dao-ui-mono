import { size, slice, isHex, type Hex } from "viem";
import type { DecodedParam } from "./types";

const MAX_CANDIDATES = 8;

export type Candidate = { path: string; selector: Hex };

function isCalldataBytes(value: unknown): value is Hex {
  if (typeof value !== "string" || !isHex(value)) return false;
  const n = size(value as Hex);
  return n >= 4 && (n - 4) % 32 === 0;
}

function walk(value: unknown, path: string, out: Candidate[]): void {
  if (out.length >= MAX_CANDIDATES) return;
  if (isCalldataBytes(value)) {
    out.push({ path, selector: slice(value, 0, 4) });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walk(v, path ? `${path}.${k}` : k, out);
    }
  }
}

/** Pure walk: selector-prefixed bytes leaves (size >= 4) in decoded params. Never decodes args. */
export function findEmbeddedCandidates(params: DecodedParam[]): Candidate[] {
  const out: Candidate[] = [];
  for (const p of params) {
    if (out.length >= MAX_CANDIDATES) break;
    walk(p.value, p.name || p.type, out);
  }
  return out.slice(0, MAX_CANDIDATES);
}
