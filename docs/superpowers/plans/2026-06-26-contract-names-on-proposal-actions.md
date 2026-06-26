# Verified Contract Names on Proposal Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the verified Solidity contract name inline before each proposal-action address (`on TaikoL1 0x1234…abcd`, and `ERC1967Proxy → OptimisticTokenVotingPlugin` for proxies).

**Architecture:** The name rides on data we already fetch. `whatsabi.autoload` gains `loadContractResult: true`, exposing `contractResult.name` for the (implementation) target with no extra request. For proxies, one extra `EtherscanABILoader.getContract(proxyAddress)` call supplies the proxy's own name. The name flows `AbiResolution → DecodedNode → contractLabel() → render`. Names are populated only from verified sources, so they are never an unverified claim.

**Tech Stack:** TypeScript, React, viem, `@shazow/whatsabi@0.21.1`, vitest.

## Global Constraints

- Package manager is **pnpm**; run tests from `packages/ui` with `pnpm test` (vitest). (Per project memory: invoke vitest via `./node_modules/.bin/vitest run <path>` if pnpm wrapper misbehaves.)
- Names appear **only for verified contracts**. A name is set only when the source ABI loaded from a verified source (`loaded.abiLoadedFrom` truthy / `contractResult.ok === true`). Bytecode-guessed, signature-db, and unknown targets keep today's hex-only line.
- Do not add new dependencies or new ABI loaders. Etherscan v2 via the existing `etherscanLoader()` only.
- `name` / `proxyName` are **optional** fields (`?:`) everywhere so existing object literals (e.g. the inline fallback `AbiResolution` in `decodeAction.ts:46`) keep compiling unchanged.
- whatsabi types (verified against installed `lib.types`): `ContractResult = { abi: any[]; name: string | null; ok: boolean }`; `EtherscanABILoader.getContract(address): Promise<ContractResult>`; `AutoloadResult.contractResult?: ContractResult`; `AutoloadConfig.loadContractResult?: boolean`.

---

### Task 1: Model the name on the decode types and copy it onto the node

**Files:**
- Modify: `packages/ui/src/utils/decoding/types.ts` (add fields to `AbiResolution` and `DecodedNode`)
- Modify: `packages/ui/src/utils/decoding/decodeAction.ts:48-50` (copy fields onto node)
- Test: `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts`

**Interfaces:**
- Consumes: existing `AbiResolution`, `DecodedNode`, `decodeAction(call, ctx)`.
- Produces:
  - `AbiResolution.name?: string` — the target/implementation verified contract name.
  - `AbiResolution.proxyName?: string` — the proxy contract's own verified name (only when `isProxy`).
  - `DecodedNode.name?: string`, `DecodedNode.proxyName?: string` — same values copied onto the decoded node by `decodeAction`.

- [ ] **Step 1: Write the failing test**

Add to `packages/ui/src/utils/decoding/__tests__/decodeAction.test.ts`, inside the existing `describe("decodeAction (one level)", …)` block:

```typescript
  it("copies contract name and proxyName from the resolution onto the node", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction(
      { to: ADDR, value: 0n, data },
      ctx({
        loadAbi: async (): Promise<AbiResolution> => ({
          abi: [transferAbi],
          trust: "verified",
          isProxy: true,
          implementation: ADDR,
          name: "OptimisticTokenVotingPlugin",
          proxyName: "ERC1967Proxy",
        }),
      }),
    );
    expect(node.name).toBe("OptimisticTokenVotingPlugin");
    expect(node.proxyName).toBe("ERC1967Proxy");
  });

  it("leaves name undefined when the resolution has none", async () => {
    const data = encodeFunctionData({ abi: [transferAbi], functionName: "transfer", args: [ADDR, 1n] });
    const node = await decodeAction({ to: ADDR, value: 0n, data }, ctx());
    expect(node.name).toBeUndefined();
    expect(node.proxyName).toBeUndefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/decodeAction.test.ts`
Expected: FAIL — `node.name` is `undefined` for the first test (field not copied), and likely a TS error that `name`/`proxyName` are not on `AbiResolution`.

- [ ] **Step 3: Add the optional fields to the types**

In `packages/ui/src/utils/decoding/types.ts`, extend `DecodedNode` (after `implementation: Address | null;` on line 23):

```typescript
  implementation: Address | null;
  /** Verified contract name of the call target (implementation, for proxies). Verified sources only. */
  name?: string;
  /** Verified name of the proxy contract itself, when the target is a proxy. */
  proxyName?: string;
```

And extend `AbiResolution` (after `implementation: Address | null;` on line 34):

```typescript
  implementation: Address | null;
  /** Verified contract name of the resolved target (implementation, for proxies). */
  name?: string;
  /** Verified name of the proxy contract itself, when `isProxy`. */
  proxyName?: string;
```

- [ ] **Step 4: Copy the fields onto the node in decodeAction**

In `packages/ui/src/utils/decoding/decodeAction.ts`, after line 50 (`node.implementation = resolution.implementation;`):

```typescript
  node.implementation = resolution.implementation;
  node.name = resolution.name;
  node.proxyName = resolution.proxyName;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/utils/decoding/__tests__/decodeAction.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git add src/utils/decoding/types.ts src/utils/decoding/decodeAction.ts src/utils/decoding/__tests__/decodeAction.test.ts
git commit -m "feat(decoding): model verified contract name on decoded nodes"
```

---

### Task 2: `contractLabel` helper + render the name in the action tree

**Files:**
- Modify: `packages/ui/src/components/proposalActions/actionNode.helpers.ts` (add `contractLabel`)
- Create: `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
- Modify: `packages/ui/src/components/proposalActions/actionNode.tsx` (`AddressLink`, `LeafItem` "on …" line, `ChildrenTree` group header)

**Interfaces:**
- Consumes: `DecodedNode.name`, `DecodedNode.proxyName` from Task 1.
- Produces: `contractLabel(node: Pick<DecodedNode, "name" | "proxyName">): string | null` — the display label string, or `null` when no verified name is available.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/proposalActions/__tests__/actionNode.helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { contractLabel } from "../actionNode.helpers";

describe("contractLabel", () => {
  it("returns the name when there is no proxy name", () => {
    expect(contractLabel({ name: "TaikoL1" })).toBe("TaikoL1");
  });

  it("joins proxy and implementation names with an arrow", () => {
    expect(contractLabel({ name: "OptimisticTokenVotingPlugin", proxyName: "ERC1967Proxy" })).toBe(
      "ERC1967Proxy → OptimisticTokenVotingPlugin",
    );
  });

  it("returns the proxy name alone when the implementation name is missing", () => {
    expect(contractLabel({ proxyName: "ERC1967Proxy" })).toBe("ERC1967Proxy");
  });

  it("collapses to a single name when proxy and implementation names are identical", () => {
    expect(contractLabel({ name: "DAO", proxyName: "DAO" })).toBe("DAO");
  });

  it("returns null when no name is available", () => {
    expect(contractLabel({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: FAIL — `contractLabel` is not exported.

- [ ] **Step 3: Implement `contractLabel`**

Append to `packages/ui/src/components/proposalActions/actionNode.helpers.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the label in `AddressLink`**

In `packages/ui/src/components/proposalActions/actionNode.tsx`:

Update the `contractLabel` import on line 8:

```typescript
import { paramDisplay, leadParts, callTag, groupChildren, contractLabel } from "./actionNode.helpers";
```

Replace the `AddressLink` component (lines 15-27) so it can optionally show a label before the hex:

```typescript
export const AddressLink: React.FC<{ address: string; label?: string | null; className?: string }> = ({
  address,
  label,
  className = "",
}) => (
  <span className="inline-flex items-center gap-x-1">
    {label && <span className="font-semibold text-neutral-700">{label}</span>}
    <Link
      href={`${PUB_CHAIN.blockExplorers?.default.url}/address/${address}`}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className={`font-mono text-neutral-500 hover:underline ${className}`}
    >
      {formatHexString(address)}
    </Link>
    <CopyButton value={address} />
  </span>
);
```

- [ ] **Step 6: Pass the label from the `LeafItem` "on …" line**

In `actionNode.tsx`, in `LeafItem`, replace the target line (lines 122-126):

```tsx
        {showTarget && (
          <span className="inline-flex items-center gap-x-1 text-neutral-500">
            on <AddressLink address={node.to} label={contractLabel(node)} />
          </span>
        )}
```

- [ ] **Step 7: Show the label in the `ChildrenTree` group header**

In `actionNode.tsx`, inside `ChildrenTree`, the grouped `<summary>` renders the target hex (lines 163-174). Add the label before the explorer link. Replace the `<span className="ml-auto flex items-center gap-x-2">…</span>` block (lines 163-174) with:

```tsx
              <span className="ml-auto flex items-center gap-x-2">
                {contractLabel(group.items[0].node) && (
                  <span className="font-semibold text-neutral-700">{contractLabel(group.items[0].node)}</span>
                )}
                <Link
                  href={groupExplorer}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-sm text-neutral-500 hover:underline"
                >
                  {formatHexString(group.to)}
                </Link>
                <CopyButton value={group.to} />
                <TrustBadge trust={group.items[0].node.trust} />
              </span>
```

(All grouped items share the same `to`, so the first item's name represents the group.)

- [ ] **Step 8: Verify type-check and the helper test both pass**

Run: `./node_modules/.bin/vitest run src/components/proposalActions/__tests__/actionNode.helpers.test.ts`
Expected: PASS.

Run: `./node_modules/.bin/tsc --noEmit` (from `packages/ui`)
Expected: no new type errors in `actionNode.tsx` / `actionNode.helpers.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/components/proposalActions/actionNode.helpers.ts src/components/proposalActions/actionNode.tsx src/components/proposalActions/__tests__/actionNode.helpers.test.ts
git commit -m "feat(proposalActions): render verified contract names next to addresses"
```

---

### Task 3: Fetch the verified contract name(s) in the resolver

**Files:**
- Modify: `packages/ui/src/utils/decoding/abiResolver.ts` (`loadAbiWith`, add proxy-name helper)

**Interfaces:**
- Consumes: `AbiResolution.name` / `AbiResolution.proxyName` shape from Task 1; existing `etherscanLoader()`, `whatsabi.autoload`.
- Produces: a `loadAbiWith` that populates `name` (from `loaded.contractResult`) and, for proxies, `proxyName` (from a separate `getContract` on the proxy address).

> **Testing note:** `abiResolver.ts` is the IO boundary (live viem client + whatsabi network calls) and has no existing unit test; mocking whatsabi + viem here would be disproportionate and brittle, matching the codebase's current choice not to unit-test it. This task is verified by `tsc --noEmit`, the downstream tests from Tasks 1–2, and manual verification in the running app (real mainnet proposals at http://localhost:3000). Do not add a whatsabi mock test.

- [ ] **Step 1: Add a verified-name helper for an arbitrary address**

In `packages/ui/src/utils/decoding/abiResolver.ts`, after `etherscanLoader()` (line 25), add:

```typescript
/** Verified contract name for an address via Etherscan, or null if unverified/unavailable. */
async function verifiedName(address: Address): Promise<string | null> {
  try {
    const result = await etherscanLoader().getContract(address);
    return result.ok && result.name ? result.name : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Request the contract result in the autoload call and read the impl name**

In `loadAbiWith`, update the `whatsabi.autoload` call (lines 64-69) to add `loadContractResult: true`, and derive the name after computing `trust` (lines 70-74):

```typescript
    const loaded = await whatsabi.autoload(target, {
      provider: publicClient,
      abiLoader: etherscanLoader(),
      followProxies: false,
      enableExperimentalMetadata: true,
      loadContractResult: true,
    });
    const abi = toFunctionItems(loaded.abi as any[]);
    // A loaded ABI source (e.g. Etherscan verified source) means "verified";
    // otherwise whatsabi guessed the selectors from bytecode.
    const trust = loaded.abiLoadedFrom ? "verified" : "bytecode";
    // Name only from a verified source; never surface a guessed name.
    const name = trust === "verified" && loaded.contractResult?.ok ? (loaded.contractResult.name ?? undefined) : undefined;
    // For a proxy, also resolve the proxy contract's own verified name (one extra call).
    const proxyName = isProxy ? ((await verifiedName(address)) ?? undefined) : undefined;
    return { abi, trust, isProxy, implementation, name, proxyName };
```

- [ ] **Step 3: Verify the type-check passes**

Run: `./node_modules/.bin/tsc --noEmit` (from `packages/ui`)
Expected: no new type errors. (`loadContractResult` is a valid `AutoloadConfig` key; `contractResult.name` is `string | null`; `getContract` returns `ContractResult`.)

- [ ] **Step 4: Run the full decoding test suite**

Run: `./node_modules/.bin/vitest run src/utils/decoding`
Expected: PASS (no regressions).

- [ ] **Step 5: Manual verification in the running app**

With the dev server running (http://localhost:3000, mainnet config), open a community proposal that has actions. Confirm:
- A verified target shows its name before the hex (e.g. a known plugin/DAO contract).
- A proxy target shows `Proxy → Impl` (or just the impl name if the proxy is unverified).
- An unverified / bytecode-only target shows hex only (no name).

- [ ] **Step 6: Commit**

```bash
git add src/utils/decoding/abiResolver.ts
git commit -m "feat(decoding): resolve verified contract names from Etherscan"
```

---

## Self-Review

**Spec coverage:**
- Data layer (`loadContractResult`, proxy `getContract`, `AbiResolution.name`/`proxyName`) → Task 3 + Task 1. ✔
- Decode layer (`DecodedNode` fields, copy in `decodeAction`) → Task 1. ✔
- Render layer (`contractLabel`, `AddressLink`, `on …`, group header) → Task 2. ✔
- Verified-only gating → Task 3 Step 2 (name set only when `trust === "verified"`); spec edge cases covered by `contractLabel` tests in Task 2. ✔
- Proxy both-names / impl-only / proxy-only / neither → `contractLabel` tests, Task 2 Step 1. ✔
- Cost (zero extra calls for non-proxy, one for proxy) → Task 3 Step 2 (`proxyName` guarded by `isProxy`). ✔
- Tests for name present/absent, proxy variants, verified-gating → Tasks 1 & 2. ✔

**Placeholder scan:** none — every code step has concrete content.

**Type consistency:** `contractLabel(node: Pick<DecodedNode, "name" | "proxyName">)` used consistently in Tasks 2; `AbiResolution`/`DecodedNode` field names (`name`, `proxyName`) consistent across Tasks 1–3; `verifiedName` returns `string | null`, coerced to `?? undefined` to match optional `string` fields.
