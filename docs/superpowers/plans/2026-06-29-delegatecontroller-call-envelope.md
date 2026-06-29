# DelegateController.Call Envelope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode a Taiko `DelegateController.onMessageInvocation(bytes)` payload (`8-byte executionId + abi.encode(Action[])`) into its `Action[]` and emit each as a child call on the same L2, so proposal #28 drills end-to-end to the inner `upgradeTo` calls — reusing the existing `(address,uint256,bytes)[]` decode.

**Architecture:** Extract the action-tuple-array decode shared by `osxActionArray` into `unwrappers/actionArray.ts`; refactor `osxActionArray` to use it; add a new `delegateControllerCall` unwrapper that strips the 8-byte `executionId`, reuses the shared decode, and emits children carrying the node's chain id.

**Tech Stack:** TypeScript, viem, vitest.

## Global Constraints

- Package manager **pnpm**; from `packages/ui` run tests with `./node_modules/.bin/vitest run <path>` and type-check with `./node_modules/.bin/tsc --noEmit`. Repo lints with `eslint --max-warnings=0` — no unused imports.
- **Reuse, don't duplicate:** the `(address,uint256,bytes)[]` decode lives in one place (`decodeActionTupleArray`); both `osxActionArray` and `delegateControllerCall` call it.
- **Security:** the new envelope only fires when ALL hold — `node.functionName === "onMessageInvocation"`, `node.params[0].type === "bytes"`, `node.trust === "verified"`, `node.name ∈ {"DelegateController","DelegateOwner"}`, and the validated decode (8-byte prefix + valid `Action[]`) succeeds. Any failure → no match / no child (raw shown), never a guess. Never throws.
- Children emitted by `delegateControllerCall` carry `chainId: node.chainId` (the trusted L2 the verified call runs on). `decodeActionTupleArray` itself returns chain-agnostic `RawCall`s (no `chainId`).
- `osxActionArray`'s existing tests (`__tests__/osxActionArray.test.ts`) must pass unchanged after the refactor (no behavior change).
- `Action` tuple = `(address,uint256,bytes)`. `_data` layout (verified from source): `bytes8 executionId` then `abi.encode(Action[])`.
- `RawCall = { to: Address; value: bigint; data: Hex; chainId?: number }`; `Unwrapper = { id; match(node): boolean; apply(node, ctx): Promise<{ summary, children: RawCall[] }> }`.

---

### Task 1: Shared `decodeActionTupleArray` helper + refactor `osxActionArray`

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/actionArray.ts`
- Modify: `packages/ui/src/utils/decoding/unwrappers/osxActionArray.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/actionArray.test.ts` (create)

**Interfaces:**
- Produces: `decodeActionTupleArray(blob: Hex): RawCall[] | null` — decode `(address,uint256,bytes)[]` → `RawCall[]` (`to`/`value`/`data`, no `chainId`); `null` on empty/short/malformed/non-address.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/actionArray.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { decodeActionTupleArray } from "../unwrappers/actionArray";

const A = "0x1111111111111111111111111111111111111111" as const;
const B = "0x2222222222222222222222222222222222222222" as const;
const UPGRADE = ("0x3659cfe6" + "00".repeat(32)) as Hex;

function encodeActions(items: Array<[string, bigint, Hex]>) {
  return encodeAbiParameters(parseAbiParameters("(address,uint256,bytes)[]"), [items]);
}

describe("decodeActionTupleArray", () => {
  it("decodes a valid action array into RawCalls (no chainId)", () => {
    const blob = encodeActions([[A, 0n, UPGRADE], [B, 5n, "0x"]]);
    const calls = decodeActionTupleArray(blob);
    expect(calls).toHaveLength(2);
    expect(calls![0]).toEqual({ to: A, value: 0n, data: UPGRADE });
    expect(calls![1].to).toBe(B);
    expect(calls![1].value).toBe(5n);
    expect("chainId" in calls![0]).toBe(false);
  });

  it("returns null for an empty array", () => {
    expect(decodeActionTupleArray(encodeActions([]))).toBeNull();
  });

  it("returns null for 0x / too-short / malformed blobs", () => {
    expect(decodeActionTupleArray("0x")).toBeNull();
    expect(decodeActionTupleArray("0x1234")).toBeNull();
    expect(decodeActionTupleArray(("0x" + "ab".repeat(80)) as Hex)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/actionArray.test.ts`
Expected: FAIL — module `../unwrappers/actionArray` does not exist.

- [ ] **Step 3: Create the shared helper**

Create `packages/ui/src/utils/decoding/unwrappers/actionArray.ts`:

```typescript
import { decodeAbiParameters, parseAbiParameters, getAddress, isAddress, size, type Hex } from "viem";
import type { RawCall } from "../types";

const ACTION_TUPLE = parseAbiParameters("(address,uint256,bytes)[]");

/**
 * Decode a bytes blob as an OSx-style `(address,uint256,bytes)[]` into RawCalls.
 * Returns null on any failure (empty / too short / malformed / non-address
 * target) — never guesses. Chain-agnostic: callers set `chainId` if needed.
 */
export function decodeActionTupleArray(blob: Hex): RawCall[] | null {
  if (!blob || blob === "0x" || size(blob) < 64) return null;
  try {
    const [arr] = decodeAbiParameters(ACTION_TUPLE, blob) as unknown as [Array<[string, bigint, Hex]>];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (!arr.every((t) => isAddress(t[0]))) return null;
    return arr.map((t) => ({ to: getAddress(t[0]), value: t[1], data: t[2] }));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/actionArray.test.ts`
Expected: PASS.

- [ ] **Step 5: Refactor `osxActionArray` to use the helper**

In `packages/ui/src/utils/decoding/unwrappers/osxActionArray.ts`:

Replace the imports (line 1) and remove the now-shared `ACTION_TUPLE` constant (line 4). New top of file:

```typescript
import { decodeAbiParameters, parseAbiParameters, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";
import { decodeActionTupleArray } from "./actionArray";

const EXECUTE_BYTES = "0x09c5eabe";
const EXECUTE_BYTES_SIGNATURE = "execute(bytes)";
```

Keep `isExecuteBytes` and `candidateBlobs` unchanged. Replace `decodeActionArray` (lines 29-42) with the helper-based version:

```typescript
function decodeActionArray(node: DecodedNode): RawCall[] | null {
  for (const blob of candidateBlobs(node)) {
    const calls = decodeActionTupleArray(blob);
    if (calls) return calls;
  }
  return null;
}
```

Leave `cache`, `extractActionArray`, and the `osxActionArray` export unchanged.

- [ ] **Step 6: Verify osxActionArray behavior is unchanged + type/lint clean**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/osxActionArray.test.ts`
Expected: PASS (unchanged).

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

Run: `./node_modules/.bin/eslint src/utils/decoding/unwrappers/osxActionArray.ts src/utils/decoding/unwrappers/actionArray.ts`
Expected: clean (no unused imports — `getAddress`/`isAddress`/`size` moved to the helper and dropped from osxActionArray).

- [ ] **Step 7: Commit**

```bash
git add src/utils/decoding/unwrappers/actionArray.ts src/utils/decoding/unwrappers/osxActionArray.ts src/utils/decoding/__tests__/actionArray.test.ts
git commit -m "refactor(decoding): extract shared action-tuple-array decoder"
```

---

### Task 2: `delegateControllerCall` unwrapper

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/delegateControllerCall.ts`
- Modify: `packages/ui/src/utils/decoding/unwrappers/index.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/delegateControllerCall.test.ts` (create)

**Interfaces:**
- Consumes: `decodeActionTupleArray` (Task 1); `RawCall`, `DecodedNode`, `Unwrapper`.
- Produces: `delegateControllerCall: Unwrapper`, registered in `UNWRAPPERS` **before** `taikoBridgeMessage` (both match `onMessageInvocation`; the stricter, name-gated one wins for DelegateController; for any other contract its name guard fails and it falls through).

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/delegateControllerCall.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, concat, type Hex } from "viem";
import { delegateControllerCall } from "../unwrappers/delegateControllerCall";
import type { DecodedNode } from "../types";

const TARGET1 = "0x1670000000000000000000000000000000010001" as const;
const TARGET2 = "0x1670000000000000000000000000000000000005" as const;
const UPGRADE = ("0x3659cfe6" + "00".repeat(32)) as Hex;

// _data = 8-byte executionId + abi.encode(Action[])
function makeData(items: Array<[string, bigint, Hex]>): Hex {
  const actions = encodeAbiParameters(parseAbiParameters("(address,uint256,bytes)[]"), [items]);
  return concat(["0x0000000000000000", actions]);
}

function node(overrides: Partial<DecodedNode> = {}): DecodedNode {
  return {
    to: "0x00000000000000000000000000000000000000Aa", value: 0n, data: "0x" as Hex, chainId: 167000,
    selector: "0x7f07c947", functionName: "onMessageInvocation", signature: "onMessageInvocation(bytes)",
    params: [{ name: "_data", type: "bytes", value: makeData([[TARGET1, 0n, UPGRADE], [TARGET2, 0n, UPGRADE]]) }],
    trust: "verified", isProxy: false, implementation: null, name: "DelegateController",
    summary: null, children: [],
    ...overrides,
  };
}

describe("delegateControllerCall", () => {
  it("matches a verified DelegateController onMessageInvocation and emits actions as children on the node's chain", async () => {
    const n = node();
    expect(delegateControllerCall.match(n)).toBe(true);
    const { summary, children } = await delegateControllerCall.apply(n, {} as any);
    expect(summary).toBe("Executes 2 action(s)");
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ to: TARGET1, value: 0n, data: UPGRADE, chainId: 167000 });
    expect(children[1].to).toBe(TARGET2);
  });

  it("does not match when trust is not verified", () => {
    expect(delegateControllerCall.match(node({ trust: "signature-db" }))).toBe(false);
  });

  it("does not match when the contract name is not in the allowlist", () => {
    expect(delegateControllerCall.match(node({ name: "SomeOtherContract" }))).toBe(false);
    expect(delegateControllerCall.match(node({ name: undefined }))).toBe(false);
  });

  it("matches DelegateOwner too", () => {
    expect(delegateControllerCall.match(node({ name: "DelegateOwner" }))).toBe(true);
  });

  it("does not match when _data is shorter than the 8-byte executionId", () => {
    expect(delegateControllerCall.match(node({ params: [{ name: "_data", type: "bytes", value: "0x1234" }] }))).toBe(false);
  });

  it("does not match a non-onMessageInvocation function", () => {
    expect(delegateControllerCall.match(node({ functionName: "transfer" }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/delegateControllerCall.test.ts`
Expected: FAIL — module `../unwrappers/delegateControllerCall` does not exist.

- [ ] **Step 3: Implement the unwrapper**

Create `packages/ui/src/utils/decoding/unwrappers/delegateControllerCall.ts`:

```typescript
import { size, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";
import { decodeActionTupleArray } from "./actionArray";

// Taiko contracts that expose onMessageInvocation(bytes) with the
// `executionId + Action[]` payload (verified-source confirmed).
const DELEGATE_NAMES = new Set(["DelegateController", "DelegateOwner"]);

/**
 * Decode a DelegateController onMessageInvocation payload into its actions, or
 * null if it isn't one we can trust+validate. `_data` = 8-byte executionId then
 * abi.encode((address,uint256,bytes)[]).
 */
function extractActions(node: DecodedNode): RawCall[] | null {
  if (node.functionName !== "onMessageInvocation") return null;
  if (node.params[0]?.type !== "bytes") return null;
  if (node.trust !== "verified") return null;
  if (!node.name || !DELEGATE_NAMES.has(node.name)) return null;
  const data = node.params[0].value as Hex;
  if (!data || size(data) < 8) return null;
  return decodeActionTupleArray(slice(data, 8));
}

// match() and apply() both decode; cache per node to avoid doing it twice.
const cache = new WeakMap<DecodedNode, RawCall[] | null>();
function actionsFor(node: DecodedNode): RawCall[] | null {
  if (cache.has(node)) return cache.get(node) ?? null;
  const result = extractActions(node);
  cache.set(node, result);
  return result;
}

export const delegateControllerCall: Unwrapper = {
  id: "delegate-controller-call",
  match: (node) => actionsFor(node) !== null,
  apply: async (node) => {
    const actions = actionsFor(node) ?? [];
    const children: RawCall[] = actions.map((c) => ({ ...c, chainId: node.chainId }));
    return { summary: `Executes ${children.length} action(s)`, children };
  },
};
```

- [ ] **Step 4: Register the unwrapper (before `taikoBridgeMessage`)**

In `packages/ui/src/utils/decoding/unwrappers/index.ts`, add the import and place it before `taikoBridgeMessage`:

```typescript
import { delegateControllerCall } from "./delegateControllerCall";
```

```typescript
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, delegateControllerCall, taikoBridgeMessage, uupsUpgrade, erc20, accessControl];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/delegateControllerCall.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check, lint, full decoding suite**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

Run: `./node_modules/.bin/eslint src/utils/decoding/unwrappers/delegateControllerCall.ts src/utils/decoding/unwrappers/index.ts`
Expected: clean.

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/decoding/unwrappers/delegateControllerCall.ts src/utils/decoding/unwrappers/index.ts src/utils/decoding/__tests__/delegateControllerCall.test.ts
git commit -m "feat(decoding): DelegateController onMessageInvocation envelope (Action[] children)"
```

- [ ] **Step 8: Manual verification (controller-run, live)**

With the dev server running, open `http://localhost:3000/plugins/community-proposals/#/proposals/28`, clear site storage once, expand Action 1 → action 3 (`Send message`) → `On message invocation`. Confirm it now expands into two `Upgrades proxy → implementation …` children (`0x7e83…`, `0x18B2…`), each Verified ↗ Taiko.

---

## Self-Review

**Spec coverage:**
- Shared `decodeActionTupleArray` + `osxActionArray` refactor (reuse) → Task 1. ✔
- `delegateControllerCall` envelope (8-byte strip + Action[] + children on node chain) → Task 2 Steps 3-4. ✔
- Triple gate (verified trust + name allowlist + validated decode) → Task 2 Step 3 (`extractActions`). ✔
- Registration before `taikoBridgeMessage` → Task 2 Step 4. ✔
- Children carry `node.chainId`; helper is chain-agnostic → Task 1 Step 3 (no chainId) + Task 2 Step 3 (map adds chainId). ✔
- Security (no guess / never throws / raw shown / fail-silent) → helper returns null on failure; unwrapper gated; both wrapped. ✔
- Depth fits MAX_DEPTH=4 → no change (spec). ✔
- Tests (helper + envelope match/apply/negatives) → Tasks 1, 2. ✔

**Placeholder scan:** none — every code step has concrete content.

**Type consistency:** `decodeActionTupleArray(blob: Hex): RawCall[] | null` consistent across Task 1 (def) and Task 2 (use). `RawCall.chainId?` optional — helper omits it, `delegateControllerCall` adds `node.chainId`. `Unwrapper` shape matches existing unwrappers. `node.name`/`node.trust`/`node.chainId` are existing `DecodedNode` fields.
