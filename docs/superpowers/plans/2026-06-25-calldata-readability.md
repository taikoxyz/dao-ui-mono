# Proposal Calldata Readability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode proposal actions — including nested `execute(bytes)` payloads — into a recursive, human-readable tree with per-node trust badges and plain-English summaries, replacing today's raw-hex dump.

**Architecture:** A pure recursive decoder (`decodeAction`) does one-level ABI decoding per call and delegates to a small registry of "unwrappers" that decide where it is safe to recurse and emit a summary. All network IO (ABI/proxy resolution, signature DB, token metadata) is injected into the decoder via a `DecodeCtx`, so the engine and unwrappers are unit-tested with no network. A thin hook (`useActionTree`) binds the real IO via react-query; a recursive component (`ActionNode`) renders the tree.

**Tech Stack:** TypeScript, viem 2.19.8, `@shazow/whatsabi` 0.21, `@tanstack/react-query`, wagmi, React 18, `@aragon/ods`, Vitest (new).

## Global Constraints

- Package manager is **pnpm** (run at monorepo root). Do **not** use bun/npm/yarn for `packages/ui`.
- Path alias `@/*` → `packages/ui/src/*`.
- Network/RPC: chain + Etherscan key come from `@/constants` (`PUB_CHAIN`, `PUB_ETHERSCAN_API_KEY`); RPC via `usePublicClient({ chainId: PUB_CHAIN.id })`.
- Proxy resolution is **load-bearing**: every ABI fetch must resolve EIP-1967 proxy → implementation (via existing `getImplementation` in `@/utils/proxies`) and fetch the **implementation's** ABI. The spike proved Etherscan returns the proxy ABI otherwise, leaving `execute`/`upgradeTo` undecoded.
- Recursion bounded: **max depth 4**, plus a visited-set cycle guard.
- `summary` is `null` when no pattern matches — **never** invent one.
- Never regress: any node that cannot be decoded renders the existing `EncodedView` raw fallback.
- Decoder + unwrappers are **pure** (IO injected) so they unit-test without network.
- New tests run under **Vitest**, `node` environment, scoped to `src/utils/decoding/**`.

## File Structure

**New files**
- `packages/ui/vitest.config.ts` — Vitest config (node env, tsconfig paths).
- `packages/ui/src/utils/decoding/types.ts` — `TrustLevel`, `DecodedParam`, `DecodedNode`, `AbiResolution`, `Unwrapper`, `DecodeCtx`.
- `packages/ui/src/utils/decoding/signatureLookup.ts` — openchain selector→`AbiFunction` fragment.
- `packages/ui/src/utils/decoding/decodeAction.ts` — recursive pure decoder.
- `packages/ui/src/utils/decoding/unwrappers/index.ts` — registry + `matchUnwrapper`.
- `packages/ui/src/utils/decoding/unwrappers/osxActionArray.ts`
- `packages/ui/src/utils/decoding/unwrappers/uupsUpgrade.ts`
- `packages/ui/src/utils/decoding/unwrappers/erc20.ts`
- `packages/ui/src/utils/decoding/unwrappers/accessControl.ts`
- `packages/ui/src/utils/decoding/abiResolver.ts` — real `loadAbi` / `loadSignature` / `loadToken` (IO).
- `packages/ui/src/hooks/useActionTree.ts` — react-query hook binding IO to `decodeAction`.
- `packages/ui/src/components/proposalActions/trustBadge.tsx`
- `packages/ui/src/components/proposalActions/actionNode.tsx`
- Test files alongside under `src/utils/decoding/__tests__/`.

**Modified files**
- `packages/ui/package.json` — add `test` script + devDeps.
- `packages/ui/src/hooks/useAbi.ts` — refactor IO core into `abiResolver.ts`; keep `useAbi` as a thin wrapper (back-compat for `calldata-form.tsx`).
- `packages/ui/src/components/proposalActions/proposalActions.tsx` — `ActionItem` renders `useActionTree` + `ActionNode`.

**Scope deviations from spec (intentional, YAGNI):**
- `multicall3` unwrapper **excluded** from v1 — zero instances across all 28 real proposals. Trivial to add later as one file.
- `DecodedParam.node` (nested call attached to a param) **omitted**; nested calls render uniformly as `node.children`. Simpler, same UX.

---

### Task 1: Vitest setup

**Files:**
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/smoke.test.ts`
- Modify: `packages/ui/package.json` (scripts + devDependencies)

**Interfaces:**
- Produces: a working `pnpm --filter dao-ui test` command.

- [ ] **Step 1: Add devDeps and script**

In `packages/ui/package.json`, add to `"scripts"`:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
Add to `"devDependencies"`:
```json
    "vitest": "^2.1.8",
    "vite-tsconfig-paths": "^5.1.4"
```

- [ ] **Step 2: Install**

Run (from monorepo root): `pnpm install`
Note: pnpm 11 may append a malformed `allowBuilds:` block to `pnpm-workspace.yaml`. If `git status` shows it modified, run `git checkout pnpm-workspace.yaml` — it is not needed for tests.

- [ ] **Step 3: Create `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/utils/decoding/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write smoke test** `packages/ui/src/utils/decoding/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run**

Run (from `packages/ui`): `pnpm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/vitest.config.ts packages/ui/src/utils/decoding/__tests__/smoke.test.ts
git commit -m "test: add vitest runner scoped to decoding utils"
```

---

### Task 2: Decoding types

**Files:**
- Create: `packages/ui/src/utils/decoding/types.ts`

**Interfaces:**
- Produces: the types every later task consumes (exact names/fields below).

- [ ] **Step 1: Create `types.ts`**

```ts
import type { Address, Hex, AbiFunction } from "viem";
import type { EvmValue } from "@/utils/types";

export type TrustLevel = "verified" | "bytecode" | "signature-db" | "unknown";

export type DecodedParam = {
  name: string;
  type: string;
  value: EvmValue;
  formatted?: string;
};

export type DecodedNode = {
  to: Address;
  value: bigint;
  data: Hex;
  selector: Hex | null;
  functionName: string | null;
  signature: string | null;
  params: DecodedParam[];
  trust: TrustLevel;
  isProxy: boolean;
  implementation: Address | null;
  summary: string | null;
  children: DecodedNode[];
  error?: string;
  truncated?: "depth" | "cycle";
};

export type AbiResolution = {
  abi: AbiFunction[];
  trust: TrustLevel; // "verified" | "bytecode" | "unknown"
  isProxy: boolean;
  implementation: Address | null;
};

export type RawCall = { to: Address; value: bigint; data: Hex };

export type DecodeCtx = {
  loadAbi: (address: Address) => Promise<AbiResolution>;
  loadSignature: (selector: Hex) => Promise<AbiFunction | null>;
  loadToken: (address: Address) => Promise<{ decimals: number; symbol: string } | null>;
  depth: number;
  maxDepth: number;
  seen: Set<string>;
};

export type Unwrapper = {
  id: string;
  match: (node: DecodedNode) => boolean;
  apply: (node: DecodedNode, ctx: DecodeCtx) => Promise<{ summary: string | null; children: RawCall[] }>;
};
```

- [ ] **Step 2: Type-check**

Run (from `packages/ui`): `pnpm exec tsc --noEmit`
Expected: no errors from `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/utils/decoding/types.ts
git commit -m "feat: decoding node + context types"
```

---

### Task 3: Signature DB lookup

**Files:**
- Create: `packages/ui/src/utils/decoding/signatureLookup.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/signatureLookup.test.ts`

**Interfaces:**
- Produces: `loadSignatureFrom(fetchImpl, selector): Promise<AbiFunction | null>` and a default `loadSignature(selector)` bound to global `fetch`.

- [ ] **Step 1: Write failing test** `__tests__/signatureLookup.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { loadSignatureFrom } from "../signatureLookup";

const okResponse = (name: string, selector: string) =>
  ({ ok: true, json: async () => ({ ok: true, result: { function: { [selector]: [{ name }] } } }) }) as any;

describe("loadSignatureFrom", () => {
  it("returns an AbiFunction fragment for a known selector", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("pause()", "0x8456cb59"));
    const fn = await loadSignatureFrom(fetchImpl, "0x8456cb59");
    expect(fn?.name).toBe("pause");
    expect(fn?.type).toBe("function");
    expect(fn?.inputs).toEqual([]);
  });

  it("parses arguments", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("transferOwnership(address)", "0xf2fde38b"));
    const fn = await loadSignatureFrom(fetchImpl, "0xf2fde38b");
    expect(fn?.name).toBe("transferOwnership");
    expect(fn?.inputs?.[0]?.type).toBe("address");
  });

  it("returns null when nothing matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: { function: {} } }) } as any);
    const fn = await loadSignatureFrom(fetchImpl, "0xdeadbeef");
    expect(fn).toBeNull();
  });

  it("returns null on network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));
    const fn = await loadSignatureFrom(fetchImpl, "0xdeadbeef");
    expect(fn).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test signatureLookup`
Expected: FAIL — cannot find module `../signatureLookup`.

- [ ] **Step 3: Implement `signatureLookup.ts`**

```ts
import { parseAbiItem, type AbiFunction, type Hex } from "viem";

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

const ENDPOINT = "https://api.openchain.xyz/signature-database/v1/lookup";

export async function loadSignatureFrom(fetchImpl: FetchLike, selector: Hex): Promise<AbiFunction | null> {
  try {
    const res = await fetchImpl(`${ENDPOINT}?function=${selector}&filter=true`);
    if (!res.ok) return null;
    const json = await res.json();
    const candidates: Array<{ name: string }> | undefined = json?.result?.function?.[selector];
    const name = candidates?.[0]?.name;
    if (!name) return null;
    const item = parseAbiItem(`function ${name}`);
    return item.type === "function" ? (item as AbiFunction) : null;
  } catch {
    return null;
  }
}

export function loadSignature(selector: Hex): Promise<AbiFunction | null> {
  return loadSignatureFrom((url) => fetch(url), selector);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test signatureLookup`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/utils/decoding/signatureLookup.ts packages/ui/src/utils/decoding/__tests__/signatureLookup.test.ts
git commit -m "feat: openchain signature-db lookup"
```

---

### Task 4: Core decoder — one level (no unwrappers yet)

**Files:**
- Create: `packages/ui/src/utils/decoding/decodeAction.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts`

**Interfaces:**
- Consumes: `DecodedNode`, `DecodeCtx`, `AbiResolution`, `RawCall` from `types.ts`.
- Produces: `async decodeAction(call: RawCall, ctx: DecodeCtx): Promise<DecodedNode>`. In this task the unwrapper registry is not wired (no children, `summary` only for native transfer).

- [ ] **Step 1: Write failing test** `__tests__/decodeAction.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { parseAbiItem, toFunctionSelector, encodeFunctionData, type AbiFunction } from "viem";
import { decodeAction } from "../decodeAction";
import type { AbiResolution, DecodeCtx } from "../types";

const transferAbi = parseAbiItem("function transfer(address to, uint256 amount)") as AbiFunction;

function ctx(overrides: Partial<DecodeCtx> = {}): DecodeCtx {
  return {
    loadAbi: async (): Promise<AbiResolution> => ({ abi: [transferAbi], trust: "verified", isProxy: false, implementation: null }),
    loadSignature: async () => null,
    loadToken: async () => null,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
    ...overrides,
  };
}

const ADDR = "0x000000000000000000000000000000000000dEaD" as const;

describe("decodeAction (one level)", () => {
  it("treats empty data as a native transfer", async () => {
    const node = await decodeAction({ to: ADDR, value: 1n, data: "0x" }, ctx());
    expect(node.summary).toMatch(/Transfer/);
    expect(node.functionName).toBeNull();
    expect(node.trust).toBe("verified");
  });

  it("decodes a verified function call with named params", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1000n] });
    const node = await decodeAction({ to: ADDR, value: 0n, data }, ctx());
    expect(node.functionName).toBe("transfer");
    expect(node.signature).toBe("transfer(address,uint256)");
    expect(node.params.map((p) => p.name)).toEqual(["to", "amount"]);
    expect(node.params[1].value).toBe(1000n);
    expect(node.selector).toBe(toFunctionSelector(transferAbi));
    expect(node.trust).toBe("verified");
  });

  it("falls back to signature DB when the ABI lacks the selector", async () => {
    const pause = parseAbiItem("function pause()") as AbiFunction;
    const data = encodeFunctionData({ abi: [pause], functionName: "pause", args: [] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null }), loadSignature: async () => pause }),
    );
    expect(node.functionName).toBe("pause");
    expect(node.trust).toBe("signature-db");
  });

  it("returns an error node when nothing can decode", async () => {
    const node = await decodeAction(
      { to: ADDR, value: 0n, data: "0x12345678" },
      ctx({ loadAbi: async () => ({ abi: [], trust: "unknown", isProxy: false, implementation: null }) }),
    );
    expect(node.functionName).toBeNull();
    expect(node.error).toBeTruthy();
    expect(node.trust).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test decodeAction`
Expected: FAIL — cannot find module `../decodeAction`.

- [ ] **Step 3: Implement `decodeAction.ts`**

```ts
import { slice, toFunctionSelector, toFunctionSignature, decodeFunctionData, formatEther, type AbiFunction } from "viem";
import type { DecodeCtx, DecodedNode, RawCall } from "./types";

function baseNode(call: RawCall): DecodedNode {
  return {
    to: call.to,
    value: call.value,
    data: call.data,
    selector: null,
    functionName: null,
    signature: null,
    params: [],
    trust: "unknown",
    isProxy: false,
    implementation: null,
    summary: null,
    children: [],
  };
}

export async function decodeAction(call: RawCall, ctx: DecodeCtx): Promise<DecodedNode> {
  const node = baseNode(call);

  if (!call.data || call.data === "0x") {
    node.trust = "verified";
    node.summary = `Transfer ${formatEther(call.value)} to ${call.to}`;
    return node;
  }

  node.selector = slice(call.data, 0, 4);

  let resolution;
  try {
    resolution = await ctx.loadAbi(call.to);
  } catch {
    resolution = { abi: [], trust: "unknown" as const, isProxy: false, implementation: null };
  }
  node.trust = resolution.trust;
  node.isProxy = resolution.isProxy;
  node.implementation = resolution.implementation;

  let fnAbi: AbiFunction | undefined = resolution.abi.find(
    (f) => f.type === "function" && node.selector === toFunctionSelector(f),
  );

  if (!fnAbi) {
    const frag = await ctx.loadSignature(node.selector);
    if (frag) {
      fnAbi = frag;
      if (resolution.trust === "unknown") node.trust = "signature-db";
    }
  }

  if (fnAbi) {
    try {
      const { args } = decodeFunctionData({ abi: [fnAbi], data: call.data });
      node.functionName = fnAbi.name;
      node.signature = toFunctionSignature(fnAbi);
      node.params = fnAbi.inputs.map((inp, i) => ({
        name: inp.name ?? "",
        type: inp.type,
        value: (args as readonly unknown[])[i] as DecodedNode["params"][number]["value"],
      }));
    } catch {
      node.error = "decode-failed";
    }
  } else {
    node.error = "no-abi";
  }

  return node;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test decodeAction`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/utils/decoding/decodeAction.ts packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts
git commit -m "feat: one-level pure action decoder with trust tiers"
```

---

### Task 5: Unwrapper registry + osx-action-array + recursion

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/osxActionArray.ts`
- Create: `packages/ui/src/utils/decoding/unwrappers/index.ts`
- Modify: `packages/ui/src/utils/decoding/decodeAction.ts` (wire registry + bounded recursion)
- Create: `packages/ui/src/utils/decoding/__tests__/osxActionArray.test.ts`

**Interfaces:**
- Consumes: `Unwrapper`, `DecodedNode`, `RawCall`, `DecodeCtx`.
- Produces: `UNWRAPPERS: Unwrapper[]`, `matchUnwrapper(node): Unwrapper | null`; `extractActionArray(node): RawCall[] | null`. `decodeAction` now populates `children`, `summary`, `truncated`.

- [ ] **Step 1: Write failing test** `__tests__/osxActionArray.test.ts`

This uses **proposal #33's real calldata** end-to-end.

```ts
import { describe, it, expect } from "vitest";
import { parseAbiItem, type AbiFunction } from "viem";
import { decodeAction } from "../decodeAction";
import type { AbiResolution, DecodeCtx } from "../types";

const executeAbi = parseAbiItem("function execute(bytes)") as AbiFunction;
const upgradeToAbi = parseAbiItem("function upgradeTo(address newImplementation)") as AbiFunction;

const CONTROLLER = "0x75Ba76403b13b26AD1beC70D6eE937314eeaCD0a" as const;
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f" as const;
// Real on-chain calldata of community proposal #33, action 1:
const P33_DATA =
  "0x09c5eabe000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006f21c543a4af5189ebdb0723827577e1ef57ef1f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243659cfe6000000000000000000000000349ae3578f48f758d79451eeab61cdd5fedd009800000000000000000000000000000000000000000000000000000000" as const;

function ctx(): DecodeCtx {
  return {
    loadAbi: async (addr): Promise<AbiResolution> => {
      const abi = addr.toLowerCase() === CONTROLLER.toLowerCase() ? [executeAbi] : [upgradeToAbi];
      return { abi, trust: "verified", isProxy: addr.toLowerCase() === PROXY.toLowerCase(), implementation: null };
    },
    loadSignature: async () => null,
    loadToken: async () => null,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
  };
}

describe("osx-action-array unwrapper (real #33 calldata)", () => {
  it("expands execute(bytes) into its sub-actions and summarizes", async () => {
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: P33_DATA }, ctx());
    expect(node.functionName).toBe("execute");
    expect(node.summary).toBe("Executes 1 sub-action(s)");
    expect(node.children).toHaveLength(1);
    const child = node.children[0];
    expect(child.to.toLowerCase()).toBe(PROXY.toLowerCase());
    expect(child.functionName).toBe("upgradeTo");
    expect((child.params[0].value as string).toLowerCase()).toBe("0x349ae3578f48f758d79451eeab61cdd5fedd0098");
  });

  it("does not mistake a random bytes blob for an action array", async () => {
    const data =
      "0x09c5eabe" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "0000000000000000000000000000000000000000000000000000000000000004" +
      "deadbeef00000000000000000000000000000000000000000000000000000000";
    const node = await decodeAction({ to: CONTROLLER, value: 0n, data: data as `0x${string}` }, ctx());
    expect(node.children).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test osxActionArray`
Expected: FAIL — `node.children` is empty (registry not wired).

- [ ] **Step 3: Implement `unwrappers/osxActionArray.ts`**

```ts
import { decodeAbiParameters, parseAbiParameters, getAddress, isAddress, size, slice, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";

const ACTION_TUPLE = parseAbiParameters("(address,uint256,bytes)[]");
const EXECUTE_BYTES = "0x09c5eabe";

function candidateBlobs(node: DecodedNode): Hex[] {
  const fromParams = node.params.filter((p) => p.type === "bytes").map((p) => p.value as Hex);
  if (fromParams.length) return fromParams;
  // execute(bytes) whose ABI may not have decoded params: pull the single bytes arg directly.
  if (node.selector === EXECUTE_BYTES && node.data.length > 10) {
    try {
      return [decodeAbiParameters(parseAbiParameters("bytes"), slice(node.data, 4))[0] as Hex];
    } catch {
      return [];
    }
  }
  return [];
}

export function extractActionArray(node: DecodedNode): RawCall[] | null {
  for (const blob of candidateBlobs(node)) {
    if (!blob || blob === "0x" || size(blob) < 64) continue;
    try {
      const [arr] = decodeAbiParameters(ACTION_TUPLE, blob) as unknown as [Array<[string, bigint, Hex]>];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      if (!arr.every((t) => isAddress(t[0]))) continue;
      return arr.map((t) => ({ to: getAddress(t[0]), value: t[1], data: t[2] }));
    } catch {
      continue;
    }
  }
  return null;
}

export const osxActionArray: Unwrapper = {
  id: "osx-action-array",
  match: (node) => extractActionArray(node) !== null,
  apply: async (node) => {
    const children = extractActionArray(node) ?? [];
    return { summary: `Executes ${children.length} sub-action(s)`, children };
  },
};
```

- [ ] **Step 4: Implement `unwrappers/index.ts`**

```ts
import type { DecodedNode, Unwrapper } from "../types";
import { osxActionArray } from "./osxActionArray";

export const UNWRAPPERS: Unwrapper[] = [osxActionArray];

export function matchUnwrapper(node: DecodedNode): Unwrapper | null {
  return UNWRAPPERS.find((u) => u.match(node)) ?? null;
}
```

- [ ] **Step 5: Wire registry + recursion into `decodeAction.ts`**

Add import at top:
```ts
import { matchUnwrapper } from "./unwrappers";
```
Replace the final `return node;` of `decodeAction` with:
```ts
  const unwrapper = matchUnwrapper(node);
  if (unwrapper) {
    const { summary, children } = await unwrapper.apply(node, ctx);
    node.summary = summary;
    if (children.length) {
      if (ctx.depth >= ctx.maxDepth) {
        node.truncated = "depth";
      } else {
        for (const child of children) {
          const key = `${child.to}:${child.data}`.toLowerCase();
          if (ctx.seen.has(key)) {
            node.truncated = "cycle";
            continue;
          }
          const childCtx = { ...ctx, depth: ctx.depth + 1, seen: new Set(ctx.seen).add(key) };
          node.children.push(await decodeAction(child, childCtx));
        }
      }
    }
  }

  return node;
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — `osxActionArray` (2) + `decodeAction` (4) + `signatureLookup` (4) all green.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/utils/decoding/unwrappers packages/ui/src/utils/decoding/decodeAction.ts packages/ui/src/utils/decoding/__tests__/osxActionArray.test.ts
git commit -m "feat: osx-action-array unwrapper + bounded recursion"
```

---

### Task 6: uups-upgrade unwrapper

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/uupsUpgrade.ts`
- Modify: `packages/ui/src/utils/decoding/unwrappers/index.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/uupsUpgrade.test.ts`

**Interfaces:**
- Consumes: `Unwrapper`, `DecodedNode`.
- Produces: `uupsUpgrade: Unwrapper`; added to `UNWRAPPERS` **before** `osxActionArray` is not required (selectors are disjoint), append is fine.

- [ ] **Step 1: Write failing test** `__tests__/uupsUpgrade.test.ts`

```ts
import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { uupsUpgrade } from "../unwrappers/uupsUpgrade";

const NEW_IMPL = "0x349ae3578f48f758d79451eeab61cdd5fedd0098";
const PROXY = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f";

function node(partial: Partial<DecodedNode>): DecodedNode {
  return {
    to: PROXY as `0x${string}`, value: 0n, data: "0x3659cfe6" as `0x${string}`,
    selector: "0x3659cfe6", functionName: "upgradeTo", signature: "upgradeTo(address)",
    params: [{ name: "newImplementation", type: "address", value: NEW_IMPL }],
    trust: "verified", isProxy: true, implementation: null, summary: null, children: [], ...partial,
  };
}
const ctx = { loadToken: async () => null } as unknown as DecodeCtx;

describe("uups-upgrade unwrapper", () => {
  it("matches upgradeTo and summarizes", async () => {
    const n = node({});
    expect(uupsUpgrade.match(n)).toBe(true);
    const { summary, children } = await uupsUpgrade.apply(n, ctx);
    expect(summary).toContain("Upgrades proxy");
    expect(summary).toContain("0x349a");
    expect(children).toHaveLength(0);
  });

  it("recurses into upgradeToAndCall's inner call", async () => {
    const n = node({
      selector: "0x4f1ef286", functionName: "upgradeToAndCall", signature: "upgradeToAndCall(address,bytes)",
      params: [
        { name: "newImplementation", type: "address", value: NEW_IMPL },
        { name: "data", type: "bytes", value: "0x8456cb59" },
      ],
    });
    expect(uupsUpgrade.match(n)).toBe(true);
    const { children } = await uupsUpgrade.apply(n, ctx);
    expect(children).toHaveLength(1);
    expect(children[0].to.toLowerCase()).toBe(NEW_IMPL.toLowerCase());
    expect(children[0].data).toBe("0x8456cb59");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test uupsUpgrade`
Expected: FAIL — cannot find module `../unwrappers/uupsUpgrade`.

- [ ] **Step 3: Implement `unwrappers/uupsUpgrade.ts`**

```ts
import { getAddress, type Address, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";

const UPGRADE_TO = "0x3659cfe6";
const UPGRADE_TO_AND_CALL = "0x4f1ef286";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const uupsUpgrade: Unwrapper = {
  id: "uups-upgrade",
  match: (node) => node.selector === UPGRADE_TO || node.selector === UPGRADE_TO_AND_CALL,
  apply: async (node) => {
    const newImpl = node.params[0]?.value as Address | undefined;
    const summary = newImpl
      ? `Upgrades proxy ${short(node.to)} → implementation ${short(newImpl)}`
      : `Upgrades proxy ${short(node.to)}`;

    const children: RawCall[] = [];
    if (node.selector === UPGRADE_TO_AND_CALL && newImpl) {
      const inner = node.params[1]?.value as Hex | undefined;
      if (inner && inner !== "0x") children.push({ to: getAddress(newImpl), value: 0n, data: inner });
    }
    return { summary, children };
  },
};
```

- [ ] **Step 4: Register** — in `unwrappers/index.ts` add the import and list entry:

```ts
import { uupsUpgrade } from "./uupsUpgrade";
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, uupsUpgrade];
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test uupsUpgrade`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/utils/decoding/unwrappers/uupsUpgrade.ts packages/ui/src/utils/decoding/unwrappers/index.ts packages/ui/src/utils/decoding/__tests__/uupsUpgrade.test.ts
git commit -m "feat: uups-upgrade unwrapper"
```

---

### Task 7: erc20 + access-control unwrappers

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/erc20.ts`
- Create: `packages/ui/src/utils/decoding/unwrappers/accessControl.ts`
- Modify: `packages/ui/src/utils/decoding/unwrappers/index.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/erc20.test.ts`
- Create: `packages/ui/src/utils/decoding/__tests__/accessControl.test.ts`

**Interfaces:**
- Consumes: `Unwrapper`, `DecodeCtx.loadToken`.
- Produces: `erc20: Unwrapper`, `accessControl: Unwrapper`.

- [ ] **Step 1: Write failing tests**

`__tests__/erc20.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { erc20 } from "../unwrappers/erc20";

const TOKEN = "0x10dea67478c5F8C5E2D90e5E9B26dBe60c54d800";
const DST = "0x000000000000000000000000000000000000dEaD";

function node(): DecodedNode {
  return {
    to: TOKEN as `0x${string}`, value: 0n, data: "0xa9059cbb" as `0x${string}`,
    selector: "0xa9059cbb", functionName: "transfer", signature: "transfer(address,uint256)",
    params: [{ name: "to", type: "address", value: DST }, { name: "amount", type: "uint256", value: 1500000n }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [],
  };
}
const ctx = { loadToken: async () => ({ decimals: 6, symbol: "USDC" }) } as unknown as DecodeCtx;

describe("erc20 unwrapper", () => {
  it("formats transfer amount with token decimals and symbol", async () => {
    const n = node();
    expect(erc20.match(n)).toBe(true);
    const { summary } = await erc20.apply(n, ctx);
    expect(summary).toBe("Transfer 1.5 USDC → 0x0000…dEaD");
  });
});
```

`__tests__/accessControl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { DecodedNode, DecodeCtx } from "../types";
import { accessControl } from "../unwrappers/accessControl";

const C = "0x6f21C543a4aF5189eBdb0723827577e1EF57ef1f";
const NEW_OWNER = "0x000000000000000000000000000000000000bEEF";
const ctx = {} as DecodeCtx;

function node(p: Partial<DecodedNode>): DecodedNode {
  return {
    to: C as `0x${string}`, value: 0n, data: "0xf2fde38b" as `0x${string}`,
    selector: "0xf2fde38b", functionName: "transferOwnership", signature: "transferOwnership(address)",
    params: [{ name: "newOwner", type: "address", value: NEW_OWNER }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [], ...p,
  };
}

describe("access-control unwrapper", () => {
  it("summarizes transferOwnership", async () => {
    const n = node({});
    expect(accessControl.match(n)).toBe(true);
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toContain("Transfers ownership");
    expect(summary).toContain("0x0000…bEEF");
  });

  it("summarizes acceptOwnership", async () => {
    const n = node({ selector: "0x79ba5097", functionName: "acceptOwnership", signature: "acceptOwnership()", params: [] });
    const { summary } = await accessControl.apply(n, ctx);
    expect(summary).toContain("Accepts ownership");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test erc20 accessControl`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `unwrappers/erc20.ts`**

```ts
import { formatUnits, type Address, type Unwrapper as _ } from "viem";
import type { DecodedNode, Unwrapper } from "../types";

const TRANSFER = "0xa9059cbb";
const TRANSFER_FROM = "0x23b872dd";
const APPROVE = "0x095ea7b3";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const erc20: Unwrapper = {
  id: "erc20",
  match: (node) => node.selector === TRANSFER || node.selector === TRANSFER_FROM || node.selector === APPROVE,
  apply: async (node, ctx) => {
    const meta = (await ctx.loadToken(node.to)) ?? { decimals: 18, symbol: "tokens" };
    const amount = node.params[node.params.length - 1]?.value as bigint;
    const amt = `${formatUnits(amount ?? 0n, meta.decimals)} ${meta.symbol}`;
    if (node.selector === APPROVE) {
      const spender = node.params[0]?.value as Address;
      return { summary: `Approve ${short(spender)} to spend ${amt}`, children: [] };
    }
    const dst = (node.selector === TRANSFER_FROM ? node.params[1]?.value : node.params[0]?.value) as Address;
    return { summary: `Transfer ${amt} → ${short(dst)}`, children: [] };
  },
};
```
(Remove the bogus `type Unwrapper as _` import — only `formatUnits` and `Address` are needed from viem.)

- [ ] **Step 4: Implement `unwrappers/accessControl.ts`**

```ts
import type { Address } from "viem";
import type { Unwrapper } from "../types";

const TRANSFER_OWNERSHIP = "0xf2fde38b";
const ACCEPT_OWNERSHIP = "0x79ba5097";
const GRANT_ROLE = "0x2f2ff15d";
const REVOKE_ROLE = "0xd547741f";

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const accessControl: Unwrapper = {
  id: "access-control",
  match: (node) =>
    [TRANSFER_OWNERSHIP, ACCEPT_OWNERSHIP, GRANT_ROLE, REVOKE_ROLE].includes(node.selector ?? ""),
  apply: async (node) => {
    if (node.selector === TRANSFER_OWNERSHIP) {
      return { summary: `Transfers ownership of ${short(node.to)} → ${short(node.params[0]?.value as Address)}`, children: [] };
    }
    if (node.selector === ACCEPT_OWNERSHIP) {
      return { summary: `Accepts ownership of ${short(node.to)}`, children: [] };
    }
    const verb = node.selector === GRANT_ROLE ? "Grants" : "Revokes";
    return { summary: `${verb} a role on ${short(node.to)}`, children: [] };
  },
};
```

- [ ] **Step 5: Register** — in `unwrappers/index.ts`:

```ts
import { erc20 } from "./erc20";
import { accessControl } from "./accessControl";
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, uupsUpgrade, erc20, accessControl];
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm test`
Expected: all decoding tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/utils/decoding/unwrappers packages/ui/src/utils/decoding/__tests__/erc20.test.ts packages/ui/src/utils/decoding/__tests__/accessControl.test.ts
git commit -m "feat: erc20 + access-control unwrappers"
```

---

### Task 8: Real IO — abiResolver + refactor useAbi

**Files:**
- Create: `packages/ui/src/utils/decoding/abiResolver.ts`
- Modify: `packages/ui/src/hooks/useAbi.ts` (reuse the new resolver core)

**Interfaces:**
- Consumes: `getImplementation` (`@/utils/proxies`), `isContract`/`isAddress`/`ADDRESS_ZERO` (`@/utils/evm`), `whatsabi`, `PUB_CHAIN`/`PUB_ETHERSCAN_API_KEY`, `loadSignature` (Task 3).
- Produces:
  - `resolveImplementation(publicClient, address): Promise<Address | null>`
  - `loadAbiWith(publicClient, address): Promise<AbiResolution>`
  - `loadTokenWith(publicClient, address): Promise<{decimals:number;symbol:string} | null>`
  - re-export `loadSignature` from Task 3.

- [ ] **Step 1: Implement `abiResolver.ts`**

```ts
import { Address, PublicClient, isAddressEqual, type AbiFunction } from "viem";
import { whatsabi } from "@shazow/whatsabi";
import { getImplementation } from "@/utils/proxies";
import { ADDRESS_ZERO, isAddress, isContract } from "@/utils/evm";
import { PUB_CHAIN, PUB_ETHERSCAN_API_KEY } from "@/constants";
import type { AbiResolution } from "./types";

export { loadSignature } from "./signatureLookup";

function etherscanLoader() {
  return new whatsabi.loaders.EtherscanABILoader({
    apiKey: PUB_ETHERSCAN_API_KEY,
    baseURL: `https://api.etherscan.io/v2/api?chainid=${PUB_CHAIN.id}`,
  });
}

export async function resolveImplementation(publicClient: PublicClient, address: Address): Promise<Address | null> {
  try {
    const impl = await getImplementation(publicClient, address);
    if (!impl || isAddressEqual(impl, ADDRESS_ZERO)) return null;
    return impl;
  } catch {
    return null;
  }
}

function toFunctionItems(abi: any[]): AbiFunction[] {
  const items: AbiFunction[] = [];
  for (const item of abi) {
    if (item.type !== "function") continue;
    items.push({
      name: (item.name as string) ?? "(unknown function)",
      inputs: item.inputs ?? [],
      outputs: item.outputs ?? [],
      stateMutability: item.stateMutability ?? "payable",
      type: "function",
    });
  }
  return items;
}

export async function loadAbiWith(publicClient: PublicClient, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;

  const implementation = await resolveImplementation(publicClient, address);
  const target = implementation ?? address;
  const isProxy = !!implementation;

  if (!(await isContract(target, publicClient))) return { ...empty, isProxy, implementation };

  // Etherscan verified source first; whatsabi (bytecode) as fallback.
  try {
    const loaded = await whatsabi.autoload(target, {
      provider: publicClient,
      abiLoader: etherscanLoader(),
      followProxies: false,
      enableExperimentalMetadata: true,
    });
    const abi = toFunctionItems(loaded.abi as any[]);
    // whatsabi sets hasCode/verified metadata; treat presence of named, typed inputs as "verified".
    const trust = loaded.abiLoadedFrom ? "verified" : "bytecode";
    return { abi, trust, isProxy, implementation };
  } catch {
    return { ...empty, isProxy, implementation };
  }
}

export async function loadTokenWith(
  publicClient: PublicClient,
  address: Address,
): Promise<{ decimals: number; symbol: string } | null> {
  try {
    const erc20Abi = [
      { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
      { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
    ] as const;
    const [decimals, symbol] = await Promise.all([
      publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    ]);
    return { decimals: Number(decimals), symbol: symbol as string };
  } catch {
    return null;
  }
}
```

Note on `trust`: `whatsabi` exposes the source loader on the autoload result (`abiLoadedFrom`). If that field name differs in 0.21, set `trust` from whether the Etherscan loader returned source: check `loaded.abiLoadedFrom?.name`/presence; when unsure, default verified-if-Etherscan-succeeded by attempting `etherscanLoader().loadABI(target)` directly and catching. Keep behavior: Etherscan success → `verified`, else `bytecode`.

- [ ] **Step 2: Refactor `useAbi.ts` to reuse the resolver**

Replace the two `queryFn`s so the hook delegates to `loadAbiWith` (keeping the same return shape and the existing alert on failure):

```ts
import { Address } from "viem";
import { usePublicClient } from "wagmi";
import { AbiFunction } from "abitype";
import { useQuery } from "@tanstack/react-query";
import { PUB_CHAIN } from "@/constants";
import { useAlerts } from "@/context/Alerts";
import { loadAbiWith } from "@/utils/decoding/abiResolver";

export const useAbi = (contractAddress: Address) => {
  const { addAlert } = useAlerts();
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });

  const { data, isLoading, error } = useQuery({
    queryKey: ["abi", contractAddress ?? "", publicClient?.chain.id],
    queryFn: async () => {
      if (!contractAddress || !publicClient) return { abi: [], trust: "unknown", isProxy: false, implementation: null };
      const res = await loadAbiWith(publicClient, contractAddress);
      if (!res.abi.length && res.trust === "unknown") {
        addAlert("Cannot fetch", {
          description: "The details of the contract cannot be fetched or are not publicly available",
          type: "error",
        });
      }
      return res;
    },
    retry: 6,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retryOnMount: true,
    staleTime: 1000 * 60 * 60 * 24 * 30,
  });

  const abi: AbiFunction[] = data?.abi ?? [];
  return {
    abi,
    isLoading,
    error,
    isProxy: data?.isProxy ?? false,
    implementation: data?.implementation ?? null,
  };
};
```

- [ ] **Step 3: Type-check + verify existing consumer compiles**

Run (from `packages/ui`): `pnpm exec tsc --noEmit`
Expected: no errors. (`calldata-form.tsx` uses `{ abi }` from `useAbi` — unchanged shape.)

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/utils/decoding/abiResolver.ts packages/ui/src/hooks/useAbi.ts
git commit -m "refactor: proxy-aware abi resolver shared by useAbi and decoder"
```

---

### Task 9: useActionTree hook

**Files:**
- Create: `packages/ui/src/hooks/useActionTree.ts`

**Interfaces:**
- Consumes: `decodeAction` (Task 4/5), `loadAbiWith`/`loadTokenWith`/`loadSignature` (Task 8), `RawAction` (`@/utils/types`).
- Produces: `useActionTree(action: RawAction): { node: DecodedNode | null; isLoading: boolean }`.

- [ ] **Step 1: Implement `useActionTree.ts`**

```ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { keccak256, toHex, type Address, type PublicClient } from "viem";
import { PUB_CHAIN } from "@/constants";
import type { RawAction } from "@/utils/types";
import type { AbiResolution, DecodedNode } from "@/utils/decoding/types";
import { decodeAction } from "@/utils/decoding/decodeAction";
import { loadAbiWith, loadTokenWith, loadSignature } from "@/utils/decoding/abiResolver";

const MAX_DEPTH = 4;

export function useActionTree(action: RawAction): { node: DecodedNode | null; isLoading: boolean } {
  const publicClient = usePublicClient({ chainId: PUB_CHAIN.id });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["actionTree", publicClient?.chain.id, action.to, keccak256(toHex(action.data ?? "0x"))],
    enabled: !!publicClient,
    staleTime: 1000 * 60 * 60 * 24 * 7,
    queryFn: async (): Promise<DecodedNode> => {
      const client = publicClient as PublicClient;
      const ctx = {
        loadAbi: (addr: Address): Promise<AbiResolution> =>
          queryClient.fetchQuery({
            queryKey: ["abi", client.chain?.id, addr],
            queryFn: () => loadAbiWith(client, addr),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        loadSignature,
        loadToken: (addr: Address) =>
          queryClient.fetchQuery({
            queryKey: ["token", client.chain?.id, addr],
            queryFn: () => loadTokenWith(client, addr),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        depth: 0,
        maxDepth: MAX_DEPTH,
        seen: new Set<string>(),
      };
      return decodeAction({ to: action.to, value: action.value, data: action.data }, ctx);
    },
  });

  return { node: data ?? null, isLoading };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/hooks/useActionTree.ts
git commit -m "feat: useActionTree hook binding decoder to live IO"
```

---

### Task 10: UI — TrustBadge + recursive ActionNode + wire ProposalActions

**Files:**
- Create: `packages/ui/src/components/proposalActions/trustBadge.tsx`
- Create: `packages/ui/src/components/proposalActions/actionNode.tsx`
- Modify: `packages/ui/src/components/proposalActions/proposalActions.tsx`

**Interfaces:**
- Consumes: `useActionTree`, `DecodedNode`, existing `EncodedView`, `decodeCamelCase`, `formatHexString`, `PUB_CHAIN`.
- Produces: visual recursive tree. `ProposalActions` public props are unchanged (`actions?: RawAction[]`, `onRemove?`), so all three proposal pages keep working.

- [ ] **Step 1: Implement `trustBadge.tsx`**

```tsx
import { AvatarIcon, IconType } from "@aragon/ods";
import type { TrustLevel } from "@/utils/decoding/types";

const MAP: Record<TrustLevel, { label: string; variant: "primary" | "warning"; icon: IconType }> = {
  verified: { label: "Verified", variant: "primary", icon: IconType.CHECKMARK },
  bytecode: { label: "Decoded from bytecode", variant: "primary", icon: IconType.CHECKMARK },
  "signature-db": { label: "Unverified signature", variant: "warning", icon: IconType.WARNING },
  unknown: { label: "Could not decode", variant: "warning", icon: IconType.WARNING },
};

export const TrustBadge: React.FC<{ trust: TrustLevel }> = ({ trust }) => {
  const { label, variant, icon } = MAP[trust];
  return (
    <span className="flex items-center gap-x-1 text-neutral-500" title={label}>
      <AvatarIcon variant={variant} size="sm" icon={icon} />
      <span className="text-sm">{label}</span>
    </span>
  );
};
```

- [ ] **Step 2: Implement `actionNode.tsx`** (recursive; groups consecutive identical children)

```tsx
import { PUB_CHAIN } from "@/constants";
import { formatHexString } from "@/utils/evm";
import { decodeCamelCase } from "@/utils/case";
import { InputText, TextArea } from "@aragon/ods";
import Link from "next/link";
import { formatEther } from "viem";
import type { DecodedNode } from "@/utils/decoding/types";
import { EncodedView } from "./encodedView";
import { TrustBadge } from "./trustBadge";

function paramDisplay(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(paramDisplay).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return String(value);
}

// Group runs of identical children (same to + selector) for readable batches.
function groupChildren(children: DecodedNode[]): Array<{ node: DecodedNode; count: number }> {
  const out: Array<{ node: DecodedNode; count: number }> = [];
  for (const child of children) {
    const last = out[out.length - 1];
    if (last && last.node.to === child.to && last.node.selector === child.selector && child.children.length === 0) {
      last.count += 1;
    } else {
      out.push({ node: child, count: 1 });
    }
  }
  return out;
}

export const ActionNode: React.FC<{ node: DecodedNode; depth?: number }> = ({ node, depth = 0 }) => {
  const explorerUrl = `${PUB_CHAIN.blockExplorers?.default.url}/address/${node.to}`;
  const title = node.functionName ? decodeCamelCase(node.functionName) : node.selector ? "(unrecognized call)" : `Transfer ${PUB_CHAIN.nativeCurrency.symbol}`;
  const indent = depth > 0 ? "border-l border-neutral-100 pl-4 md:pl-6" : "";

  return (
    <div className={`flex flex-col gap-y-3 ${indent}`}>
      <div className="flex flex-col gap-y-1">
        <span className="text-lg leading-tight text-neutral-800 md:text-xl">{title}</span>
        <div className="flex items-center gap-x-3">
          <Link href={explorerUrl} target="_blank" className="text-neutral-500">
            {formatHexString(node.to)}
          </Link>
          <TrustBadge trust={node.trust} />
        </div>
        {node.summary && <p className="md:text-md text-base text-neutral-600">{node.summary}</p>}
      </div>

      {/* Body: decoded params, or raw fallback */}
      {node.error || (!node.functionName && !node.summary) ? (
        <EncodedView rawAction={{ to: node.to, value: node.value, data: node.data }} />
      ) : (
        <div className="flex flex-col gap-y-2">
          {node.signature && <InputText label="Contract function" className="w-full" value={node.signature} disabled />}
          {node.params.map((p, i) => {
            const v = p.formatted ?? paramDisplay(p.value);
            const label = decodeCamelCase(p.name || `Parameter ${i + 1}`);
            return v.length > 42 ? (
              <TextArea key={i} label={label} className="h-full w-full" value={v} disabled />
            ) : (
              <InputText key={i} label={label} className="w-full" value={v} disabled />
            );
          })}
          {node.value > 0n && (
            <InputText
              label={`${PUB_CHAIN.nativeCurrency.symbol} value`}
              className="w-full"
              value={`${formatEther(node.value)} ${PUB_CHAIN.nativeCurrency.symbol}`}
              disabled
            />
          )}
        </div>
      )}

      {node.truncated && <p className="text-sm text-warning-500">Nested calls hidden ({node.truncated}). View raw data on the explorer.</p>}

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col gap-y-4">
          {groupChildren(node.children).map(({ node: child, count }, i) => (
            <div key={i} className="flex flex-col gap-y-1">
              {count > 1 && <span className="text-sm text-neutral-500">{count}× repeated call</span>}
              <ActionNode node={child} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: Rewire `ActionItem` in `proposalActions.tsx`**

Replace the `useAction` import with `useActionTree` and the `ActionNode` import, and replace the `ActionItem` body so the accordion content renders `<ActionNode node={node} />`. Keep the header (Action N) and the `onRemove` button. Concretely:

Change imports:
```tsx
import { useActionTree } from "@/hooks/useActionTree";
import { ActionNode } from "./actionNode";
```
(remove `useAction`, `CallFunctionSignatureField`, `CallParamField`, `decodeCamelCase` imports if now unused — keep `EncodedView` import removed too since `ActionNode` owns it.)

Replace the `ActionItem` component with:
```tsx
const ActionItem = ({ index, rawAction, onRemove }: { index: number; rawAction: RawAction; onRemove?: () => any }) => {
  const { node, isLoading } = useActionTree(rawAction);
  const title = `Action ${index + 1}`;
  const isEthTransfer = !rawAction.data || rawAction.data === "0x";
  const headline = node?.functionName
    ? node.functionName
    : isEthTransfer
      ? `Transfer ${PUB_CHAIN.nativeCurrency.symbol}`
      : "(function call)";

  return (
    <AccordionItem className="border-t border-t-neutral-100 bg-neutral-0" value={title}>
      <AccordionItemHeader className="!items-start">
        <div className="flex w-full justify-between">
          <div className="flex w-full flex-1 flex-col items-start gap-y-2">
            <span className="text-left text-lg leading-tight text-neutral-800 md:text-xl">
              {decodeCamelCase(headline)}
            </span>
            <Link href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${rawAction.to}`} target="_blank">
              <span className="text-neutral-500">{formatHexString(rawAction.to)}</span>
            </Link>
          </div>
          <div className="hidden w-36 text-right text-sm text-neutral-500 sm:block md:text-base">{title}</div>
        </div>
      </AccordionItemHeader>
      <AccordionItemContent className="!overflow-none">
        <div className="flex flex-col gap-y-4">
          {isLoading || !node ? (
            <p className="text-neutral-500">Decoding…</p>
          ) : (
            <ActionNode node={node} />
          )}
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
Keep `decodeCamelCase` import (used for headline). Ensure remaining imports (`AccordionItem*`, `Button`, `IconType`, `Link`, `If`, `formatHexString`, `PUB_CHAIN`) stay.

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (remove any now-unused imports it flags).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/proposalActions/trustBadge.tsx packages/ui/src/components/proposalActions/actionNode.tsx packages/ui/src/components/proposalActions/proposalActions.tsx
git commit -m "feat: recursive ActionNode tree with trust badges and summaries"
```

---

### Task 11: Manual verification against live mainnet proposals

**Files:** none (verification only). Dev server runs at `http://localhost:3000` (mainnet config).

- [ ] **Step 1: Ensure full test suite is green**

Run (from `packages/ui`): `pnpm test`
Expected: all decoding suites PASS.

- [ ] **Step 2: Restart/confirm dev server**

Confirm `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` returns `200`. If not, from `packages/ui` run `./node_modules/.bin/next dev -p 3000`.

- [ ] **Step 3: Verify proposal #33 (the upgrade)**

Open `http://localhost:3000/plugins/community-proposals/#/proposals/33`, expand Action 1. Confirm:
- Header reads `execute` with `0x75Ba…CD0a` + a "Verified" badge.
- Summary line: "Executes 1 sub-action(s)".
- Nested child: `upgradeTo` on `0x6f21…ef1f` with summary "Upgrades proxy 0x6f21…ef1f → implementation 0x349a…0098" and the `newImplementation` param shown.
- No raw hex blob remains for this action.

- [ ] **Step 4: Verify a multi-sub-action batch (#31)**

Open proposal #31. Confirm the `execute(bytes)` expands into a grouped list (e.g. "12× repeated call" for `setProgramTrusted`), each child named.

- [ ] **Step 5: Verify an ownership proposal (#29)**

Open proposal #29. Confirm a child summarizes ownership transfer (or `acceptOwnership`).

- [ ] **Step 6: Regression — a no-action proposal**

Open any of #7/#8/#15. Confirm the "signaling poll / no actions" copy still renders (unchanged path).

- [ ] **Step 7: Commit (docs note only, if anything adjusted)**

If steps surfaced copy tweaks, make them and commit:
```bash
git commit -am "fix: action tree rendering tweaks from manual verification"
```

---

## Self-Review

**Spec coverage:**
- Recursive decode tree → Tasks 4, 5 (recursion), 10 (render). ✓
- Hybrid trust (verified → bytecode → signature-db → unknown) → Task 4 (tiering), Task 8 (resolver), Task 3 (sig-db). ✓
- Plain-English summaries, `null` when unrecognized → Tasks 5–7; `decodeAction` only sets summary via unwrapper. ✓
- Proxy-aware ABI resolution (load-bearing) → Task 8 (`resolveImplementation` before ABI fetch). ✓
- Per-node error isolation / raw fallback → Task 4 (`error`), Task 10 (`EncodedView`). ✓
- Bounded recursion (depth 4 + cycle guard) → Task 5. ✓
- Conservative action-array detection → Task 5 (`extractActionArray` validates addresses + clean decode; negative test included). ✓
- Performance: react-query cache/dedup → Task 9 (`fetchQuery` keyed by chain+address). ✓
- UX grouping of identical siblings → Task 10 (`groupChildren`). ✓
- Vitest scoped to decoding utils → Task 1. ✓
- Lowest-trust propagation hint on parents → **partially**: per-node badges shipped (Task 10); aggregate "contains unverified calls" rollup is deferred (note below).

**Deferred/limited (intentional, flagged to user):** `multicall3` unwrapper; `DecodedParam.node`; the parent "lowest-trust-among-descendants" rollup hint (each node still shows its own badge — no trust is hidden, only the convenience rollup is out). ERC-7730, security flags, simulation remain future iterations per the spec.

**Placeholder scan:** no TBD/TODO; every code step shows full code; test code is concrete with real #33 calldata. One inline correction noted in Task 7 Step 3 (remove the bogus `type Unwrapper as _` import) and Task 8 Step 1 (whatsabi `abiLoadedFrom` field name to confirm at implementation time — fallback behavior specified).

**Type consistency:** `decodeAction(call, ctx)`, `Unwrapper.apply(node, ctx) → {summary, children}`, `AbiResolution {abi,trust,isProxy,implementation}`, `DecodeCtx {loadAbi,loadSignature,loadToken,depth,maxDepth,seen}`, `RawCall {to,value,data}` are used identically across Tasks 2–10. `useActionTree → {node, isLoading}` consumed in Task 10. ✓
