# Cross-chain proxy resolution + verified L2 ABIs

**Date:** 2026-06-29
**Status:** Approved, ready for implementation

## Problem

The embedded/cross-chain decoder (B+) routes an embedded call to the chain it
executes on and resolves its ABI from that chain's verified source via Etherscan
v2. But that cross-chain resolver (`loadVerifiedAbiFrom`) is **HTTP-only**: it
calls Etherscan `getContract(address)` and does not read the proxy's
implementation slot.

Most Taiko L2 targets are `ERC1967Proxy` contracts. Etherscan returns the
**proxy's** verified ABI (which lacks the real functions), so the decoder falls
back to the 4-byte signature DB → the layer renders **"Unverified signature"**
and cannot decode its real argument types. Concretely, proposal #28's
`onMessageInvocation` on L2 (`0xfA06…8C7C`, an `ERC1967Proxy`) stops there.

The app chain already does this correctly (`loadAbiWith` → `getImplementation`
slot read → ABI of the implementation). We want the same for supported L2s.

## Goal

When a decoded call executes on a supported chain (Taiko mainnet, 167000),
resolve it proxy-aware — read the EIP-1967 implementation slot over that chain's
RPC, then fetch the **implementation's** verified ABI + name from that chain's
verified source — so L2 layers decode from a real verified ABI (`Verified`,
correct argument types) instead of the 4-byte DB.

## Security model (unchanged, extended)

- The L2 RPC is used **only for read-only** `getStorageAt` / `getImplementation`
  slot reads — the same trust already placed in the app-chain RPC.
- The contract ABI still comes from an **independent verified source**
  (Taikoscan via Etherscan v2 `chainid=167000`), never from the RPC. A lying RPC
  could only point us at a different impl address, whose ABI we'd still fetch
  from the verified source; documented as the same risk class as the app RPC.
- Resolution still happens **only on the chain id from a trusted decode** (the
  bridge's validated `destChainId`). The chain registry is an explicit allowlist:
  a chain not in it gets no RPC and no verified resolution (returns `unknown`).
- Verified-source-only: an unverified implementation yields an `unknown`
  resolution (no name, empty abi) — never a guess. The resolver never throws.
- Per-chain react-query cache and the existing `maxDepth` / `maxNodes` recursion
  bounds still apply.

## Architecture

### 1. Chain registry + RPC constant

- `constants.ts`: `PUB_TAIKO_RPC = process.env.NEXT_PUBLIC_TAIKO_RPC ||
  "https://rpc.mainnet.taiko.xyz"`.
- `abiResolver.ts`: a registry keyed by chain id for chains we resolve
  proxy-aware:
  ```
  CHAIN_RESOLVERS: Record<number, { chain: Chain; rpcUrl: string }>
    = { 167000: { chain: taiko /* from viem/chains */, rpcUrl: PUB_TAIKO_RPC } }
  ```
- `isVerifiedAbiChainSupported(chainId)` becomes `chainId in CHAIN_RESOLVERS`
  (plus the app chain, which is handled by the app-chain path). Routing in
  `useActionTree` is unchanged in shape (already gates on this predicate).

### 2. Proxy-aware cross-chain resolver

Upgrade `loadVerifiedAbiFrom(chainId, address)`:

1. Look up `CHAIN_RESOLVERS[chainId]`; if absent → `unknown` (current behavior).
2. Lazily build a viem client: `createPublicClient({ chain, transport:
   http(rpcUrl) })` (memoized per chain id so we don't recreate per call).
3. `resolveImplementation(client, address)` (reuse the existing helper) → impl or
   null; `target = impl ?? address`; `isProxy = !!impl`.
4. `getContract(target)` via `etherscanLoader(chainId)` → if `ok`, return
   `{ abi: toFunctionItems(abi), trust: "verified", isProxy, implementation: impl,
   name: result.name || undefined, proxyName }`; else `unknown` (with
   `isProxy`/`implementation` preserved).
5. `proxyName` (when `isProxy`): `getContract(address)` (the proxy) for its own
   verified name, mirroring the app-chain `verifiedName`.
6. Wrap everything so it never throws (RPC failure, unverified, etc. → `unknown`
   or impl-less degrade), matching today's contract.

This mirrors `loadAbiWith` but verified-source-only (no whatsabi bytecode
fallback) and chain-parameterized. Shared slot-read logic stays in
`utils/proxies.ts` (`getImplementation`).

### 3. Recursion depth

The bridge chain (`execute → sendMessage → onMessageInvocation → … →
upgradeTo`) may exceed the current `MAX_DEPTH = 4` in `useActionTree`. During
implementation, verify the depth actually needed on proposal #28 and raise
`MAX_DEPTH` only if the innermost verified call is being truncated — breadth
stays bounded by `maxNodes`. If 4 is enough, leave it.

## Data flow (proposal #28, after this change)

```
… → onMessageInvocation child { chainId: 167000, to: 0xfA06…(proxy) }
  → loadVerifiedAbiFrom(167000, 0xfA06…)
      → taiko client.getStorageAt(EIP-1967 slot) → implementation 0x…
      → Etherscan v2 getContract(impl, chainid=167000) → verified ABI + name
  → onMessageInvocation now decodes from the verified impl ABI (Verified)
  → its real argument types are known → inner call(s) decode/recurse correctly
```

## Testing

- **Registry / predicate:** `isVerifiedAbiChainSupported(167000) === true`,
  unknown chain `=== false`.
- **Cross-chain proxy resolver (mocked RPC + Etherscan):** a proxy address →
  reads the impl slot, fetches the impl's verified ABI, returns
  `trust: "verified"`, `isProxy: true`, `implementation`, `name` (impl), and
  `proxyName`. A non-proxy verified address → `isProxy:false`, name from the
  address. An unverified impl → `unknown` (no name). RPC failure → `unknown`,
  never throws. Unsupported chain → `unknown`, no client created.
- **Client memoization:** the same chain id reuses one client (no per-call
  `createPublicClient`).
- **End-to-end (manual, live):** proposal #28 — `onMessageInvocation` on Taiko
  now renders `Verified` with a resolved implementation name, and the inner
  layers decode from the verified ABI (or, where formats are still unknown, the
  existing Unverified embedded labeler applies — no regression, no guessing).

## Out of scope

- Chains other than Taiko mainnet (add registry entries per need).
- whatsabi bytecode fallback for L2 (verified-source only by design).
- Decoding inner argument *formats* that aren't a recognized envelope — handled
  by the existing generic embedded labeler (name-only/Unverified), unchanged.
