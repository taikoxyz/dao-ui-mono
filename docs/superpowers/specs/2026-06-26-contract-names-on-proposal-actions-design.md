# Verified contract names on proposal actions

**Date:** 2026-06-26
**Status:** Approved, ready for implementation

## Problem

Proposal action targets render as truncated hex + explorer link + copy button + a
trust badge (`packages/ui/src/components/proposalActions/actionNode.tsx`). The `on
<contract>` line is just `0x1234…abcd`. There is no human-readable contract name and
no address→name registry anywhere in the app, which makes reviewing a proposal's
actions low on visibility.

The decoder already fetches each target's verified ABI from Etherscan v2 via
whatsabi (`utils/decoding/abiResolver.ts`). That verified-source response also carries
the Solidity contract name (`ContractResult.name` / `EtherscanContractResult.ContractName`),
but we never request it (`loadContractResult` flag unset) and never model it.

## Goal

Show the verified contract name inline before the address:

- Non-proxy: `on  TaikoL1  0x1234…abcd  [copy] [✓ verified]`
- Proxy: `on  ERC1967Proxy → OptimisticTokenVotingPlugin  0x12…ab`

Names appear **only for verified contracts** (`trust === "verified"`). Bytecode-guessed,
signature-db, and unknown targets keep today's hex-only line, so a name is never
presented as an unverified claim.

## Design

### Data layer — `utils/decoding/abiResolver.ts`

- Pass `loadContractResult: true` to the existing `whatsabi.autoload(target, …)` call
  and read `loaded.contractResult?.name` → the **implementation/own name**. This
  piggybacks the request we already make; no extra round-trip for non-proxy targets.
- When `isProxy`, do one extra `EtherscanABILoader.getContractResult(address)` on the
  **proxy address** to obtain the proxy's own name. On failure/empty, fall back
  silently to impl-name-only.
- Extend `AbiResolution` with `name?: string` (impl/own name) and `proxyName?: string`.

### Decode layer — `utils/decoding/types.ts`, `utils/decoding/decodeAction.ts`

- Add `name?: string` and `proxyName?: string` to `DecodedNode`.
- Copy both fields from the `AbiResolution` onto the node, alongside the existing
  `isProxy` / `implementation` assignment.

### Render layer — `components/proposalActions/actionNode.tsx` (+ helpers)

- Add a pure helper `contractLabel(node)` returning the display string:
  `proxyName → name` when both present, else `name`, else `null`. Place it in
  `actionNode.helpers.ts` to match the existing view-model-helper split.
- `AddressLink`, the `on …` line in `LeafItem`, and the `ChildrenTree` group header
  render the label before the truncated hex when present. Name is primary text; hex is
  de-emphasized but still copyable.

## Edge cases

- Verified but no name returned → hex only (current behavior).
- Proxy where only impl is verified → `OptimisticTokenVotingPlugin 0x…` (no arrow).
- Proxy where only proxy is verified → `ERC1967Proxy 0x…`.
- Non-verified trust at any level → hex only, no name.

## Cost / performance

- Non-proxy actions add **zero** requests (name rides the existing autoload).
- Proxy targets add **one** extra Etherscan call (`getContractResult` on the proxy).
- Everything shares the existing `abiQueryKey` react-query cache, so repeated addresses
  across actions do not refetch.

## Testing

Extend the existing decoder coverage tests with:

- Name present vs absent on a verified non-proxy target.
- Proxy with both names → `proxyName → name`.
- Proxy with impl name only → impl name, no arrow.
- Verified-gating: no name surfaces for `bytecode` / `signature-db` / `unknown`.
