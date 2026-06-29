# Proposal action display redesign (F1)

**Date:** 2026-06-29
**Status:** Approved (design iterated via mockups), ready for implementation

**Visual reference (open in a browser):**
- `docs/superpowers/specs/assets/2026-06-29-action-display-mockup-prop28.html` (deep cross-chain case)
- `docs/superpowers/specs/assets/2026-06-29-action-display-mockup-prop29.html` (minimal single-action case)

These mockups are the source of truth for layout and content. Match them.

## Problem

The current action view (`actionNode.tsx` + `proposalActions.tsx` `ActionItem`) renders a deeply nested card-in-card tree. It's hard to scan, the cross-chain nesting is heavy, the per-action category icon implies a classification we can't reliably make, and inputs are cramped. We're replacing the rendering with a cleaner "F1" design.

This is a **view-layer rewrite** plus a **small decode-layer enrichment** for parameter types. The decoder itself (decodeAction, unwrappers, resolver) is unchanged. The only external consumer is `ProposalActions` (used by 5 plugin pages); its public props are unchanged.

## The F1 design (what to build)

Each action is a numbered accordion row; clicking expands a full-width Inputs panel beneath it.

**Collapsed row** (grid: number · body · badges):
- **Number** on the left: `1`, `2`, `3`, and `3.1` / `3.2` for nested (bridged) children. Replaces the old category icon — execution order is explicit; no per-action classification. Child numbers tint with the child's chain lane color.
- **Body, three lines:**
  1. **Title** — the friendly summary when the decoder recognized a pattern (`leadParts`/`displaySummary`, e.g. "Upgrade SignalService → 0xBC44…", "Bridge message → Taiko (2 actions)"); otherwise the humanized function name (`decodeCamelCase(functionName)`), or "Unrecognized call" when nothing decoded.
  2. **Meta** — `on <ContractLabel> <0xshort> <fnTag>`, where ContractLabel is `contractLabel(node)` (Proxy → Impl / name / null→hide), address is `formatHexString(node.to)`, fnTag is the raw function name.
  3. **Inputs** — a pink "▸ Inputs" toggle line (the row's disclosure affordance).
- **Right:** `TrustBadge(node.trust)` + chain badge (`chainLabel(node.chainId)`, shown only when ≠ app chain).
- A short batch header above the list: "Executes a batch of N via <ContractLabel> <0xshort>" (the top-level wrapper context).

**Expanded Inputs panel** (full width, beneath the row, indented under the body — NOT to the right):
- **Signature line:** friendly form by default — `fnName(<NamedType> <paramName>, …)` using each param's `internalType` struct name when present (e.g. `sendMessage(IBridge.Message message)`); a "▸ full signature" toggle reveals the full canonical signature, which **wraps** (never overflows).
- **Params:** a key→value grid. Key = param **name** + its Solidity **type** as an inline chip to the right (`destChainId  uint64`). Value = decoded value; `address`-typed values are explorer links; a `bytes` field that became children shows "↓ decoded as actions N.x below" instead of the bytes.
- **No-arg functions:** "No input parameters."
- **Raw calldata:** a nested `▸ Raw calldata` disclosure (always available, one level deeper).
- **Embedded calls** (`node.embeddedCalls`): keep the existing Unverified annotation, rendered in this panel.

**Honest degradation (unchanged trust model):**
- Friendly title/summary only for recognized patterns; plain function name otherwise.
- Unverified contract → no name (address only), `TrustBadge` shows the unverified state.
- `signature-db` decoded params are shown but the panel is visually flagged (amber) with a "decoded from an unverified signature — verify against raw" note; param names may be `arg0/arg1`.
- Unknown selector / undecodable → no invented params; show "Could not decode — raw calldata only" + raw bytes (the existing `EncodedView` fallback path).

**Nesting:** children render in an indented lane (left border), each its own numbered accordion row, recursively. No cards-in-cards.

## Decode-layer enrichment (required for typed params)

`DecodedParam` today is `{ name, type, value, formatted? }` and `decodeAction` builds it as a flat `name/type/value` map (no `internalType`, no tuple component types). The design needs:
- **`internalType?: string`** on `DecodedParam` — for the friendly struct name in the signature.
- **`components?: DecodedParam[]`** on `DecodedParam` — recursively decoded sub-params for `tuple` types, so struct fields render with names + types + values.

`decodeAction` builds these from the ABI fragment's `inputs` (which carry `components` and `internalType`) paired with the decoded `args`, recursively for tuples. Top-level `params[i].type`/`name`/`value` stay as-is (so `leadParts`, unwrappers, and existing tests are unaffected). This is additive; `components`/`internalType` are optional. The recursion is bounded by the ABI shape (no network, no unbounded loops). On any mismatch, fall back to the flat param (no crash).

## Cleanup mandate (explicit user requirement)

Leave **no dead code** from the old rendering or earlier iterations:
- Remove rendering components/helpers that the new view no longer uses (e.g. old `ParamRow`, `CallDetails`, `LeafItem`, `ChildrenTree`, `AddressLink`, and any helper that becomes unused such as `callTag`, `groupChildren`, `paramDisplay`, `Lead`/`GroupItem`/`ChildGroup` types — verify each with a usage grep before deleting).
- Keep helpers the new view still uses (`leadParts`, `contractLabel`, `chainLabel`, `displaySummary`, `shortHex`, `formatHexString`, `TrustBadge`, `EncodedView`, `CopyButton`).
- Do not remove `callParamField.tsx` (used by `calldata-form.tsx`, unrelated).
- After the rewrite, run a dead-export check: every exported symbol in `proposalActions/` must have a consumer (or be the public `ProposalActions`). No unused imports (eslint `--max-warnings=0`).

## Out of scope
- Decoder logic, unwrappers, cross-chain resolver (unchanged).
- The `ProposalActions` public props / the 5 plugin call sites (unchanged).
- Mobile-specific layout beyond "it wraps and stays readable" (the grid already wraps).

## Testing
- Unit-test the decode-layer enrichment: a tuple param yields `components` with correct names/types/values; `internalType` captured; a flat param is unaffected; malformed → graceful flat fallback.
- Keep/extend the pure-helper tests (`contractLabel`, `chainLabel`, and any new pure view-model helper such as action numbering).
- Manual (controller): #28 (deep cross-chain) and #29 (single action) render matching the mockups; expand/collapse + raw calldata work; unverified/unknown actions degrade honestly.
