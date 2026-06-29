# Embedded & Cross-Chain Calldata Decoding (B+) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recursively reveal calldata-inside-calldata in proposal actions — including across chains — so a reviewer sees the chain of intent (e.g. `sendMessage → onMessageInvocation → upgradeTo(0x7e83…)`), with each layer's arguments shown only when they come from a verified source.

**Architecture:** Extend the existing `decodeAction` + unwrapper recursion. Thread a `chainId` through `RawCall`/`DecodedNode`/`DecodeCtx`; add a multi-chain *verified* ABI resolver (Etherscan v2, same key, different `chainid`); add a Taiko-bridge envelope unwrapper that emits cross-chain child calls; add a generic Unverified "encoded call" labeler for bytes we can't verify.

**Tech Stack:** TypeScript, React, viem, `@shazow/whatsabi`, `@tanstack/react-query`, vitest.

## Global Constraints

- Package manager is **pnpm**; from `packages/ui` run tests with `./node_modules/.bin/vitest run <path>` and type-check with `./node_modules/.bin/tsc --noEmit`. Repo lints with `eslint --max-warnings=0` — no unused imports.
- **Security rule (governs everything):** argument *values* are rendered only when types come from (1) a verified contract ABI on the **chain where the call executes**, or (2) a hardcoded, code-reviewed struct type that **validates** before display. The 4-byte signature DB yields **name only, Unverified — never argument values**.
- **Cross-chain trust:** the `chainId` used to resolve an embedded call's ABI must come from a **trusted decode** (a verified ABI field or a validated hardcoded struct), never from a guess. Never resolve an embedded call's ABI against a chain it doesn't execute on.
- **Always:** raw bytes are never hidden; recursion stays within existing `maxDepth`/`maxNodes` guards; any decode/resolution error degrades to raw and never breaks the render; decoded text renders through React (escaped).
- New optional fields (`chainId?`, `embeddedCalls?`) must not break existing object literals or tests — keep them optional where the spec says optional.
- Taiko mainnet is Etherscan-v2-supported at `https://api.etherscan.io/v2/api?chainid=167000` (verified against the v2 chainlist). `PUB_CHAIN.id` is the app chain (mainnet = 1).
- `IBridge.Message` tuple (field order, confirmed by decoding proposal #28): `(uint64 id, uint64 fee, uint32 gasLimit, address from, uint64 srcChainId, address srcOwner, uint64 destChainId, address destOwner, address to, uint256 value, bytes data)`.

---

## Phase 1 — Chain-id threading + multi-chain verified resolver

### Task 1: Thread `chainId` through the decode types and `decodeAction`

**Files:**
- Modify: `packages/ui/src/utils/decoding/types.ts`
- Modify: `packages/ui/src/utils/decoding/decodeAction.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts`

**Interfaces:**
- Consumes: existing `RawCall`, `DecodedNode`, `DecodeCtx`, `decodeAction(call, ctx)`.
- Produces:
  - `RawCall.chainId?: number` — chain where the call executes (default = app chain).
  - `DecodedNode.chainId: number` — resolved chain for the node.
  - `DecodeCtx.chainId: number` — the app/default chain id.
  - `DecodeCtx.loadAbi: (address: Address, chainId: number) => Promise<AbiResolution>` — now chain-aware.

- [ ] **Step 1: Write the failing test**

Add to `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts` (inside the existing `describe("decodeAction (one level)", …)`):

```typescript
  it("defaults node.chainId to ctx.chainId and passes it to loadAbi", async () => {
    let seenChainId: number | undefined;
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        chainId: 1,
        loadAbi: async (_addr, chainId): Promise<AbiResolution> => {
          seenChainId = chainId;
          return { abi: [transferAbi], trust: "verified", isProxy: false, implementation: null };
        },
      }),
    );
    expect(node.chainId).toBe(1);
    expect(seenChainId).toBe(1);
  });

  it("uses an explicit call.chainId for the node and the loadAbi lookup", async () => {
    let seenChainId: number | undefined;
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data, chainId: 167000 },
      ctx({
        chainId: 1,
        loadAbi: async (_addr, chainId): Promise<AbiResolution> => {
          seenChainId = chainId;
          return { abi: [transferAbi], trust: "verified", isProxy: false, implementation: null };
        },
      }),
    );
    expect(node.chainId).toBe(167000);
    expect(seenChainId).toBe(167000);
  });
```

Also update the shared `ctx()` helper at the top of that file to include a default `chainId` and the new `loadAbi` arity:

```typescript
function ctx(overrides: Partial<DecodeCtx> = {}): DecodeCtx {
  return {
    loadAbi: async (): Promise<AbiResolution> => ({ abi: [transferAbi], trust: "verified", isProxy: false, implementation: null }),
    loadSignature: async () => null,
    loadToken: async () => null,
    chainId: 1,
    depth: 0,
    maxDepth: 4,
    seen: new Set(),
    ...overrides,
  };
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/decodeAction.test.ts`
Expected: FAIL — `node.chainId` is `undefined` and/or TS error that `chainId` is not on `RawCall`/`DecodeCtx`.

- [ ] **Step 3: Add the fields to the types**

In `packages/ui/src/utils/decoding/types.ts`:

Add to `DecodedNode` (after `implementation: Address | null;`):

```typescript
  /** Chain id where this call executes (app chain unless an envelope routed it cross-chain). */
  chainId: number;
```

Add to `RawCall`:

```typescript
export type RawCall = { to: Address; value: bigint; data: Hex; chainId?: number };
```

Change `DecodeCtx.loadAbi` and add `chainId`:

```typescript
export type DecodeCtx = {
  loadAbi: (address: Address, chainId: number) => Promise<AbiResolution>;
  loadSignature: (selector: Hex) => Promise<AbiFunction | null>;
  loadToken: (address: Address) => Promise<{ decimals: number; symbol: string } | null>;
  /** App/default chain id; a call without an explicit chainId resolves here. */
  chainId: number;
  depth: number;
  maxDepth: number;
  seen: Set<string>;
  maxNodes?: number;
  nodeCount?: { value: number };
};
```

- [ ] **Step 4: Set and thread `chainId` in `decodeAction`**

In `packages/ui/src/utils/decoding/decodeAction.ts`:

In `baseNode(call)`, add `chainId` (default 1; overwritten in `decodeAction` from ctx):

```typescript
function baseNode(call: RawCall): DecodedNode {
  return {
    to: call.to,
    value: call.value,
    data: call.data,
    chainId: call.chainId ?? 1,
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
```

In `decodeAction`, set the node's chain from the call or ctx default, and pass it to `loadAbi`. Replace the start of the function body and the `loadAbi` call:

```typescript
export async function decodeAction(call: RawCall, ctx: DecodeCtx): Promise<DecodedNode> {
  const node = baseNode(call);
  node.chainId = call.chainId ?? ctx.chainId;
```

and

```typescript
    resolution = await ctx.loadAbi(call.to, node.chainId);
```

The inline fallback resolution object in the `catch` stays as-is (no `chainId` field on `AbiResolution`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/decodeAction.test.ts`
Expected: PASS (all tests in the file — the other tests still pass because `loadAbi` ignores the extra arg and `ctx()` now supplies `chainId`).

- [ ] **Step 6: Fix the other decode test ctx literals if needed, run the whole decoding suite**

Some sibling tests build a `DecodeCtx` inline. Run the full suite and fix any that now lack `chainId`:

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS. If any test errors with a missing `chainId`, add `chainId: 1` to that inline ctx literal.

- [ ] **Step 7: Type-check**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: errors ONLY in `useActionTree.ts` (its `ctx` now misses `chainId` and its `loadAbi` arity differs) — Task 2 fixes those. No errors elsewhere. (If `decodeAction.ts` errors, fix before continuing.)

- [ ] **Step 8: Commit**

```bash
git add src/utils/decoding/types.ts src/utils/decoding/decodeAction.ts src/utils/decoding/__tests__/decodeAction.test.ts
git commit -m "feat(decoding): thread chainId through decode types and decodeAction"
```

---

### Task 2: Multi-chain verified ABI resolver + wire `useActionTree`

**Files:**
- Modify: `packages/ui/src/utils/decoding/abiResolver.ts`
- Modify: `packages/ui/src/hooks/useActionTree.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/abiResolver.crosschain.test.ts` (create)

**Interfaces:**
- Consumes: `AbiResolution`, existing `loadAbiWith(publicClient, address)`, `abiQueryKey(chainId, address)`.
- Produces:
  - `etherscanLoader(chainId: number)` — Etherscan v2 loader for a given chain.
  - `isVerifiedAbiChainSupported(chainId: number): boolean` — whether we attempt cross-chain verified resolution.
  - `loadVerifiedAbiFrom(chainId: number, address: Address): Promise<AbiResolution>` — HTTP-only verified ABI+name for another chain (no RPC/proxy reads).

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const getContract = vi.fn();
vi.mock("@shazow/whatsabi", () => ({
  whatsabi: { loaders: { EtherscanABILoader: vi.fn().mockImplementation(() => ({ getContract })) } },
}));

import { loadVerifiedAbiFrom, isVerifiedAbiChainSupported } from "../abiResolver";

const ADDR = "0x000000000000000000000000000000000000dEaD" as const;

describe("cross-chain verified resolver", () => {
  beforeEach(() => getContract.mockReset());

  it("treats Taiko mainnet (167000) as supported and Ethereum (1) as in-range", () => {
    expect(isVerifiedAbiChainSupported(167000)).toBe(true);
    expect(isVerifiedAbiChainSupported(1)).toBe(true);
    expect(isVerifiedAbiChainSupported(999999)).toBe(false);
  });

  it("returns a verified resolution with name when Etherscan reports ok", async () => {
    getContract.mockResolvedValue({ ok: true, name: "SignalService", abi: [{ type: "function", name: "x", inputs: [], outputs: [], stateMutability: "view" }] });
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("verified");
    expect(res.name).toBe("SignalService");
    expect(res.abi.length).toBe(1);
  });

  it("returns an unknown resolution (no guess) when Etherscan is not ok", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.name).toBeUndefined();
  });

  it("never throws; an Etherscan error degrades to unknown", async () => {
    getContract.mockRejectedValue(new Error("rate limited"));
    const res = await loadVerifiedAbiFrom(167000, ADDR);
    expect(res.trust).toBe("unknown");
    expect(res.abi).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`
Expected: FAIL — `loadVerifiedAbiFrom` / `isVerifiedAbiChainSupported` are not exported.

- [ ] **Step 3: Implement the cross-chain resolver in `abiResolver.ts`**

In `packages/ui/src/utils/decoding/abiResolver.ts`, change `etherscanLoader` to take a chain id, and add the two new exports. Replace the existing `etherscanLoader` function:

```typescript
function etherscanLoader(chainId: number = PUB_CHAIN.id) {
  return new whatsabi.loaders.EtherscanABILoader({
    apiKey: PUB_ETHERSCAN_API_KEY,
    baseURL: `https://api.etherscan.io/v2/api?chainid=${chainId}`,
  });
}

// Chains we will attempt cross-chain VERIFIED resolution for via Etherscan v2.
// Keep explicit: the app chain plus Taiko mainnet (the bridge destination).
const VERIFIED_ABI_CHAINS = new Set<number>([PUB_CHAIN.id, 1, 167000]);

export function isVerifiedAbiChainSupported(chainId: number): boolean {
  return VERIFIED_ABI_CHAINS.has(chainId);
}

/**
 * Verified ABI + name for an address on another chain, via Etherscan v2 (HTTP
 * only — no RPC, so no proxy-slot resolution). Never guesses: a contract that
 * isn't verified on that chain returns an `unknown` resolution. Never throws.
 */
export async function loadVerifiedAbiFrom(chainId: number, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
  try {
    const result = await etherscanLoader(chainId).getContract(address);
    if (!result.ok) return empty;
    return {
      abi: toFunctionItems(result.abi as any[]),
      trust: "verified",
      isProxy: false,
      implementation: null,
      name: result.name || undefined,
    };
  } catch {
    return empty;
  }
}
```

Note: `verifiedName` and `loadAbiWith` keep calling `etherscanLoader()` with no argument (defaults to the app chain) — no behavior change for the current chain.

- [ ] **Step 4: Run the cross-chain test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `useActionTree` to choose resolver by chain and key the cache by chain**

In `packages/ui/src/hooks/useActionTree.ts`, update the import and the `ctx` so `loadAbi` takes a chain id, routes to the cross-chain resolver for non-app chains, and supplies `ctx.chainId`:

```typescript
import { loadAbiWith, loadVerifiedAbiFrom, loadTokenWith, loadSignature, abiQueryKey } from "@/utils/decoding/abiResolver";
```

Replace the `ctx` object's `loadAbi` and add `chainId`:

```typescript
      const appChainId = client.chain.id;
      const ctx = {
        chainId: appChainId,
        loadAbi: (addr: Address, chainId: number): Promise<AbiResolution> =>
          queryClient.fetchQuery({
            queryKey: abiQueryKey(chainId, addr),
            queryFn: () => (chainId === appChainId ? loadAbiWith(client, addr) : loadVerifiedAbiFrom(chainId, addr)),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        loadSignature,
        loadToken: (addr: Address) =>
          queryClient.fetchQuery({
            queryKey: ["token", appChainId, addr.toLowerCase()],
            queryFn: () => loadTokenWith(client, addr),
            staleTime: 1000 * 60 * 60 * 24 * 30,
          }),
        depth: 0,
        maxDepth: MAX_DEPTH,
        seen: new Set<string>(),
      };
```

- [ ] **Step 6: Type-check and run the full decoding suite**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean (no errors).

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/decoding/abiResolver.ts src/hooks/useActionTree.ts src/utils/decoding/__tests__/abiResolver.crosschain.test.ts
git commit -m "feat(decoding): multi-chain verified ABI resolver (Etherscan v2 by chainId)"
```

---

## Phase 2 — Taiko bridge envelope + chain badge

### Task 3: `taikoBridgeMessage` unwrapper

**Files:**
- Create: `packages/ui/src/utils/decoding/unwrappers/taikoBridgeMessage.ts`
- Modify: `packages/ui/src/utils/decoding/unwrappers/index.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/taikoBridgeMessage.test.ts` (create)

**Interfaces:**
- Consumes: `DecodedNode`, `RawCall`, `Unwrapper` from `../types`; the `IBridge.Message` tuple layout from Global Constraints.
- Produces: `taikoBridgeMessage: Unwrapper`, registered in `UNWRAPPERS`. Emits one cross-chain child `RawCall { chainId, to, value, data }` for a recognized bridge message.

**Design notes (read before coding):**
- Two shapes are recognized, gated on the resolved function name AND argument shape (never the bare selector):
  1. `sendMessage` whose single arg is the `Message` tuple — the struct came from the **verified bridge ABI**, so read its already-decoded fields.
  2. `onMessageInvocation(bytes)` — decode the bytes arg as the hardcoded `MESSAGE_TUPLE` and **validate** (decode must not throw; `destChainId` > 0; `to` is a valid address). On any failure, emit no child.
- A decoded named tuple from viem is an object keyed by field name; read by name with an index fallback. Helper `readMessageField` handles both.
- The emitted child carries `chainId = Number(message.destChainId)`, `to = message.to`, `value = message.value`, `data = message.data`. `decodeAction` recursion + the multi-chain resolver (Task 2) verify it on its own chain.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/taikoBridgeMessage.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeAbiParameters, parseAbiParameters, encodeFunctionData, parseAbiItem, type AbiFunction, type Hex } from "viem";
import { taikoBridgeMessage } from "../unwrappers/taikoBridgeMessage";
import type { DecodedNode } from "../types";

const MESSAGE = "(uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes)";
const TO_L2 = "0x4EBeC8a624ac6f01Bb6C7F13947E6Af3727319CA" as const;
const INNER = "0x3659cfe60000000000000000000000007e83af941fdcf90eb44ed7dc8754a201b156e0ba" as Hex; // upgradeTo(0x7e83…)

function messageTuple(opts: { destChainId: bigint; to: string; value: bigint; data: Hex }) {
  return [0n, 0n, 0, TO_L2, 0n, TO_L2, opts.destChainId, TO_L2, opts.to, opts.value, opts.data] as const;
}

function nodeFor(functionName: string, signature: string, paramType: string, value: unknown): DecodedNode {
  return {
    to: TO_L2, value: 0n, data: "0x" as Hex, chainId: 1, selector: "0x1bdb0037",
    functionName, signature, params: [{ name: "_message", type: paramType, value: value as any }],
    trust: "verified", isProxy: false, implementation: null, summary: null, children: [],
  };
}

describe("taikoBridgeMessage", () => {
  it("matches sendMessage and emits a cross-chain child from the decoded struct", async () => {
    const struct = { id:0n, fee:0n, gasLimit:0, from:TO_L2, srcChainId:0n, srcOwner:TO_L2, destChainId:167000n, destOwner:TO_L2, to:TO_L2, value:5n, data:INNER };
    const node = nodeFor("sendMessage", "sendMessage(" + MESSAGE + ")", "tuple", struct);
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ chainId: 167000, to: TO_L2, value: 5n, data: INNER });
  });

  it("matches onMessageInvocation(bytes) and decodes+validates the inner Message", async () => {
    const encoded = encodeAbiParameters(parseAbiParameters(MESSAGE), messageTuple({ destChainId: 167000n, to: TO_L2, value: 0n, data: INNER }));
    const node = nodeFor("onMessageInvocation", "onMessageInvocation(bytes)", "bytes", encoded);
    expect(taikoBridgeMessage.match(node)).toBe(true);
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(1);
    expect(children[0].chainId).toBe(167000);
    expect(children[0].data).toBe(INNER);
  });

  it("emits no child when onMessageInvocation bytes are malformed", async () => {
    const node = nodeFor("onMessageInvocation", "onMessageInvocation(bytes)", "bytes", "0x1234");
    const { children } = await taikoBridgeMessage.apply(node, {} as any);
    expect(children).toHaveLength(0);
  });

  it("does not match an unrelated verified function", async () => {
    const node = nodeFor("transfer", "transfer(address,uint256)", "address", TO_L2);
    expect(taikoBridgeMessage.match(node)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/taikoBridgeMessage.test.ts`
Expected: FAIL — module `../unwrappers/taikoBridgeMessage` does not exist.

- [ ] **Step 3: Implement the unwrapper**

Create `packages/ui/src/utils/decoding/unwrappers/taikoBridgeMessage.ts`:

```typescript
import { decodeAbiParameters, parseAbiParameters, isAddress, getAddress, type Address, type Hex } from "viem";
import type { DecodedNode, RawCall, Unwrapper } from "../types";

// Taiko IBridge.Message tuple (field order confirmed against on-chain proposals).
const MESSAGE_TUPLE = parseAbiParameters(
  "(uint64,uint64,uint32,address,uint64,address,uint64,address,address,uint256,bytes)",
);
const FIELDS = ["id","fee","gasLimit","from","srcChainId","srcOwner","destChainId","destOwner","to","value","data"] as const;

type MessageView = { destChainId: bigint; to: string; value: bigint; data: Hex };

/** Read a tuple field from viem's decode, whether it returned an object (named) or an array. */
function readMessage(value: unknown): MessageView | null {
  if (value == null) return null;
  const get = (name: (typeof FIELDS)[number]) => {
    if (Array.isArray(value)) return value[FIELDS.indexOf(name)];
    return (value as Record<string, unknown>)[name];
  };
  const destChainId = get("destChainId");
  const to = get("to");
  const data = get("data");
  const valueField = get("value");
  if (typeof destChainId !== "bigint" || typeof to !== "string" || typeof data !== "string") return null;
  if (!isAddress(to)) return null;
  if (destChainId <= 0n) return null;
  return { destChainId, to, value: typeof valueField === "bigint" ? valueField : 0n, data: data as Hex };
}

function isSendMessage(node: DecodedNode): boolean {
  return node.functionName === "sendMessage" && node.params[0]?.type?.startsWith("tuple") === true;
}
function isOnMessageInvocation(node: DecodedNode): boolean {
  return node.functionName === "onMessageInvocation" && node.params[0]?.type === "bytes";
}

/** Extract the routed Message from either shape, or null if it can't be trusted. */
function extractMessage(node: DecodedNode): MessageView | null {
  if (isSendMessage(node)) {
    return readMessage(node.params[0]?.value);
  }
  if (isOnMessageInvocation(node)) {
    const bytes = node.params[0]?.value as Hex | undefined;
    if (!bytes || bytes === "0x") return null;
    try {
      const [decoded] = decodeAbiParameters(MESSAGE_TUPLE, bytes);
      return readMessage(decoded);
    } catch {
      return null;
    }
  }
  return null;
}

export const taikoBridgeMessage: Unwrapper = {
  id: "taiko-bridge-message",
  match: (node) => (isSendMessage(node) || isOnMessageInvocation(node)) && extractMessage(node) !== null,
  apply: async (node) => {
    const msg = extractMessage(node);
    if (!msg) return { summary: null, children: [] };
    const child: RawCall = {
      chainId: Number(msg.destChainId),
      to: getAddress(msg.to as Address),
      value: msg.value,
      data: msg.data,
    };
    return { summary: `Bridge message → chain ${msg.destChainId}`, children: [child] };
  },
};
```

- [ ] **Step 4: Register the unwrapper**

In `packages/ui/src/utils/decoding/unwrappers/index.ts`, import and add it to `UNWRAPPERS` (place it before `uupsUpgrade` so bridge messages are recognized first):

```typescript
import { taikoBridgeMessage } from "./taikoBridgeMessage";
```

```typescript
export const UNWRAPPERS: Unwrapper[] = [osxActionArray, taikoBridgeMessage, uupsUpgrade, erc20, accessControl];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/taikoBridgeMessage.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check + full decoding suite**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/decoding/unwrappers/taikoBridgeMessage.ts src/utils/decoding/unwrappers/index.ts src/utils/decoding/__tests__/taikoBridgeMessage.test.ts
git commit -m "feat(decoding): Taiko bridge-message envelope unwrapper (cross-chain child)"
```

---

### Task 4: Chain badge in the action tree UI

**Files:**
- Modify: `packages/ui/src/components/proposalActions/actionNode.tsx`
- Modify: `packages/ui/src/components/proposalActions/actionNode.helpers.ts`
- Test: `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`

**Interfaces:**
- Consumes: `DecodedNode.chainId` (Task 1); `PUB_CHAIN` from `@/constants`.
- Produces: `chainLabel(chainId: number): string | null` — a short label for a non-app chain, or `null` for the app chain.

- [ ] **Step 1: Write the failing test**

Add to `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`:

```typescript
import { chainLabel } from "../actionNode.helpers";

describe("chainLabel", () => {
  it("returns null for the app chain", () => {
    // PUB_CHAIN.id in the test env; chainLabel(appChainId) must be null.
    expect(chainLabel(Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "1"))).toBeNull();
  });
  it("labels Taiko mainnet", () => {
    expect(chainLabel(167000)).toMatch(/Taiko/i);
  });
  it("labels an unknown chain by id", () => {
    expect(chainLabel(424242)).toMatch(/424242/);
  });
});
```

Note: if `PUB_CHAIN.id` is not derivable from env in the test, assert instead with the two non-app cases (167000 and 424242) and a comment that the app-chain case is covered by `chainLabel` returning null for `PUB_CHAIN.id`. Keep the test green and meaningful — do not assert a hardcoded app-chain id that the env might not match.

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: FAIL — `chainLabel` not exported.

- [ ] **Step 3: Implement `chainLabel`**

Append to `packages/ui/src/components/proposalActions/actionNode.helpers.ts`:

```typescript
const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 167000: "Taiko", 167009: "Taiko Hekla" };

/** Short label for a call's chain when it differs from the app chain; null for the app chain. */
export function chainLabel(chainId: number): string | null {
  if (chainId === PUB_CHAIN.id) return null;
  return CHAIN_NAMES[chainId] ?? `chain ${chainId}`;
}
```

(`PUB_CHAIN` is already imported in this file.)

- [ ] **Step 4: Render the badge in `actionNode.tsx`**

In `packages/ui/src/components/proposalActions/actionNode.tsx`, add `chainLabel` to the helpers import:

```typescript
import { paramDisplay, leadParts, callTag, groupChildren, contractLabel, chainLabel } from "./actionNode.helpers";
```

In `LeafItem`, in the metadata row next to `TrustBadge` (after the `<TrustBadge trust={node.trust} />` line), add:

```tsx
        {chainLabel(node.chainId) && (
          <span className="inline-flex items-center gap-x-1 rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
            ↗ {chainLabel(node.chainId)}
          </span>
        )}
```

- [ ] **Step 5: Run the helper test + type-check**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: PASS.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual verification (live)**

Start the dev server (`cd packages/ui && ./node_modules/.bin/next dev -p 3000`), open `http://localhost:3000/plugins/community-proposals/#/proposals/28`, clear cached state once (`localStorage.clear()` then reload) so the new decoder runs, expand Action 1 → action 3 (`sendMessage`). Confirm a nested child appears for the bridged call with a `↗ Taiko` badge, drilling toward the inner `onMessageInvocation` / `upgradeTo`. Note any gap in the report for the controller.

- [ ] **Step 7: Commit**

```bash
git add src/components/proposalActions/actionNode.tsx src/components/proposalActions/actionNode.helpers.ts src/components/proposalActions/__tests__/actionNode.helpers.test.ts
git commit -m "feat(proposalActions): show cross-chain badge on bridged sub-actions"
```

---

## Phase 3 — Generic embedded-calldata labeler (Unverified fallback)

### Task 5: Detect selector-prefixed bytes in params and annotate (DB-confirmed, name only)

**Files:**
- Create: `packages/ui/src/utils/decoding/embeddedCalls.ts`
- Modify: `packages/ui/src/utils/decoding/types.ts`
- Modify: `packages/ui/src/utils/decoding/decodeAction.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/embeddedCalls.test.ts` (create)

**Interfaces:**
- Consumes: `DecodedParam`, `DecodeCtx.loadSignature`.
- Produces:
  - `EmbeddedCall = { path: string; selector: Hex; signature: string | null }` and `DecodedNode.embeddedCalls?: EmbeddedCall[]`.
  - `findEmbeddedCandidates(params: DecodedParam[]): { path: string; selector: Hex }[]` — pure; walks values recursively (tuples/arrays) for `bytes` leaves whose size ≥ 4, returning path + selector. **Never** decodes argument values.

**Design notes:**
- This is the safe floor for bytes we have no verified envelope for. It only ever shows the selector (a literal slice — a fact) and, if the 4-byte DB confirms it, the candidate signature marked Unverified.
- Skip candidates whose bytes equal an existing child's `data` (already expanded by an unwrapper) to avoid double-surfacing.
- Walk `DecodedParam.value`: a `bytes` leaf is a hex string on a param/field typed `bytes`. Recurse into arrays (Array values) and tuples (object/array values). Bound total candidates to 8.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/utils/decoding/__tests__/embeddedCalls.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findEmbeddedCandidates } from "../embeddedCalls";
import type { DecodedParam } from "../types";

const CALLDATA = "0x7f07c947" + "00".repeat(32); // selector + 32 bytes

describe("findEmbeddedCandidates", () => {
  it("finds a top-level bytes param whose head is a 4-byte selector", () => {
    const params: DecodedParam[] = [{ name: "data", type: "bytes", value: CALLDATA }];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "data", selector: "0x7f07c947" }]);
  });

  it("finds a bytes field nested inside a tuple", () => {
    const params: DecodedParam[] = [
      { name: "message", type: "tuple", value: { to: "0x00", data: CALLDATA } },
    ];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "message.data", selector: "0x7f07c947" }]);
  });

  it("finds bytes inside an array", () => {
    const params: DecodedParam[] = [{ name: "calls", type: "bytes[]", value: [CALLDATA] }];
    const found = findEmbeddedCandidates(params);
    expect(found).toEqual([{ path: "calls[0]", selector: "0x7f07c947" }]);
  });

  it("ignores non-bytes and too-short bytes", () => {
    const params: DecodedParam[] = [
      { name: "amount", type: "uint256", value: 5n },
      { name: "short", type: "bytes", value: "0x1234" },
    ];
    expect(findEmbeddedCandidates(params)).toEqual([]);
  });

  it("caps the number of candidates at 8", () => {
    const params: DecodedParam[] = Array.from({ length: 20 }, (_, i) => ({ name: `b${i}`, type: "bytes", value: CALLDATA }));
    expect(findEmbeddedCandidates(params).length).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/embeddedCalls.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the pure walk**

Create `packages/ui/src/utils/decoding/embeddedCalls.ts`:

```typescript
import { size, slice, isHex, type Hex } from "viem";
import type { DecodedParam } from "./types";

const MAX_CANDIDATES = 8;

export type Candidate = { path: string; selector: Hex };

function isCalldataBytes(value: unknown): value is Hex {
  return typeof value === "string" && isHex(value) && size(value as Hex) >= 4;
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
```

- [ ] **Step 4: Run the walk test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/embeddedCalls.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `EmbeddedCall` type and field**

In `packages/ui/src/utils/decoding/types.ts`:

```typescript
export type EmbeddedCall = { path: string; selector: Hex; signature: string | null };
```

Add to `DecodedNode` (after `summary`):

```typescript
  /** Unverified: selector-prefixed bytes found in params, labeled from the 4-byte DB. Never arg values. */
  embeddedCalls?: EmbeddedCall[];
```

- [ ] **Step 6: Integrate into `decodeAction` (DB-confirmed, skip already-expanded)**

In `packages/ui/src/utils/decoding/decodeAction.ts`, import the walk and viem's `toFunctionSignature`:

```typescript
import { findEmbeddedCandidates } from "./embeddedCalls";
```

After the unwrapper block has produced `node.children` (i.e. just before `return node;` at the end of `decodeAction`), add:

```typescript
  // Unverified labeling of any selector-prefixed bytes still shown raw (not already a child).
  if (node.params.length > 0) {
    try {
      const childData = new Set(node.children.map((c) => c.data.toLowerCase()));
      const candidates = findEmbeddedCandidates(node.params).filter((c) => {
        // skip a candidate whose bytes are already an expanded child (avoid double-surfacing)
        return ![...childData].some((d) => d.startsWith(c.selector.toLowerCase()));
      });
      const embedded = [];
      for (const cand of candidates) {
        const frag = await ctx.loadSignature(cand.selector);
        if (frag) embedded.push({ path: cand.path, selector: cand.selector, signature: toFunctionSignature(frag) });
      }
      if (embedded.length) node.embeddedCalls = embedded;
    } catch {
      // labeling is best-effort; never break a decode
    }
  }
```

(`toFunctionSignature` is already imported in `decodeAction.ts`.)

- [ ] **Step 7: Write a decodeAction integration test**

Add to `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts`:

```typescript
  it("labels a selector-prefixed bytes param via the signature DB, marked unverified (no children)", async () => {
    const sendAbi = parseAbiItem("function store(bytes data)") as AbiFunction;
    const inner = ("0x7f07c947" + "00".repeat(32)) as `0x${string}`;
    const data = encodeFunctionData({ abi: [sendAbi], functionName: "store", args: [inner] });
    const pinged = parseAbiItem("function onMessageInvocation(bytes)") as AbiFunction;
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async (): Promise<AbiResolution> => ({ abi: [sendAbi], trust: "verified", isProxy: false, implementation: null }),
        loadSignature: async () => pinged,
      }),
    );
    expect(node.embeddedCalls?.[0]).toMatchObject({ path: "data", selector: "0x7f07c947", signature: "onMessageInvocation(bytes)" });
  });
```

- [ ] **Step 8: Run decode suite + type-check**

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS.

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/utils/decoding/embeddedCalls.ts src/utils/decoding/types.ts src/utils/decoding/decodeAction.ts src/utils/decoding/__tests__/embeddedCalls.test.ts src/utils/decoding/__tests__/decodeAction.test.ts
git commit -m "feat(decoding): label selector-prefixed embedded bytes (unverified, name only)"
```

---

### Task 6: Render the embedded-call annotation

**Files:**
- Modify: `packages/ui/src/components/proposalActions/actionNode.tsx`

**Interfaces:**
- Consumes: `DecodedNode.embeddedCalls` (Task 5); `shortHex` from `@/utils/decoding/format`; existing `TrustBadge`.

- [ ] **Step 1: Render the annotation in `CallDetails`**

In `packages/ui/src/components/proposalActions/actionNode.tsx`, inside `CallDetails`, after the params block and before the native-value block (i.e. after the `params.length > 0 ? … : …` expression), add an embedded-calls section:

```tsx
        {node.embeddedCalls && node.embeddedCalls.length > 0 && (
          <div className="flex flex-col gap-y-1 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2">
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
```

This is additive — the raw bytes remain in the param view and "Raw calldata" below.

- [ ] **Step 2: Type-check**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the full UI + decoding test suites**

Run: `./node_modules/.bin/vitest run src/utils/decoding src/components/proposalActions`
Expected: PASS.

- [ ] **Step 4: Manual verification (live)**

With the dev server running and cache cleared once, open a proposal whose action embeds calldata we have no envelope for (e.g. any `bytes` arg with a DB-known selector) and confirm the "Encoded call(s) detected — Unverified" annotation shows the path + signature + selector, with the raw bytes still visible. Confirm #28 still shows the cross-chain bridge chain from Phase 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/proposalActions/actionNode.tsx
git commit -m "feat(proposalActions): render unverified embedded-call annotations"
```

---

## Self-Review

**Spec coverage:**
- Security model (verified-only arg values; DB = name only; cross-chain trust) → Task 2 (verified-only resolver, no guess), Task 3 (validated struct, trusted chainId source), Task 5 (DB = name only, never arg values). ✔
- Chain-id threading → Task 1. ✔
- Multi-chain verified resolver (Etherscan v2 by chainId, HTTP-only, no wrong-chain guess) → Task 2. ✔
- Envelope unwrapper (sendMessage + onMessageInvocation, validated) → Task 3. ✔
- Chain badge UI → Task 4. ✔
- Generic embedded labeler + render → Tasks 5, 6. ✔
- Raw never hidden / fail-silent / bounded → Task 5 (try/catch, cap 8, additive render), Task 1 (existing maxDepth/maxNodes unchanged). ✔
- Out-of-scope items (cross-chain proxy resolution, non-Taiko envelopes, no DB arg-decoding) → respected (Task 2 sets isProxy=false for cross-chain; only Taiko envelope added; Task 5 never decodes args). ✔

**Placeholder scan:** none — every code step has concrete content.

**Type consistency:** `loadAbi(address, chainId)` consistent across Task 1 (type), Task 2 (useActionTree impl), and `decodeAction` call site. `RawCall.chainId?`/`DecodedNode.chainId` consistent Tasks 1/3/4. `EmbeddedCall {path, selector, signature}` consistent Tasks 5/6. `loadVerifiedAbiFrom(chainId, address)` / `isVerifiedAbiChainSupported(chainId)` consistent Task 2. `chainLabel(chainId)` consistent Task 4. `findEmbeddedCandidates(params)` consistent Task 5.

**Known validation points (flagged for implementer, confirm live in Task 4/6 manual steps):** exact viem tuple shape (object vs array) for the verified bridge ABI's `Message` param — `readMessage` handles both; the precise contract that exposes `onMessageInvocation` on L2 (verified via cross-chain resolver at runtime). If the live structure differs, `extractMessage` returns null and the action degrades to raw (safe).
