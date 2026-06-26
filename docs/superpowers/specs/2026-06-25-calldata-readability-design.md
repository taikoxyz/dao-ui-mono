# Proposal Calldata Readability — Design Spec

**Date:** 2026-06-25
**Branch:** `fix/readiness-on-txs`
**Status:** Design approved; pending written-spec review
**Scope of this iteration:** Recursive **static** decoding of proposal actions. Security flags and on-chain simulation are explicitly deferred to later iterations, but the data model is shaped so they slot in without rework.

## 1. Problem

On a proposal detail page (e.g. community proposal #33), the "Actions" panel decodes only the **outer** function call. When an action is a wrapper like `execute(bytes)`, the inner payload is rendered as a raw hex blob — unreadable to reviewers. A reviewer cannot tell, without manual ABI work, *which function on which contract* the proposal will ultimately call.

**Concrete example — proposal #33, Action 1** (all on Ethereum L1 mainnet):
- Target `0x75Ba…CD0a` (a proxy → impl `0x4347df63…`), function `execute(bytes)`.
- The `bytes` payload ABI-decodes to an OSx `Action[]` = `(address,uint256,bytes)[]` with one element:
  - → `0x6f21…ef1f` (a proxy → impl `0x349ae357…`), calldata `upgradeTo(0x349ae357…0098)`.
- Plain English: **"Upgrade proxy `0x6f21…ef1f` to a new implementation `0x349ae357…`."**

Today the UI shows `execute(bytes)` + a hex dump. The goal is the plain-English tree.

## 2. Goals / Non-Goals

**Goals**
- Recursively decode nested actions into a readable tree: contract → function → named, formatted args.
- Plain-English one-line **summary** per recognized pattern (null when unrecognized — never guessed).
- **Hybrid trust model** with explicit per-node confidence badges.
- Fast to load (caching, dedup, bounded concurrency).
- Never regress: any node that cannot be decoded falls back to today's raw view.

**Non-Goals (this iteration)**
- Security/risk flags (e.g. "this is an upgrade — review carefully"). Deferred; the node tree is the substrate for it.
- On-chain simulation / execution trace (Tenderly, `eth_simulateV1`). Deferred.
- ERC-7730 integration. Deferred to iteration 2; the data model is intentionally 7730-shaped (`summary` ≈ intent, `params[].formatted` ≈ field formats) so a descriptor layer populates the same fields.

## 3. Validation (spike, 2026-06-25)

A throwaway spike ran the planned decode logic against **all 28 community proposals that have actions** (101 nodes total). Results:

- `osx-action-array` unwrapped **100%** of `execute(bytes)` actions into sub-actions, including #33 producing the exact expected upgrade tree + summary.
- Patterns hit: `osx-action-array` ×14, `uups-upgrade` ×8, `erc20-transfer` ×2, `ownership` ×2, native transfer ×1.
- Trust: 91 verified, 9 bytecode, 0 unknown — every node resolved at least an ABI tier.
- **Key finding:** 61 nodes failed to resolve a function *name* despite a "verified" ABI, because the targets are **proxies** (`0x75Ba…`, `0x6f21…` are codesize-170) and Etherscan `getabi` returns the **proxy** ABI, not the implementation ABI. Confirmed: resolving EIP-1967 impl (`0x75Ba…` → `0x4347df63…`, verified) exposes `execute`, `pause`, `acceptOwnership`, `transferOwnership`, etc.

**Design consequences folded in below:**
1. Proxy-aware ABI resolution is **mandatory and load-bearing** in the recursive loader (§6).
2. The signature-DB fallback is necessary for genuinely-unverified leftover selectors (e.g. `0x3a343014`, `0x1bdb0037`).
3. Many proposals are long runs of identical calls (`setProgramTrusted`/`setImageIdTrusted`); the UI should group consecutive identical sub-actions (§8).

## 4. Approach (chosen)

**Pattern-registry over a one-level ABI decoder.** A generic decoder accurately decodes *one* call (reusing the existing `useAbi` proxy + ABI logic). A small registry of **unwrappers** then decides where it is *safe* to recurse and emits a summary. Rejected alternatives: a fully generic heuristic recursor (mis-fires on arbitrary bytes; untrustworthy summaries) and outsourcing to a decode/trace service (external dependency + latency; trace = simulation, which is deferred).

Rationale: accurate one-level decode for everything; recursion only into wrappers we understand; summaries fall out per pattern; the future security layer is just another pass over the same node tree; each new pattern is one isolated file that never touches the engine or UI.

## 5. Core data model

New code under `src/utils/decoding/`. Pure and unit-testable; hooks/components stay thin.

```ts
// src/utils/decoding/types.ts
type TrustLevel = "verified" | "bytecode" | "signature-db" | "unknown";

type DecodedNode = {
  to: Address;
  value: bigint;
  data: Hex;

  // one-level decode
  selector: Hex | null;
  functionName: string | null;   // "upgradeTo"
  signature: string | null;      // "upgradeTo(address)"
  params: DecodedParam[];
  trust: TrustLevel;             // drives the badge
  isProxy?: boolean;
  implementation?: Address;      // resolved impl, when proxy

  // interpretation (our catalog now; ERC-7730 intent later)
  summary: string | null;        // null = unrecognized; NEVER guessed

  // recursion
  children: DecodedNode[];
  error?: string;                // decode failed → UI shows raw EncodedView for this node
  truncated?: "depth" | "cycle"; // recursion stopped here
};

type DecodedParam = {
  name: string;
  type: string;
  value: EvmValue;
  formatted?: string;            // "1,000 USDC", checksummed addr, ISO date
  node?: DecodedNode;            // set when this param IS a nested call
};
```

`summaryPattern` was intentionally removed (YAGNI); it is reintroduced only when the security layer needs a stable machine tag. The unwrapper already carries an internal `id`.

## 6. Modules

| Unit | File | Responsibility |
|---|---|---|
| ABI resolver | `src/utils/decoding/abiResolver.ts` | `loadAbi(address) → { abi, trust, isProxy, implementation }`. **Resolves EIP-1967 (and existing proxy patterns) → implementation FIRST**, then: Etherscan verified (`verified`) → whatsabi bytecode (`bytecode`) → signature-DB fragment (`signature-db`) → none (`unknown`). Reuses the proxy-resolution + Etherscan/whatsabi logic already in `src/hooks/useAbi.ts` (refactor the network/proxy core out of the hook into this plain async function so it is callable recursively; `useAbi` becomes a thin wrapper). |
| Signature DB | `src/utils/decoding/signatureLookup.ts` | openchain.xyz (4byte mirror) selector → candidate signatures; build a minimal ABI fragment via `parseAbiItem`. Cached. |
| Decoder | `src/utils/decoding/decodeAction.ts` | `async decodeAction(action, ctx) → DecodedNode`: native-transfer short-circuit → `loadAbi` → one-level `decodeFunctionData` → run unwrappers → bounded recursion (depth cap 4 + visited-set cycle guard in `ctx`). Per-node `try/catch`: any failure sets `error` and returns a raw node. |
| Unwrappers | `src/utils/decoding/unwrappers/*.ts` | registry; each `{ id, match(node), expand(node) → childActions, summarize(node) → string }`. |
| Hook | `src/hooks/useActionTree.ts` | wraps `decodeAction` in react-query (keyed `["actionTree", chainId, to, dataHash]`); pulls ABIs via `queryClient.fetchQuery(["abi", chainId, address])` so nested targets are cached/deduped and the existing tanstack persistence applies. |
| Component | `src/components/proposalActions/ActionNode.tsx` | recursive render: header (addr link + signature + `TrustBadge`), summary line, param fields, indented children; `error`/`unknown` → existing `EncodedView`. Reuses `callParamField` + `encodedView`. |
| Badge | `src/components/proposalActions/TrustBadge.tsx` | maps `TrustLevel` → label/icon. |

`decodeAction` is a plain async function (not a hook) so it can recurse; sibling children resolve via `Promise.all`.

## 7. Initial unwrapper set

| id | matches | expands → | summary |
|---|---|---|---|
| `osx-action-array` | a `bytes` param (or `execute(bytes)` payload) that cleanly ABI-decodes as `(address,uint256,bytes)[]` **and** every `to` is a well-formed address (top-12-bytes zero) **and** offsets in-bounds | each tuple → child | "Executes N sub-action(s)" |
| `uups-upgrade` | `upgradeTo(address)` (`0x3659cfe6`) / `upgradeToAndCall(address,bytes)` (`0x4f1ef286`) | the `andCall` bytes → `param.node` | "Upgrades proxy {to} → impl {newImpl}" |
| `multicall3` | `aggregate(...)` / `aggregate3(...)` | each call → child | "Batches N call(s)" |
| `erc20` | `transfer`/`transferFrom`/`approve` | — | amount formatted with token decimals+symbol |
| `access-control` | `transferOwnership`/`acceptOwnership`/`grantRole`/`revokeRole` | — | "Transfers ownership to …" / "Grants/Revokes {role} …" |

Unwrappers are selector-driven, so they summarize even when the ABI is missing; `osx-action-array`'s detector is **conservative** (clean decode + valid addresses + in-bounds offsets) so a random blob is never mistaken for actions — ambiguous bytes render as a raw `bytes` param instead.

## 8. Trust, errors, performance, UX

**Trust badges** (per node, driven by `trust`):
- `verified` → ✓ "Verified" · `bytecode` → ◐ "Decoded from bytecode" · `signature-db` → ⚠ "Unverified signature" (keep raw bytes visible) · `unknown` → ⚠ "Could not decode" → raw `EncodedView`.
- A node header reflects the **lowest** trust among itself + descendants ("contains unverified calls"), so a verified parent wrapping a sig-db child does not look fully trustworthy.

**Error isolation:** decode is per-node and defensive; any failure (bad ABI, malformed bytes, network error, depth/cycle cap) sets `error`/`truncated` on *that node only* and renders the raw fallback there. One bad sub-action never blanks the proposal.

**Performance:** ABI fetches via react-query keyed `["abi", chainId, address]` (already persisted in-app) → dedup + warm repeat views. Decoded tree memoized. Siblings resolve concurrently; depth cap 4 bounds worst case. Signature-DB lookups cached.

**UX grouping:** consecutive identical sub-actions (same `to` + same selector) are collapsed into "N× `setProgramTrusted(…)`" with expand-to-list, to keep long attestation batches readable.

## 9. Testing

`packages/ui` has no test runner today. Add **Vitest** scoped to `src/utils/decoding/**` plus a `test` script in `packages/ui/package.json`.

- Pure decode-in → node-out, no network. Each unwrapper gets fixtures, including **#33's real calldata** asserting the full upgrade tree + summary, plus a multi-sub-action proposal (e.g. #27/#31) and a `uups-upgrade` leaf.
- Edge cases: random bytes **not** mistaken for an action array; depth cap; cycle guard; malformed data → `error`; proxy resolution path (impl ABI used, not proxy ABI).
- ABI/signature network layer mocked; on-chain reads are not exercised in unit tests.

## 10. Out of scope / future iterations

1. **ERC-7730 enrichment** — fetch/author descriptors (EF registry + Sourcify TS SDK) to replace the hand-written summary catalog with standard JSON + formatted fields + attestation trust signal. No contract changes required.
2. **Security flags** — a pass over the node tree tagging sensitive operations (upgrades, ownership/admin changes, unlimited approvals, calls to unverified contracts).
3. **Simulation/trace** — actual execution call-tree and state/balance changes.

---

## Revision A (2026-06-26) — grouping & per-call inspectability

User review of the rendered tree changed the child-grouping requirement (the original "group consecutive by to+selector, show first only" was found to *hide distinct arguments* — e.g. proposal #31's 12 `setProgramTrusted` calls each carry a different program hash). Revised design:

1. **Grouping is a fold, never a data loss.** Consecutive children sharing the same `to` + selector render under an expandable group header (`{functionName} — N calls` + target link + trust badge). Inside, **every call is rendered individually and stays fully inspectable** — its own decoded args, contract link, and raw calldata. A group of size 1 renders as a normal inline node (no group chrome).
2. **Byte-identical folding only.** Within a group, a run of calls with identical `data` (selector + all args identical) collapses to a single item badged `×K identical` — the only case where folding hides nothing real.
3. **Per-call raw calldata.** Every decoded call (grouped or not) exposes its exact `data` bytes via a collapsible "raw" view, so a reviewer can verify byte-for-byte against chain. (Undecoded/error nodes keep the existing `EncodedView` fallback.)
4. **Per-arg address links.** A decoded param whose `type === "address"` renders as a block-explorer address link; non-address args (e.g. `bytes32` hashes) stay as copyable text.
5. **Execution-transaction link (new Task 12).** When a proposal has been executed, surface a proposal-level "View execution transaction ↗" link to the on-chain tx that ran all actions. Requires plumbing `executionTxHash` (available in the subgraph `proposalMixin`, not currently fetched) into `ProposalActions` via a new optional prop; pages without it simply omit the link.

Tasks: Task 10 (revised) covers items 1–4 (self-contained in `proposalActions/` components, no new props). Task 12 covers item 5 (gql + proposal-page plumbing).
