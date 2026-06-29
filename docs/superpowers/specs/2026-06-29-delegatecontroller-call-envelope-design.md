# DelegateController.Call envelope (shared action-array decoding)

**Date:** 2026-06-29
**Status:** Approved, ready for implementation

## Problem

After cross-chain proxy resolution, proposal #28's `onMessageInvocation` on Taiko
L2 resolves to its verified `DelegateController` implementation (Verified). But
the chain stops there: `onMessageInvocation(bytes _data)` exposes its argument as
opaque `bytes`, and our decoder has no envelope for that format, so per the
safety rule it shows raw rather than guess. The real intent (two `upgradeTo`
calls) stays hidden.

## What the format actually is (from the verified source)

`DelegateController.onMessageInvocation(bytes _data)`:

```solidity
uint64 executionId = uint64(bytes8(_data[:8]));   // first 8 bytes
_executeActions(_data[8:]);                         // rest = abi.encode(Action[])
struct Action { address target; uint256 value; bytes data; }
```

So `_data` = 8-byte `executionId` + `abi.encode((address,uint256,bytes)[])`.
Verified against #28: `executionId = 0`, `Action[]` = two `upgradeTo(address)`
calls (`0x1670…010001 → 0x7e83…E0BA`, `0x1670…0005 → 0x18B2…fE28`).

The `Action` tuple `(address,uint256,bytes)` is identical to what the existing
`osxActionArray` unwrapper already decodes from `execute(bytes)`.

## Goal

Decode `onMessageInvocation`'s `_data` into its `Action[]` and emit each action
as a child call (on the same L2 chain), so #28 drills end-to-end:
`onMessageInvocation (DelegateController) → upgradeTo(0x7e83…)` / `upgradeTo(0x18B2…)`,
each Verified via the existing cross-chain resolver and summarized by the
existing `uupsUpgrade` unwrapper.

## Reuse / modularization (explicit goal)

The `(address,uint256,bytes)[]` decode currently lives inside
`osxActionArray.ts`. Extract it once and share it:

- **New `unwrappers/actionArray.ts`** — `decodeActionTupleArray(blob: Hex):
  RawCall[] | null`: decode `(address,uint256,bytes)[]`, validate every `target`
  is a valid address, return `null` on any failure (size guard, decode throw,
  non-address). No guessing. This is the logic currently embedded in
  `osxActionArray`.
- **Refactor `osxActionArray.ts`** to call `decodeActionTupleArray` — no behavior
  change; its existing tests must still pass unchanged.
- **New `delegateControllerCall.ts`** reuses the same helper.

`decodeActionTupleArray` returns chain-agnostic `RawCall`s (`to`/`value`/`data`,
no `chainId`); each caller decides the child chain (osxActionArray: app chain /
unset; delegateControllerCall: the node's chain).

## Architecture

### `unwrappers/delegateControllerCall.ts`

- **match(node):** all of —
  - `node.functionName === "onMessageInvocation"`,
  - `node.params[0]?.type === "bytes"`,
  - `node.trust === "verified"` (the contract's real ABI confirmed the function),
  - `node.name` ∈ `{ "DelegateController", "DelegateOwner" }` (name allowlist guard),
  - and `extractActions(node) !== null` (the self-validating decode below).
- **extractActions(node):** take `params[0].value` (the `_data` hex); require
  `size >= 8`; strip the first 8 bytes (`executionId`); call
  `decodeActionTupleArray(slice(data, 8))`. Any failure → `null`. (Cache per node
  with a `WeakMap`, mirroring `osxActionArray`, so `match` and `apply` don't
  decode twice.)
- **apply(node):** `children = extractActions(node)!.map(c => ({ ...c, chainId:
  node.chainId }))` so children resolve on the same L2; `summary = "Executes
  ${children.length} action(s)"`. On null (shouldn't happen post-match) → `{
  summary: null, children: [] }`.
- Register in `unwrappers/index.ts` `UNWRAPPERS` (order: after
  `taikoBridgeMessage`, before `osxActionArray` is fine — they don't overlap;
  pick a stable spot and keep `osxActionArray` matching `execute(bytes)` only).

### Security

- Validated hardcoded format: 8-byte prefix + `Action[]`; on any mismatch →
  `null` → raw shown, never a guess.
- Triple-gated: `verified` trust **and** name allowlist **and** successful
  validated decode.
- Children carry the node's already-trusted `chainId` (the L2 the verified
  `onMessageInvocation` runs on) — never a guessed chain.
- Raw bytes always remain visible; fail-silent (decode wrapped/guarded); bounded
  by existing `maxDepth`/`maxNodes`.

### Depth

`execute(0) → sendMessage(1) → onMessageInvocation(2) → upgradeTo(3)` fits within
`MAX_DEPTH = 4`. No change needed.

## Testing

- **`decodeActionTupleArray` (pure):** a valid `(address,uint256,bytes)[]` blob →
  `RawCall[]` with correct `to`/`value`/`data`; a non-address target → `null`; a
  too-short / malformed blob → `null`; empty array → `null` (matches current
  `osxActionArray` behavior — verify against its existing expectations).
- **`osxActionArray` regression:** its existing tests pass unchanged after the
  refactor.
- **`delegateControllerCall` (pure unwrapper):**
  - a verified `onMessageInvocation` node named `DelegateController` whose `_data`
    is `8-byte id + Action[2]` → `match` true, `apply` emits 2 children with the
    node's `chainId` and the right `to`/`data`; summary `Executes 2 action(s)`.
  - `trust !== "verified"` → no match (even with valid data).
  - `node.name` not in the allowlist → no match.
  - `_data` shorter than 8 bytes, or `_data[8:]` not a valid `Action[]` → no
    match / no child.
- **End-to-end (manual, live):** #28 — `onMessageInvocation` expands into two
  `Upgrades proxy → implementation …` children, each Verified ↗ Taiko.

## Out of scope

- Other `onMessageInvocation` payload variants beyond `executionId + Action[]`
  (none known; would be a new validated branch).
- Non-Taiko envelopes.
