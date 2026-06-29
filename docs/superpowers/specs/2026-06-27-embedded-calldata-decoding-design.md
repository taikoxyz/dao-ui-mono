# Embedded & cross-chain calldata decoding (B+)

**Date:** 2026-06-27
**Status:** Draft for review

## Problem

Proposal actions frequently carry **calldata inside calldata**. The motivating
case (community proposal #28, action 3) is a Taiko bridge message:

```
sendMessage(message)                      on MainnetBridge   (L1, verified today)
  message.destChainId = 167000 (Taiko L2)
  message.to          = 0x4EBe…19CA
  message.data = onMessageInvocation(bytes)         (executes on L2)
      inner bytes = abi.encode(IBridge.Message)     (a struct, not selector-prefixed)
          Message.data = upgradeTo(0x7e83…)          (the real intent, on L2)
```

Today the decoder shows `message.data` as a giant hex wall. A reviewer cannot
see that this action ultimately performs a contract **upgrade on L2** without
manually decoding several nested layers by hand.

## Goal

Recursively reveal the embedded calls so a reviewer sees the chain of intent —
`sendMessage → onMessageInvocation → upgradeTo(0x7e83…)` — with each layer
showing its target, chain, function, and (where safe) decoded arguments.

## Security model (governs the entire feature)

Argument **values** are rendered as decoded data **only** when their types come
from a trusted source. This is the hard rule; everything else follows from it.

1. **Verified contract ABI on the correct chain** (Etherscan v2 verified source,
   queried with the chain id where the call actually executes) → values shown,
   trust = `verified`.
2. **A hardcoded, code-reviewed struct type in our own code** (only where a
   verified ABI exposes a field as opaque `bytes` that we know is a specific
   struct, e.g. `onMessageInvocation`'s arg = `IBridge.Message`) → values shown,
   trust = `verified`, **only after the decode validates** (re-encode round-trips,
   or field sanity checks pass); any mismatch → fall back to raw.
3. **4-byte signature database** → **name only, marked Unverified.** Show the
   selector (a literal slice of the bytes — always a fact) and the candidate
   signature; **never** decode/assert its argument values.

**Cross-chain trust rule:** an embedded call's ABI is resolved from the chain id
that comes **only from a trusted decode** (a verified ABI field or a validated
hardcoded struct — never from a guess). We never resolve an embedded call's ABI
from the wrong chain, because the same address is a different contract on
different chains (a confident, wrong decode is the primary thing this feature
must prevent).

**Always-true invariants:**
- The raw bytes are never hidden — they remain in the param view and "Raw
  calldata," so a reviewer can always verify by hand.
- Recursion is bounded: max depth, max total nodes, max embedded-lookups per
  action (reuse the existing `maxDepth` / `maxNodes` guards in `decodeAction`).
- Fail-silent: any decode/resolution error degrades to the raw view and never
  breaks the action render or blocks proposal/voting info.
- Decoded text is rendered through React (escaped), never as HTML.

## Why this is feasible

- The recursion machinery already exists: `decodeAction` decodes a node, and
  unwrappers (`osxActionArray`, `uupsUpgrade`, …) emit child `RawCall`s that
  `decodeAction` recurses into with depth/breadth guards. We extend this, not
  replace it.
- Etherscan v2 — the same API and key the resolver already uses — supports Taiko
  at `https://api.etherscan.io/v2/api?chainid=167000` (verified via its
  chainlist). So cross-chain *verified* resolution is "same code, different
  chain id," not a new integration.
- Once a layer's ABI is resolved from its own chain's verified source, that ABI
  carries the struct component types, so most layers need no hardcoded types.
  The only hardcoded type required for the motivating case is the
  `onMessageInvocation` → `IBridge.Message` step (where the verified ABI exposes
  the arg as bare `bytes`).

## Architecture

Four pieces, smallest-surface-first.

### 1. Thread a chain id through decoding

- `RawCall` gains an optional `chainId?: number` (default = the app's
  `PUB_CHAIN.id`). Child calls emitted by envelope unwrappers carry the chain id
  where they execute.
- `DecodeCtx.loadAbi` becomes chain-aware: `loadAbi(address, chainId)`. The
  abi/token query keys already include a chain id (`abiQueryKey`) — they get the
  call's chain id instead of always the current one.
- `DecodedNode` gains `chainId: number` so the UI can badge the executing chain.

### 2. Multi-chain verified resolver

- `loadAbiWith` becomes `loadAbiWith(chainId, address)`. For the current chain it
  behaves exactly as today (full whatsabi autoload + proxy RPC reads). For a
  **different** chain, it resolves the **verified ABI + name via Etherscan v2
  `getContract` with that chain id** (HTTP only — no new RPC provider needed).
  - Cross-chain proxy resolution (EIP-1967 slot reads) needs an RPC for that
    chain, which we do not add now. If the verified source is itself a proxy
    whose implementation isn't returned by Etherscan, that inner call degrades to
    "verified proxy, implementation not resolved" rather than guessing. Documented
    limitation, safe by construction.
- A small `CHAIN_ABI_SOURCES` map: `chainId → { etherscan v2 supported: bool }`.
  Unknown/unsupported chain → no verified resolution → name-only/raw.

### 3. Envelope unwrappers (protocol-specific, extend existing pattern)

New unwrappers in `utils/decoding/unwrappers/`, registered like the others:

- **`taikoBridgeMessage`** — matches the Taiko bridge `sendMessage((…))` (and the
  `onMessageInvocation(bytes)` relay). Reads the already-decoded `Message` struct
  fields (`destChainId`, `to`, `value`, `data`) — from the **verified bridge
  ABI** — and emits a child `RawCall { chainId: destChainId, to, value, data }`.
  For `onMessageInvocation(bytes)`, decode the bytes arg as `IBridge.Message`
  (hardcoded, code-reviewed type) **with validation**, then emit the same child.
  Summary: `Bridge message to <chain>: <inner summary>`.

This is the single envelope needed for the motivating proposal. Other message
formats become additional small unwrappers, one per format, added only when a
real proposal needs them (logged as a known gap, not silently unsupported).

### 4. Generic embedded-calldata labeler (Unverified fallback)

For any decoded `bytes` value (walking into tuples/arrays) that is **not** turned
into a child by an envelope unwrapper, but whose head is a selector resolvable in
the signature DB: annotate it with the selector (fact) + candidate signature
(Unverified). This is "identify, never decode args" — the safe floor for formats
we don't have an envelope for. Stored as `DecodedNode.embeddedCalls?:
{ path, selector, signature|null }[]` and rendered as an annotation. No target,
no chain, no arg values.

## Data flow (motivating example)

```
decodeAction(sendMessage call, chainId=1)
  → verified ABI (MainnetBridge, L1) decodes the Message struct
  → taikoBridgeMessage unwrapper emits child { chainId:167000, to:0x4EBe…, data:onMessageInvocation(…) }
    → decodeAction(child, chainId=167000)
        → verified ABI from Taiko Etherscan v2 (chainid=167000) → onMessageInvocation(bytes)
        → taikoBridgeMessage decodes bytes as IBridge.Message (validated) → child { chainId:…, to:…, data:upgradeTo(…) }
          → decodeAction(child) → verified ABI on that chain → upgradeTo(address) ✓ Verified, arg 0x7e83… shown
```

Every value shown is from a verified source or a validated hardcoded struct; the
chain id at each hop comes from a trusted decode of the enclosing message.

## UI

- Nested calls already render as the children tree (`ChildrenTree` / `LeafItem`).
  Each layer shows its function, target (with the verified contract name from the
  earlier feature), and `TrustBadge`.
- Add a **chain badge** when a child's `chainId` differs from the app chain, e.g.
  `↗ Taiko L2 (167000)`, so it's unmistakable that this executes on another chain.
- The generic labeler's `embeddedCalls` render as an "Encoded call (Unverified)"
  annotation under the param, with selector + candidate signature; raw bytes stay
  visible.

## Testing

- **Resolver (multi-chain):** unit-test that `loadAbiWith` builds the Etherscan v2
  URL with the passed chain id; that an unsupported chain yields no verified name;
  that cross-chain proxy-not-resolved degrades safely. (Network mocked.)
- **`taikoBridgeMessage` unwrapper (pure):** given a decoded `sendMessage` node,
  emits a child with the correct `chainId`/`to`/`value`/`data`; given
  `onMessageInvocation(bytes)`, decodes+validates the inner `IBridge.Message` and
  emits the child; malformed inner bytes → no child, falls back to raw.
- **Chain-id threading:** `decodeAction` passes the child's `chainId` to
  `loadAbi`; a child with no `chainId` defaults to the app chain.
- **Generic labeler (pure):** finds selector-prefixed bytes in nested
  tuples/arrays; marks Unverified; ignores non-selector/too-short bytes; never
  emits arg values.
- **Security regressions:** a signature-DB-only function never shows arg values;
  an embedded call is never resolved against the app chain when its trusted
  `destChainId` differs; decode failure anywhere → raw fallback, action still
  renders.
- **End-to-end (manual, live):** proposal #28 action 3 shows the
  `sendMessage → onMessageInvocation → upgradeTo` chain with correct chain badges
  and verified leaf args.

## Phasing (suggested build order)

1. Chain-id threading + multi-chain verified resolver (no behavior change yet for
   single-chain actions; foundation).
2. `taikoBridgeMessage` envelope unwrapper + chain badge UI → delivers the
   motivating example end-to-end.
3. Generic embedded-calldata labeler (Unverified fallback) for everything else.

Each phase is independently shippable and testable.

## Out of scope (now)

- Cross-chain **proxy implementation** resolution (needs per-chain RPC).
- Envelope decoders for non-Taiko-bridge message formats (add per real need).
- Decoding arguments from the 4-byte DB (explicitly excluded by the security
  model).
