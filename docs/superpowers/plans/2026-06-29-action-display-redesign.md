# Proposal Action Display Redesign (F1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nested card-in-card proposal-action view with the approved "F1" design — numbered accordion rows, a full-width Inputs panel with typed params, friendly+expandable signatures, honest trust degradation — and remove all dead code from the old rendering.

**Architecture:** A small additive decode-layer enrichment gives params their `internalType` + nested tuple `components`. The rendering in `proposalActions/` is rewritten to the F1 layout. The decoder, unwrappers, resolver, and the public `ProposalActions` props are unchanged.

**Tech Stack:** TypeScript, React 18, viem, @aragon/ods, Tailwind, vitest.

## Global Constraints

- Package manager **pnpm**; from `packages/ui` run `./node_modules/.bin/vitest run <path>`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/eslint <files>`. Lint is `--max-warnings=0` — no unused imports/vars.
- **Visual source of truth:** `docs/superpowers/specs/assets/2026-06-29-action-display-mockup-prop28.html` (deep cross-chain) and `…-prop29.html` (single action). Match these.
- **No dead code:** after the rewrite, every exported symbol in `packages/ui/src/components/proposalActions/` must have a consumer (or be the public `ProposalActions`). Delete old rendering components/helpers that become unused — verify each with a usage grep before deleting. Keep `callParamField.tsx` (used by `calldata-form.tsx`).
- **Trust honesty (unchanged):** friendly title only for recognized patterns (`displaySummary`/`leadParts`), else humanized function name; unverified contract → address only; `signature-db` params shown but flagged; undecodable → raw only (existing `EncodedView`).
- Enrichment is additive and optional (`internalType?`, `components?`); existing `params[i].name/type/value` semantics and all current decoding tests stay green.
- App chain id is `PUB_CHAIN.id`; chain labels: 1→Ethereum, 167000→Taiko, 167009→Taiko Hekla (existing `chainLabel`).

---

## Task 1: Decode-layer — typed & nested params (`internalType` + `components`)

**Files:**
- Create: `packages/ui/src/utils/decoding/params.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/params.test.ts`
- Modify: `packages/ui/src/utils/decoding/types.ts` (extend `DecodedParam`)
- Modify: `packages/ui/src/utils/decoding/decodeAction.ts` (use the builder)

**Interfaces:**
- Produces: `buildParams(inputs: readonly AbiParameter[], values: readonly unknown[]): DecodedParam[]` — maps ABI inputs + decoded values to `DecodedParam[]`, recursing `tuple` types into `components`, capturing `internalType`.
- `DecodedParam` gains `internalType?: string` and `components?: DecodedParam[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/params.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { AbiParameter } from "viem";
import { buildParams } from "../params";

describe("buildParams", () => {
  it("maps flat params to name/type/value", () => {
    const inputs: AbiParameter[] = [{ name: "newOwner", type: "address" }];
    const out = buildParams(inputs, ["0xabc"]);
    expect(out).toEqual([{ name: "newOwner", type: "address", value: "0xabc", internalType: undefined }]);
  });

  it("captures internalType when present", () => {
    const inputs: AbiParameter[] = [{ name: "x", type: "address", internalType: "contract IFoo" }];
    expect(buildParams(inputs, ["0x1"])[0].internalType).toBe("contract IFoo");
  });

  it("recurses a tuple into named, typed components (value as object)", () => {
    const inputs: AbiParameter[] = [{
      name: "message", type: "tuple", internalType: "struct IBridge.Message",
      components: [{ name: "destChainId", type: "uint64" }, { name: "to", type: "address" }],
    }];
    const out = buildParams(inputs, [{ destChainId: 167000n, to: "0xfa06" }]);
    expect(out[0].type).toBe("tuple");
    expect(out[0].internalType).toBe("struct IBridge.Message");
    expect(out[0].components).toEqual([
      { name: "destChainId", type: "uint64", value: 167000n, internalType: undefined },
      { name: "to", type: "address", value: "0xfa06", internalType: undefined },
    ]);
  });

  it("recurses a tuple when the value is an array (unnamed)", () => {
    const inputs: AbiParameter[] = [{
      name: "m", type: "tuple",
      components: [{ name: "a", type: "uint64" }, { name: "b", type: "address" }],
    }];
    const out = buildParams(inputs, [[5n, "0xbb"]]);
    expect(out[0].components?.map((c) => c.value)).toEqual([5n, "0xbb"]);
  });

  it("does not recurse non-tuple types (arrays stay flat)", () => {
    const inputs: AbiParameter[] = [{ name: "ids", type: "uint256[]" }];
    const out = buildParams(inputs, [[1n, 2n]]);
    expect(out[0].components).toBeUndefined();
    expect(out[0].value).toEqual([1n, 2n]);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/params.test.ts`
Expected: FAIL — `../params` does not exist.

- [ ] **Step 3: Add the type fields**

In `packages/ui/src/utils/decoding/types.ts`, extend `DecodedParam`:

```typescript
export type DecodedParam = {
  name: string;
  type: string;
  value: EvmValue;
  formatted?: string;
  /** ABI internalType (e.g. "struct IBridge.Message"), when available from a verified ABI. */
  internalType?: string;
  /** Decoded sub-params for a `tuple` type, so struct fields render with names + types. */
  components?: DecodedParam[];
};
```

- [ ] **Step 4: Implement `buildParams`**

Create `packages/ui/src/utils/decoding/params.ts`:

```typescript
import type { AbiParameter } from "viem";
import type { DecodedParam, EvmValueLike } from "./types";

/** Read a tuple field from viem's decode, whether it returned an object (named) or an array. */
function readField(value: unknown, name: string | undefined, index: number): unknown {
  if (Array.isArray(value)) return value[index];
  if (value && typeof value === "object" && name) return (value as Record<string, unknown>)[name];
  return undefined;
}

function buildParam(input: AbiParameter, value: unknown): DecodedParam {
  const base: DecodedParam = {
    name: input.name ?? "",
    type: input.type,
    value: value as DecodedParam["value"],
    internalType: (input as { internalType?: string }).internalType,
  };
  const components = (input as { components?: readonly AbiParameter[] }).components;
  if (input.type === "tuple" && components && components.length) {
    base.components = components.map((c, i) => buildParam(c, readField(value, c.name, i)));
  }
  return base;
}

/**
 * Map ABI inputs + decoded argument values to DecodedParams. Recurses `tuple`
 * types into `components` so struct fields render with names + types. Pure; never
 * throws (a shape mismatch just yields the flat param with undefined children).
 */
export function buildParams(inputs: readonly AbiParameter[], values: readonly unknown[]): DecodedParam[] {
  return inputs.map((inp, i) => buildParam(inp, values[i]));
}

// `EvmValueLike` import kept minimal; buildParam casts to DecodedParam["value"].
export type { EvmValueLike };
```

Note: if `EvmValueLike` does not already exist in `types.ts`, drop that import and the re-export line — they are only a convenience. The function only needs `DecodedParam`. Adjust imports so eslint is clean (no unused import).

- [ ] **Step 5: Run the test — verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/params.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire `buildParams` into `decodeAction`**

In `packages/ui/src/utils/decoding/decodeAction.ts`, add the import:

```typescript
import { buildParams } from "./params";
```

Replace the inline param mapping (the `node.params = fnAbi.inputs.map(...)` block) with:

```typescript
      node.functionName = fnAbi.name;
      node.signature = toFunctionSignature(fnAbi);
      node.params = buildParams(fnAbi.inputs, args as readonly unknown[]);
```

- [ ] **Step 7: Run the full decoding suite + type-check**

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS (existing tests unaffected — top-level `name/type/value` unchanged).

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/utils/decoding/params.ts src/utils/decoding/types.ts src/utils/decoding/decodeAction.ts src/utils/decoding/__tests__/params.test.ts
git commit -m "feat(decoding): typed & nested params (internalType + tuple components)"
```

---

## Task 2: Pure view-model helpers (numbering + friendly signature) and prune dead helpers

**Files:**
- Modify: `packages/ui/src/components/proposalActions/actionNode.helpers.ts`
- Modify: `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`

**Interfaces:**
- Produces:
  - `childNumber(prefix: string, index: number): string` — `childNumber("", 0) === "1"`, `childNumber("3", 1) === "3.2"`.
  - `friendlySignature(node: Pick<DecodedNode,"functionName"|"signature"|"params">): { short: string | null; full: string | null }` — `short` uses each param's struct name (from `internalType`) + name; `full` is the canonical `node.signature`.
- Keep: `leadParts`, `contractLabel`, `chainLabel`. Remove (after grep confirms no remaining use post-Task 3/4): `paramDisplay`, `callTag`, `groupChildren`, and the `Lead`/`GroupItem`/`ChildGroup` types.

- [ ] **Step 1: Write the failing tests**

Add to `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`:

```typescript
import { childNumber, friendlySignature } from "../actionNode.helpers";

describe("childNumber", () => {
  it("numbers top-level rows from 1", () => {
    expect(childNumber("", 0)).toBe("1");
    expect(childNumber("", 2)).toBe("3");
  });
  it("nests under the parent number", () => {
    expect(childNumber("3", 0)).toBe("3.1");
    expect(childNumber("3.1", 1)).toBe("3.1.2");
  });
});

describe("friendlySignature", () => {
  it("uses the struct name from internalType for the short form", () => {
    const node = {
      functionName: "sendMessage",
      signature: "sendMessage((uint64,address))",
      params: [{ name: "message", type: "tuple", value: {}, internalType: "struct IBridge.Message" }],
    };
    const s = friendlySignature(node as any);
    expect(s.short).toBe("sendMessage(IBridge.Message message)");
    expect(s.full).toBe("sendMessage((uint64,address))");
  });
  it("falls back to the solidity type when no internalType", () => {
    const node = { functionName: "upgradeTo", signature: "upgradeTo(address)",
      params: [{ name: "newImplementation", type: "address", value: "0x" }] };
    expect(friendlySignature(node as any).short).toBe("upgradeTo(address newImplementation)");
  });
  it("returns null short when there is no function name", () => {
    expect(friendlySignature({ functionName: null, signature: null, params: [] } as any).short).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: FAIL — `childNumber`/`friendlySignature` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `packages/ui/src/components/proposalActions/actionNode.helpers.ts`:

```typescript
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
```

- [ ] **Step 4: Run — verify it passes**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check (helpers only; dead-helper removal happens in Task 4 after consumers are gone)**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/proposalActions/actionNode.helpers.ts src/components/proposalActions/__tests__/actionNode.helpers.test.ts
git commit -m "feat(proposalActions): add childNumber + friendlySignature view helpers"
```

---

## Task 3: Rewrite `actionNode.tsx` to the F1 rendering

**Files:**
- Modify (full rewrite): `packages/ui/src/components/proposalActions/actionNode.tsx`

**Interfaces:**
- Consumes: `buildParams` output (`DecodedParam` with `internalType`/`components`), `childNumber`, `friendlySignature`, `leadParts`, `contractLabel`, `chainLabel` (helpers); `displaySummary`, `shortHex` (`@/utils/decoding/format`); `formatHexString` (`@/utils/evm`); `TrustBadge` (`./trustBadge`); `EncodedView` (`./encodedView`); `CopyButton` (`@/components/copy/copyButton`); `PUB_CHAIN`.
- Produces: `ActionNodeBody: React.FC<{ node: DecodedNode }>` (the only export; consumed by `proposalActions.tsx`).

> This is a React view rewrite. There is no component-render test harness in this repo (consistent with prior UI tasks); verify with `tsc --noEmit` + eslint + the controller's live check. Do NOT add a render-test harness.

- [ ] **Step 1: Replace the entire file contents**

Replace `packages/ui/src/components/proposalActions/actionNode.tsx` with:

```tsx
import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { decodeCamelCase } from "@/utils/case";
import Link from "next/link";
import { formatEther } from "viem";
import type { DecodedNode, DecodedParam } from "@/utils/decoding/types";
import { shortHex, displaySummary } from "@/utils/decoding/format";
import { childNumber, friendlySignature, leadParts, contractLabel, chainLabel } from "./actionNode.helpers";
import { EncodedView } from "./encodedView";
import { TrustBadge } from "./trustBadge";
import { CopyButton } from "@/components/copy/copyButton";

// ---------- small pieces ----------

const AddrLink: React.FC<{ address: string; label?: string | null }> = ({ address, label }) => (
  <span className="inline-flex items-center gap-x-1">
    {label && <span className="font-semibold text-neutral-700">{label}</span>}
    <Link
      href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${address}`}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-neutral-500 hover:underline"
    >
      {formatHexString(address)}
    </Link>
    <CopyButton value={address} />
  </span>
);

/** A decoded value rendered to a string (bigint-safe; arrays/objects flattened). */
function valueText(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (value && typeof value === "object")
    return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

const TYPE_CHIP = "rounded-md bg-primary-50 px-1.5 font-mono text-[10.5px] text-primary-700";

/** One parameter row: name + type chip → value (address links; tuples recurse; bytes-that-became-children noted). */
const ParamItem: React.FC<{ p: DecodedParam; childrenDecoded: boolean }> = ({ p, childrenDecoded }) => {
  const isBytesExpanded = p.type === "bytes" && childrenDecoded;
  return (
    <div className="grid grid-cols-[minmax(120px,200px)_1fr] items-start gap-x-3 gap-y-1 py-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold text-neutral-700">{p.name || "(unnamed)"}</span>
        <span className={TYPE_CHIP}>{p.type}</span>
      </span>
      {p.components && p.components.length > 0 ? (
        <div className="flex flex-col gap-y-1">
          {p.components.map((c, i) => (
            <ParamItem key={i} p={c} childrenDecoded={childrenDecoded} />
          ))}
        </div>
      ) : isBytesExpanded ? (
        <span className="text-sm italic text-l2-600">↓ decoded as the action(s) below</span>
      ) : p.type === "address" ? (
        <AddrLink address={String(p.value)} />
      ) : (
        <span className="flex min-w-0 items-start gap-x-1">
          <span className="break-all font-mono text-xs text-neutral-700">{p.formatted ?? valueText(p.value)}</span>
          {String(p.value).length > 18 && <CopyButton value={String(p.value)} />}
        </span>
      )}
    </div>
  );
};

/** The full-width Inputs panel: signature (friendly + full toggle), typed params, embedded calls, value, raw calldata. */
const InputsPanel: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.error || (!node.functionName && !node.summary)) {
    return <EncodedView rawAction={{ to: node.to, value: node.value, data: node.data }} />;
  }
  const sig = friendlySignature(node);
  const hasChildren = node.children.length > 0;
  const symbol = PUB_CHAIN.nativeCurrency.symbol;
  const unverified = node.trust === "signature-db";

  return (
    <div className={`rounded-lg border px-3 py-3 ${unverified ? "border-warning-200 bg-warning-50" : "border-neutral-100 bg-neutral-50"}`}>
      {unverified && (
        <p className="mb-2 text-xs text-warning-800">⚠ Decoded from an unverified signature — verify against raw calldata.</p>
      )}
      {sig.short && (
        <details className="mb-2">
          <summary className="cursor-pointer list-none font-mono text-xs text-neutral-600">
            {sig.short}
            {sig.full && sig.full !== sig.short && <span className="ml-2 font-sans font-semibold text-primary-500">▸ full signature</span>}
          </summary>
          {sig.full && sig.full !== sig.short && (
            <pre className="mt-2 whitespace-pre-wrap break-all rounded-md border border-neutral-100 bg-neutral-0 p-2 font-mono text-[11px] text-neutral-500">
              {sig.full}
            </pre>
          )}
        </details>
      )}
      {node.params.length > 0 ? (
        node.params.map((p, i) => <ParamItem key={i} p={p} childrenDecoded={hasChildren} />)
      ) : (
        <p className="text-sm text-neutral-500">No input parameters.</p>
      )}
      {node.embeddedCalls && node.embeddedCalls.length > 0 && (
        <div className="mt-2 flex flex-col gap-y-1 rounded-md border border-warning-200 bg-warning-50 px-3 py-2">
          <span className="text-xs font-semibold text-warning-800">Encoded call(s) detected — Unverified</span>
          {node.embeddedCalls.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-700">
              <span className="font-mono text-neutral-500">{e.path}</span>
              <span>→</span>
              <span className="font-medium">{e.signature ?? "unknown function"}</span>
              <span className="font-mono text-neutral-500">{shortHex(e.selector)}</span>
            </div>
          ))}
        </div>
      )}
      {node.value > 0n && (
        <p className="mt-2 text-sm text-neutral-600">
          {symbol} value: {formatEther(node.value)} {symbol}
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer list-none text-xs text-neutral-500">▸ Raw calldata</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-neutral-0 p-2 text-[11px] text-neutral-700">
          {node.data}
        </pre>
      </details>
    </div>
  );
};

/** Title line for a row: the recognized summary, else the humanized function name, else a fallback. */
function rowTitle(node: DecodedNode): string {
  const lead = leadParts(node);
  return lead.text;
}

/** One numbered accordion action row; expands the Inputs panel and recurses into children. */
const ActionRow: React.FC<{ node: DecodedNode; number: string }> = ({ node, number }) => {
  const label = contractLabel(node);
  const chain = chainLabel(node.chainId);
  const isChild = number.includes(".");
  return (
    <div className={isChild ? "border-l-2 border-l-l2-100 pl-3" : ""}>
      <details className="group border-t border-neutral-100 first:border-t-0">
        <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-start gap-x-3 rounded-lg px-1 py-3 hover:bg-neutral-50">
          <span
            className={`flex h-6 min-w-[30px] items-center justify-center rounded-md px-1.5 font-mono text-xs font-bold ${
              isChild ? "bg-l2-50 text-l2-700" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {number}
          </span>
          <span className="min-w-0">
            <span className="font-semibold leading-tight text-neutral-800">{rowTitle(node)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
              on <AddrLink address={node.to} label={label} />
              {node.functionName && (
                <span className="rounded-md bg-neutral-100 px-1.5 font-mono text-[11px] text-neutral-500">{node.functionName}</span>
              )}
            </span>
            <span className="mt-1.5 inline-flex items-center gap-x-1 text-sm font-semibold text-primary-500">
              <span className="inline-block text-[11px] transition-transform group-open:rotate-90">▸</span> Inputs
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap justify-end gap-1 pt-0.5">
            <TrustBadge trust={node.trust} />
            {chain && (
              <span className="rounded-full bg-l2-50 px-2 py-0.5 text-[11px] font-semibold text-l2-700">↗ {chain}</span>
            )}
          </span>
        </summary>
        <div className="mb-3 ml-[42px]">
          <InputsPanel node={node} />
        </div>
      </details>
      {node.children.length > 0 && (
        <div className="ml-3 border-l-2 border-l-l2-100 pl-3">
          {node.children.map((c, i) => (
            <ActionRow key={i} node={c} number={childNumber(number, i)} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Body of a top-level proposal action. A wrapper (e.g. execute-batch) shows a
 * batch header + its numbered child rows; a leaf shows its own inputs.
 */
export const ActionNodeBody: React.FC<{ node: DecodedNode }> = ({ node }) => {
  if (node.children.length > 0) {
    const label = contractLabel(node);
    return (
      <div className="flex flex-col">
        <p className="px-1 pb-2 text-xs text-neutral-500">
          Executes a batch of {node.children.length} via{" "}
          {label && <span className="font-semibold text-neutral-700">{label} </span>}
          <span className="font-mono">{formatHexString(node.to)}</span>
        </p>
        {node.children.map((c, i) => (
          <ActionRow key={i} node={c} number={childNumber("", i)} />
        ))}
      </div>
    );
  }
  // Single leaf action: show its decoded summary line (if any) + inputs.
  return (
    <div className="flex flex-col gap-y-2">
      {displaySummary(node) && <p className="text-sm text-neutral-700">{decodeCamelCase(displaySummary(node) as string)}</p>}
      <InputsPanel node={node} />
    </div>
  );
};
```

Note on Tailwind colors: the design uses an `l2-*` purple accent. If `l2-50/100/600/700` are not defined in the Tailwind config, substitute existing nearest tokens (e.g. `primary-50/100`, `neutral-500`) — check `tailwind.config` / ODS preset and pick the closest existing classes. Do not invent class names that don't resolve. State the substitution in the report.

- [ ] **Step 2: Type-check + lint**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean (note: `proposalActions.tsx` is updated in Task 4; if it still imports a now-removed symbol, that's fixed there — but `ActionNodeBody` keeps the same name/shape, so `proposalActions.tsx` still compiles).

Run: `./node_modules/.bin/eslint src/components/proposalActions/actionNode.tsx`
Expected: clean (no unused imports — every import above is used).

- [ ] **Step 3: Run decoding + proposalActions suites (no behavior change to tested code)**

Run: `./node_modules/.bin/vitest run src/utils/decoding src/components/proposalActions`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/proposalActions/actionNode.tsx
git commit -m "feat(proposalActions): F1 numbered accordion rows + typed inputs panel"
```

---

## Task 4: Rewrite the `ActionItem` header, wire it up, and remove all dead code

**Files:**
- Modify: `packages/ui/src/components/proposalActions/proposalActions.tsx` (the `ActionItem` accordion header)
- Modify: `packages/ui/src/components/proposalActions/actionNode.helpers.ts` (remove now-unused helpers/types)
- Test: existing suites + a dead-export grep

**Interfaces:**
- Consumes: `ActionNodeBody` (Task 3), `leadParts`/`contractLabel`/`chainLabel` (helpers), `TrustBadge`, `displaySummary`, `formatHexString`.

- [ ] **Step 1: Update the `ActionItem` accordion header**

In `packages/ui/src/components/proposalActions/proposalActions.tsx`, replace the `ActionItem` component (lines 79-135) with a header that leads with the recognized title and shows contract label + trust + chain, then the body:

```tsx
const ActionItem = ({ index, rawAction, onRemove }: { index: number; rawAction: RawAction; onRemove?: () => any }) => {
  const { node, isLoading } = useActionTree(rawAction);
  const title = `Action ${index + 1}`;
  const headline = node ? leadParts(node).text : decodeCamelCase("(loading)");
  const label = node ? contractLabel(node) : null;
  const chain = node ? chainLabel(node.chainId) : null;

  return (
    <AccordionItem className="border-t border-t-neutral-100 bg-neutral-0" value={title}>
      <AccordionItemHeader className="!items-start">
        <div className="flex w-full justify-between gap-x-4">
          <div className="flex w-full flex-1 flex-col items-start gap-y-1.5">
            <span className="text-left text-lg font-semibold leading-tight text-neutral-800 md:text-xl">
              {headline}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {label && <span className="font-semibold text-neutral-700">{label}</span>}
              <Link
                href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${rawAction.to}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-neutral-500 hover:underline"
              >
                {formatHexString(rawAction.to)}
              </Link>
              {node && <TrustBadge trust={node.trust} />}
              {chain && (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">↗ {chain}</span>
              )}
            </div>
          </div>
          <div className="hidden w-24 shrink-0 text-right text-sm text-neutral-500 sm:block md:text-base">{title}</div>
        </div>
      </AccordionItemHeader>
      <AccordionItemContent className="!h-auto !overflow-visible">
        <div className="flex flex-col gap-y-4">
          {isLoading || !node ? <p className="text-neutral-500">Decoding…</p> : <ActionNodeBody node={node} />}
          <If condition={!!onRemove}>
            <div className="mt-2">
              <Button variant="tertiary" size="sm" iconLeft={IconType.CLOSE} onClick={onRemove}>
                Remove action
              </Button>
            </div>
          </If>
        </div>
      </AccordionItemContent>
    </AccordionItem>
  );
};
```

Update the imports at the top of `proposalActions.tsx`: replace `import { contractLabel } from "./actionNode.helpers";` with `import { leadParts, contractLabel, chainLabel } from "./actionNode.helpers";`. Remove the now-unused `displaySummary` import if it is no longer referenced in this file (the new header drops the summary paragraph — verify with a grep of `displaySummary` in this file and remove the import if zero uses).

- [ ] **Step 2: Remove dead helpers from `actionNode.helpers.ts`**

Grep each candidate across `packages/ui/src` to confirm zero remaining references, then delete the unused ones:

Run: `./node_modules/.bin/grep -rn "paramDisplay\|callTag\|groupChildren\|\bLead\b\|GroupItem\|ChildGroup" src/ || true`
(Or use ripgrep.) For each symbol with **no references outside its own definition**, delete it from `actionNode.helpers.ts`: expected-removable are `paramDisplay`, `callTag`, `groupChildren`, and the `Lead`, `GroupItem`, `ChildGroup` types. Keep `leadParts`, `contractLabel`, `chainLabel`, `childNumber`, `friendlySignature`, `shortType` (internal). Remove any imports in `actionNode.helpers.ts` that become unused after deletion (e.g. `decodeCamelCase` if only `callTag`/`leadParts` used it — keep if `leadParts` still uses it).

- [ ] **Step 3: Type-check, lint the whole folder, dead-export sanity**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

Run: `./node_modules/.bin/eslint src/components/proposalActions src/utils/decoding`
Expected: clean (`--max-warnings=0`).

Dead-export check — every exported symbol in `proposalActions/` must have a consumer. For each export in `actionNode.tsx`, `actionNode.helpers.ts`, `encodedView.tsx`, `trustBadge.tsx`, run a usage grep:

Run: `for s in ActionNodeBody leadParts contractLabel chainLabel childNumber friendlySignature EncodedView TrustBadge; do echo "== $s =="; ./node_modules/.bin/grep -rn "$s" src/ | grep -v "export" | head; done` (ripgrep equivalent fine)
Expected: each has at least one non-definition consumer. Report anything with zero — it must be deleted or is a real gap.

- [ ] **Step 4: Run the full test suite**

Run: `./node_modules/.bin/vitest run`
Expected: PASS (all files).

- [ ] **Step 5: Commit**

```bash
git add src/components/proposalActions/proposalActions.tsx src/components/proposalActions/actionNode.helpers.ts
git commit -m "feat(proposalActions): F1 action header + remove dead rendering helpers"
```

- [ ] **Step 6: Manual verification (controller-run, live)**

Restart the dev server, clear site storage once, open `http://localhost:3000/plugins/community-proposals/#/proposals/28` and `…/proposals/29`. Confirm against the mockups:
- #28: batch header + numbered rows `1/2/3` and `3.1/3.2`; click a row → full-width Inputs panel with typed params; bridge `sendMessage` shows the friendly signature + "full signature" toggle; `data` field reads "decoded as the action(s) below"; Verified + ↗ Taiko badges; raw calldata expands.
- #29: single `transferOwnership` row, typed `newOwner · address`, raw calldata.
- An unverified/undecodable action (if available) degrades to the flagged/raw view.

---

## Self-Review

**Spec coverage:**
- Numbered accordion rows (1/2/3, 3.1/3.2) → Task 3 `ActionRow` + `childNumber`. ✔
- Three-line body (title / meta / Inputs toggle) → Task 3 `ActionRow`. ✔
- Full-width Inputs panel, typed params, struct-field recursion → Task 3 `InputsPanel`/`ParamItem` + Task 1 `components`. ✔
- Inline type chip to the right of the name → Task 3 `ParamItem` (`TYPE_CHIP`). ✔
- Friendly signature + full toggle (wraps) → Task 3 `InputsPanel` + Task 2 `friendlySignature`. ✔
- `internalType` struct name → Task 1 + Task 2. ✔
- Honest degradation (recognized title vs fn name; unverified flagged; undecodable→EncodedView) → Task 3 (`rowTitle`/`leadParts`, `unverified` panel, `EncodedView` fallback). ✔
- Chain badge, trust badge, contract label → Task 3/4. ✔
- Batch header → Task 3 `ActionNodeBody`. ✔
- bytes-that-became-children → "decoded as the action(s) below" → Task 3 `ParamItem`. ✔
- No dead code / dead-export check → Task 4 Steps 2-3. ✔
- Public `ProposalActions` props unchanged → Task 4 leaves the export + props intact. ✔

**Placeholder scan:** none — full code provided. The two "verify/substitute" notes (EvmValueLike import in Task 1; `l2-*` Tailwind tokens in Task 3) are explicit conditional instructions with a concrete fallback, not deferred work.

**Type consistency:** `buildParams(inputs, values)` (Task 1) consumed by `decodeAction`; `DecodedParam.internalType?/components?` used by `ParamItem`/`shortType`/`friendlySignature`. `childNumber(prefix,index)` and `friendlySignature(node)` (Task 2) consumed by Task 3. `ActionNodeBody({node})` export name/shape unchanged → `proposalActions.tsx` import stays valid. `leadParts`/`contractLabel`/`chainLabel` kept; `paramDisplay`/`callTag`/`groupChildren` removed only after grep.
