# Cross-Chain Proxy Resolution + Verified L2 ABIs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve L2 (Taiko mainnet) proxy contracts the same way the app chain does — read the EIP-1967 implementation slot over the L2 RPC, then fetch the implementation's verified ABI/name from that chain's verified source — so embedded cross-chain calls decode from a real verified ABI instead of falling back to the 4-byte signature DB.

**Architecture:** Add a Taiko RPC constant + a chain registry to `abiResolver.ts`; upgrade `loadVerifiedAbiFrom` so that, for a registry chain, it builds a memoized viem client, resolves the proxy implementation via RPC, and fetches the implementation's verified ABI from Etherscan v2. Verified-source only; never throws; resolution only on the trusted chain id.

**Tech Stack:** TypeScript, viem (`createPublicClient`/`http`, `taiko` from `viem/chains`), whatsabi (`EtherscanABILoader`), vitest.

## Global Constraints

- Package manager **pnpm**; from `packages/ui` run tests with `./node_modules/.bin/vitest run <path>` and type-check with `./node_modules/.bin/tsc --noEmit`. Repo lints with `eslint --max-warnings=0` — no unused imports.
- **Verified-source only:** an unverified implementation yields an `unknown` resolution (no name, empty abi) — never a guess. The resolver must **never throw** (RPC failure / unverified / unsupported chain → `unknown` or impl-less degrade).
- **L2 RPC is read-only** (`getStorageAt` via `getImplementation`); the ABI always comes from Etherscan v2 (`chainid`), never the RPC.
- Resolution happens **only on the chain id passed in** (which the caller derives from a trusted decode). The registry is an explicit allowlist; a chain not in it gets no RPC client.
- Do not change the app-chain path (`loadAbiWith`) or the existing HTTP-only behavior for non-registry chains. Keep `isVerifiedAbiChainSupported` returning true for the existing `{PUB_CHAIN.id, 1, 167000}` set (the existing crosschain test asserts this).
- `PUB_TAIKO_RPC = process.env.NEXT_PUBLIC_TAIKO_RPC || "https://rpc.mainnet.taiko.xyz"`. Taiko mainnet chain id is **167000**; `viem/chains` exports `taiko` (id 167000).
- Existing helpers to reuse: `resolveImplementation(publicClient, address)` and `getImplementation` (`utils/proxies.ts`), `toFunctionItems`, `etherscanLoader(chainId)`, `isAddress` (already in `abiResolver.ts`).

---

### Task 1: Proxy-aware cross-chain resolver

**Files:**
- Modify: `packages/ui/src/constants.ts`
- Modify: `packages/ui/src/utils/decoding/abiResolver.ts`
- Test: `packages/ui/src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`

**Interfaces:**
- Consumes: `AbiResolution`, `resolveImplementation`, `etherscanLoader(chainId)`, `toFunctionItems`, `isAddress`.
- Produces:
  - `PUB_TAIKO_RPC: string` (constants).
  - `chainClient(chainId: number): PublicClient | null` — memoized viem client for a registry chain, else null.
  - `loadVerifiedViaRpc(chainId: number, address: Address, client: PublicClient): Promise<AbiResolution>` — proxy-aware verified resolution (exported for testing).
  - Upgraded `loadVerifiedAbiFrom(chainId, address)` — routes registry chains through `loadVerifiedViaRpc`, others through the existing HTTP-only path.

- [ ] **Step 1: Add the Taiko RPC constant**

In `packages/ui/src/constants.ts`, after the `PUB_WEB3_ENDPOINT` definition (line ~43), add:

```typescript
export const PUB_TAIKO_RPC = process.env.NEXT_PUBLIC_TAIKO_RPC || "https://rpc.mainnet.taiko.xyz";
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/ui/src/utils/decoding/__tests__/abiResolver.crosschain.test.ts` (the file already mocks `@shazow/whatsabi` with a shared `getContract` mock and imports from `../abiResolver`). Add `loadVerifiedViaRpc` and `chainClient` to the import, then add this `describe`:

```typescript
import { loadVerifiedViaRpc, chainClient } from "../abiResolver";

const PROXY = "0x00000000000000000000000000000000000000Aa" as const;
const IMPL = "0x00000000000000000000000000000000000000Bb" as const;
const padded = (a: string) => ("0x" + "0".repeat(24) + a.slice(2)) as `0x${string}`;

function fakeClient(slotValue: string | null | (() => never)) {
  return {
    getStorageAt: vi.fn(async () => {
      if (typeof slotValue === "function") slotValue();
      return slotValue as any;
    }),
  } as any;
}

describe("loadVerifiedViaRpc (proxy-aware cross-chain)", () => {
  beforeEach(() => { getContract.mockReset(); });

  it("resolves a proxy: impl ABI/name + proxy name, trust verified", async () => {
    getContract.mockImplementation(async (addr: string) => {
      if (addr.toLowerCase() === IMPL.toLowerCase())
        return { ok: true, name: "OnMessageInvoker", abi: [{ type: "function", name: "f", inputs: [], outputs: [], stateMutability: "view" }] };
      return { ok: true, name: "ERC1967Proxy", abi: [] };
    });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded(IMPL)));
    expect(res.trust).toBe("verified");
    expect(res.isProxy).toBe(true);
    expect(res.implementation?.toLowerCase()).toBe(IMPL.toLowerCase());
    expect(res.name).toBe("OnMessageInvoker");
    expect(res.proxyName).toBe("ERC1967Proxy");
    expect(res.abi.length).toBe(1);
  });

  it("resolves a non-proxy verified contract by its own address", async () => {
    getContract.mockResolvedValue({ ok: true, name: "Direct", abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded("0x0000000000000000000000000000000000000000")));
    expect(res.isProxy).toBe(false);
    expect(res.name).toBe("Direct");
    expect(res.trust).toBe("verified");
  });

  it("returns unknown (no name) when the implementation is unverified, preserving isProxy", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(padded(IMPL)));
    expect(res.trust).toBe("unknown");
    expect(res.name).toBeUndefined();
    expect(res.isProxy).toBe(true);
    expect(res.implementation?.toLowerCase()).toBe(IMPL.toLowerCase());
  });

  it("never throws on RPC failure", async () => {
    getContract.mockResolvedValue({ ok: false, name: null, abi: [] });
    const res = await loadVerifiedViaRpc(167000, PROXY, fakeClient(() => { throw new Error("rpc down"); }));
    expect(res.trust).toBe("unknown");
    expect(res.abi).toEqual([]);
  });

  it("chainClient memoizes one client per supported chain and returns null for unsupported", () => {
    expect(chainClient(999999)).toBeNull();
    const a = chainClient(167000);
    const b = chainClient(167000);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`
Expected: FAIL — `loadVerifiedViaRpc` / `chainClient` are not exported.

- [ ] **Step 4: Add the chain registry + memoized client**

In `packages/ui/src/utils/decoding/abiResolver.ts`, update the imports at the top:

```typescript
import { Address, PublicClient, createPublicClient, http, isAddressEqual, type AbiFunction, type Chain } from "viem";
import { taiko } from "viem/chains";
```

and add `PUB_TAIKO_RPC` to the constants import:

```typescript
import { PUB_CHAIN, PUB_ETHERSCAN_API_KEY, PUB_TAIKO_RPC } from "@/constants";
```

After the `VERIFIED_ABI_CHAINS` / `isVerifiedAbiChainSupported` block (line ~33), add the registry and memoized client:

```typescript
// Chains we resolve proxy-aware (RPC slot read + verified impl ABI). The app
// chain is handled by loadAbiWith; this is for cross-chain targets only.
const CHAIN_RESOLVERS: Record<number, { chain: Chain; rpcUrl: string }> = {
  167000: { chain: taiko, rpcUrl: PUB_TAIKO_RPC },
};

const clientCache = new Map<number, PublicClient>();

/** Memoized read-only viem client for a registry chain, or null if unsupported. */
export function chainClient(chainId: number): PublicClient | null {
  const entry = CHAIN_RESOLVERS[chainId];
  if (!entry) return null;
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const client = createPublicClient({ chain: entry.chain, transport: http(entry.rpcUrl) }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}
```

- [ ] **Step 5: Generalize `verifiedName` to take a chain id**

Change the existing `verifiedName` signature so the proxy-name lookup can target the right chain (default stays the app chain, so existing callers are unchanged):

```typescript
/** Verified contract name for an address via Etherscan, or null if unverified/unavailable. */
async function verifiedName(address: Address, chainId: number = PUB_CHAIN.id): Promise<string | null> {
  try {
    const result = await etherscanLoader(chainId).getContract(address);
    return result.ok && result.name ? result.name : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Add `loadVerifiedViaRpc` and route `loadVerifiedAbiFrom`**

Replace the existing `loadVerifiedAbiFrom` (lines ~35-56) with the routed version plus the proxy-aware resolver:

```typescript
/**
 * Proxy-aware verified resolution on another chain: read the EIP-1967
 * implementation slot over that chain's RPC, then fetch the implementation's
 * verified ABI + name from Etherscan v2. Verified-source only; never throws.
 * Exported for testing (the client is injected).
 */
export async function loadVerifiedViaRpc(
  chainId: number,
  address: Address,
  client: PublicClient,
): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
  try {
    const implementation = await resolveImplementation(client, address);
    const target = implementation ?? address;
    const isProxy = !!implementation;
    const result = await etherscanLoader(chainId).getContract(target);
    if (!result.ok) return { ...empty, isProxy, implementation };
    const proxyName = isProxy ? ((await verifiedName(address, chainId)) ?? undefined) : undefined;
    return {
      abi: toFunctionItems(result.abi as any[]),
      trust: "verified",
      isProxy,
      implementation,
      name: result.name || undefined,
      proxyName,
    };
  } catch {
    return empty;
  }
}

/**
 * Verified ABI + name for an address on another chain. For a chain in the
 * resolver registry, resolves proxy-aware (RPC slot read + verified impl ABI);
 * otherwise HTTP-only Etherscan v2. Never guesses; never throws.
 */
export async function loadVerifiedAbiFrom(chainId: number, address: Address): Promise<AbiResolution> {
  const empty: AbiResolution = { abi: [], trust: "unknown", isProxy: false, implementation: null };
  if (!isAddress(address)) return empty;
  const client = chainClient(chainId);
  if (client) return loadVerifiedViaRpc(chainId, address, client);
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

- [ ] **Step 7: Run the tests to verify they pass**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/abiResolver.crosschain.test.ts`
Expected: PASS (new `loadVerifiedViaRpc`/`chainClient` tests **and** the existing HTTP-only tests — those use chain ids handled by the non-registry branch, or 167000 which now routes through `loadVerifiedViaRpc`; if an existing test used `loadVerifiedAbiFrom(167000, …)` with only the `getContract` mock and no slot, it still passes because `chainClient(167000)` builds a real client whose `getStorageAt` will be attempted — see note). 

> Note for the implementer: the pre-existing tests call `loadVerifiedAbiFrom` for chain `167000` with only `getContract` mocked (no RPC). After this change `167000` routes through `loadVerifiedViaRpc`, which calls `resolveImplementation` on a **real** `createPublicClient` (it would hit the network). To keep those tests hermetic and offline, update them to call the new injected form `loadVerifiedViaRpc(167000, addr, fakeClient(...))`, OR change their chain id to one NOT in the registry (e.g. `1`) so they exercise the HTTP-only branch. Pick whichever keeps each existing assertion's intent; do not weaken assertions. State which you did in the report.

- [ ] **Step 8: Type-check, lint, full decoding suite**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean.

Run: `./node_modules/.bin/eslint src/utils/decoding/abiResolver.ts src/constants.ts`
Expected: clean.

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/constants.ts src/utils/decoding/abiResolver.ts src/utils/decoding/__tests__/abiResolver.crosschain.test.ts
git commit -m "feat(decoding): proxy-aware cross-chain ABI resolution for Taiko L2"
```

---

### Task 2: Verify recursion depth on the live bridge (controller-run)

**Files:**
- Possibly modify: `packages/ui/src/hooks/useActionTree.ts` (only the `MAX_DEPTH` constant, if needed)

**Interfaces:**
- Consumes: nothing new. Reads `MAX_DEPTH = 4` in `useActionTree.ts`.

> This task needs a live browser check (controller-run), not a unit test.

- [ ] **Step 1: Restart the dev server and load #28**

Start `cd packages/ui && ./node_modules/.bin/next dev -p 3000`, open
`http://localhost:3000/plugins/community-proposals/#/proposals/28`, clear site
storage once (`localStorage.clear()` then reload), expand Action 1 → action 3
(`Send message`) → the `On message invocation` sub-action.

- [ ] **Step 2: Check whether the L2 layer now resolves verified**

Expected after Task 1: `On message invocation` on Taiko shows a resolved
implementation name and `Verified` (not "Unverified signature"), and its real
argument types are decoded from the verified ABI.

- [ ] **Step 3: Check for depth truncation**

If the innermost verified call (e.g. the eventual `upgradeTo`) is missing and the
deepest visible node shows a depth-truncation state (`node.truncated === "depth"`
— rendered via the existing truncation UI), the chain is being cut by
`MAX_DEPTH`. If everything that can be decoded is shown, leave `MAX_DEPTH` as is
and skip Step 4.

- [ ] **Step 4: Bump `MAX_DEPTH` only if truncated**

In `packages/ui/src/hooks/useActionTree.ts`, change `const MAX_DEPTH = 4;` to
`const MAX_DEPTH = 6;` (breadth stays bounded by the existing `maxNodes` guard).
Reload and confirm the deeper layers now render.

- [ ] **Step 5: Commit (only if Step 4 was needed)**

```bash
git add src/hooks/useActionTree.ts
git commit -m "fix(decoding): raise action-tree max depth for nested bridge messages"
```

---

## Self-Review

**Spec coverage:**
- Chain registry + `PUB_TAIKO_RPC` → Task 1 Steps 1, 4. ✔
- Proxy-aware `loadVerifiedAbiFrom` (slot read + verified impl ABI + proxy name) → Task 1 Steps 5, 6. ✔
- Memoized per-chain client → Task 1 Step 4 (`chainClient` + `clientCache`). ✔
- Security: verified-source only / never throws / read-only RPC / chain-from-trusted-decode / allowlist → Task 1 Step 6 (`!result.ok` → unknown, try/catch, registry gate) + Global Constraints. ✔
- Recursion depth → Task 2. ✔
- Tests (proxy, non-proxy, unverified, RPC failure, memoization, unsupported) → Task 1 Step 2. ✔

**Placeholder scan:** none — every code step has concrete content. Task 2 is explicitly a conditional/manual verification with exact code for the only possible edit.

**Type consistency:** `loadVerifiedViaRpc(chainId, address, client)` and `chainClient(chainId)` consistent across Steps 2/4/6. `verifiedName(address, chainId?)` back-compatible (default app chain) — existing call site `verifiedName(address)` in `loadAbiWith` still valid. `AbiResolution` shape (with `name`/`proxyName`/`isProxy`/`implementation`) matches `types.ts`. `loadVerifiedAbiFrom(chainId, address)` public signature unchanged (callers in `useActionTree` unaffected).
