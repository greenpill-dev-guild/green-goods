# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
bun setup                    # Initial setup (deps, packages, .env)
bun dev                      # Start all services via PM2
bun dev:stop                 # Stop all services
bun format && bun lint       # Format and lint workspace
bun run test                 # Run all tests (CRITICAL: not `bun test`)
bun build                    # Build everything (respects dependency order)
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

Per-package: `bun run test`, `bun build`, `bun lint` (check each package.json for available scripts).

**Contracts** (never use raw `forge` commands): `bun build` (~2s cached), `bun build:full` (CI/deploy only, >180s), `bun run test:fork` (needs RPC URLs).

## Architecture

Green Goods is an **offline-first, single-chain** platform for documenting conservation work on-chain. Bun monorepo.

### Key Principles
1. **Offline-First**: Client PWA works without internet, syncs when connected
2. **Single Environment**: All packages share root `.env` (never create package-specific .env)
3. **Single Chain**: Target chain set by `VITE_CHAIN_ID` at build time
4. **Shared Logic**: ALL React hooks MUST live in `@green-goods/shared`

### Intent Priorities (trade-off hierarchy)
1. **Offline correctness** — nothing breaks without network
2. **Security** — funds, access control, key management
3. **User experience** — PWA-native feel, responsive, accessible
4. **Developer experience** — build times, test speed, clear errors
5. **Code elegance** — readability, patterns, minimal complexity

### Build Order
1. **contracts** -> ABIs for other packages
2. **shared** -> hooks/modules for frontends
3. **indexer** -> needs contract ABIs
4. **client/admin/agent** -> need shared package

## Key Patterns

**Hook Boundary**: ALL hooks in `@green-goods/shared`. Client/admin only have components and views.
```typescript
import { useAuth, useGardens } from '@green-goods/shared'; // correct
```

**Contract Integration**: Import deployment artifacts, never hardcode addresses.
```typescript
import deployment from '../../../contracts/deployments/11155111-latest.json';
```

**Barrel Imports**: Always `import { x } from "@green-goods/shared"`, never deep paths.

**Type System**: Domain types (`Garden`, `Work`, `Action`, `Address`) live in `@green-goods/shared`. Use `Address` type (not `string`) for Ethereum addresses.

**Error Handling**: Never swallow errors. Use `parseContractError()` + `USER_FRIENDLY_ERRORS` for contract errors. Use `createMutationErrorHandler()` in shared mutation hooks. Use `logger` from shared (not `console.log`).

**Query Keys**: Use `queryKeys.*` helpers from shared. Serialize objects in query keys.

**Indexer Boundary**: Envio indexes only Green Goods core state (actions, gardens, hats role membership, vault history, yield split history, minimal hypercert linkage/claims). Do not re-index EAS attestations, Gardens V2 community/pools, marketplace, ENS lifecycle, cookie jars, or Hypercert display metadata.

## Contract Deployment

```bash
bun script/deploy.ts core --network sepolia              # Dry run
bun script/deploy.ts core --network sepolia --broadcast   # Deploy
bun script/deploy.ts core --network sepolia --broadcast --update-schemas  # Deploy + schemas
```

**Deployment artifacts**: `deployments/{chainId}-latest.json` is the source of truth for all addresses. Zero addresses mean the module hasn't been deployed yet (not a blocker for optional modules).

## Environment

Single `.env` at root (never create package-specific .env). `VITE_CHAIN_ID` sets target chain at build time. See `.env.example`.

## Git Workflow

**Branches**: `type/description` (e.g., `feature/hats-v2`, `bug/admin-fix`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: contracts, indexer, shared, client, admin, agent, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`
