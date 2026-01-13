# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiko DAO UI Monorepo - A Yarn workspaces monorepo containing the frontend for Taiko's decentralized governance system built on Aragon OSx.

## Monorepo Structure

Three packages in `packages/`:

- **ui** (dao-ui): Main Next.js frontend for the Taiko DAO - React 18, Tailwind, wagmi/viem for Web3
- **aragon-ods-fork** (@aragon/ods): Customized fork of Aragon's Open Design System - React component library with Storybook
- **drill-report**: SvelteKit app (uses pnpm separately)

## Common Commands

### UI Package (packages/ui)
```bash
cd packages/ui
bun install        # Install dependencies
bun dev            # Start Next.js dev server
bun build          # Production build
bun lint           # ESLint
bun format         # Prettier
```

### Aragon ODS Fork (packages/aragon-ods-fork)
```bash
cd packages/aragon-ods-fork
yarn install
yarn build              # Rollup build
yarn build:watch        # Watch mode
yarn storybook          # Storybook on port 6006
yarn test               # Jest watch mode
yarn test:coverage      # Jest with coverage
yarn lint               # ESLint (--max-warnings=0)
yarn type-check         # TypeScript check
```

### Drill Report (packages/drill-report)
```bash
cd packages/drill-report
pnpm install
pnpm dev           # Vite dev server
pnpm build         # Production build
pnpm check         # Svelte + TypeScript check
```

## Architecture

### Plugin System (packages/ui/src/plugins/)

The UI uses a plugin architecture where each governance module is self-contained:

- **optimistic-proposals**: Community proposal voting with veto mechanism (mapped to `/community-proposals`)
- **multisig**: Taiko Council draft proposals (hidden unless signer)
- **emergency-multisig**: Emergency proposals with encryption (hidden unless signer)
- **security-council**: Security Council management
- **delegates**: Delegate profiles and delegation

Each plugin folder contains:
- `index.tsx` - Plugin entry and registration
- `pages/` - Route pages
- `components/` - Plugin-specific components
- `hooks/` - Data fetching hooks (wagmi/viem)
- `artifacts/` - Smart contract ABIs

Plugin registration in `src/plugins/index.ts` - each plugin defines id, folder, address, and visibility rules.

### Encryption System

Security Council proposals use two-layer encryption:
1. Symmetric key encrypts proposal metadata/actions
2. Each SC member's public key encrypts the symmetric key
3. Members derive keypairs by signing a deterministic payload (`DETERMINISTIC_EMERGENCY_PAYLOAD` in constants.ts)

### Key Configuration

Environment variables in `.env` (see `.env.example`):
- Contract addresses for DAO, plugins, token
- Network settings (chain, RPC via Alchemy)
- IPFS/Pinata for metadata storage
- WalletConnect project ID

Constants exported from `src/constants.ts` - all prefixed with `PUB_`.

### Styling

UI uses Tailwind with Aragon ODS preset. The ODS fork provides base components; UI extends with custom colors via CSS variables (`--ods-color-*`).

## Data Layer (No Traditional Backend)

This is a fully decentralized frontend with no backend server:

1. **The Graph Subgraph** - Indexed proposal data via GraphQL
   - Apollo Client queries in `src/utils/gql/`
   - Configured via `NEXT_PUBLIC_SUBGRAPH_URL`

2. **Direct Smart Contract Reads** - Real-time on-chain state via wagmi/viem
   - Each plugin has hooks reading from contracts
   - ABIs in each plugin's `artifacts/` folder

3. **IPFS/Pinata** - Proposal metadata storage
   - Utilities in `src/utils/ipfs.ts`

## Web3 Integration

- **wagmi/viem**: Primary Web3 library
- **@tanstack/react-query**: Data caching
- **WalletConnect**: Wallet connection via Web3Modal
- Contract interactions via custom hooks in each plugin's `hooks/` folder
