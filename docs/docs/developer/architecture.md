# Architecture

> **Audience:** Contributors who need an end-to-end view across packages.
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data lives in `packages/contracts/deployments/*.json`. Updated January 2026.
> **External references:** Review [Envio docs](https://docs.envio.dev/) and [EAS docs](https://docs.attest.org/) when working on indexer or attestation flows.

This guide maps the Green Goods monorepo, summarising package responsibilities, technology stacks, and operational entry points.

---

## Quick Reference

| Package | Purpose | Tech | Port |
|---------|---------|------|------|
| **client** | Gardener PWA | React + Vite | 3001 |
| **admin** | Operator dashboard | React + Vite | 3002 |
| **shared** | Hooks, modules, types | React + TypeScript | - |
| **indexer** | GraphQL API | Envio + PostgreSQL | 8080 |
| **contracts** | Smart contracts | Solidity + Foundry | - |
| **agent** | Multi-platform bot | TypeScript | - |

**Dependencies:**
```
client ──→ shared ──→ contracts (artifacts)
admin ──→ shared ──→ contracts (artifacts)
indexer ──→ contracts (ABIs)
agent ──→ shared
```

**Single Source of Truth**: `packages/contracts/deployments/`

---

## System Layers

- **Shared (`packages/shared`)** — common hooks, providers, stores, modules, and types used by all React apps. **All React hooks MUST live here.**
- **Client (`packages/client`)** — offline-first PWA for gardeners. Persists submissions locally, syncs to the contracts/indexer pipeline, and handles sign-in via Pimlico passkeys and WalletConnect.
- **Admin (`packages/admin`)** — administrative console for operators. Garden setup, membership management, Hypercert minting, and contract lifecycle actions.
- **Indexer (`packages/indexer`)** — Envio project ingesting contract events and exposing a GraphQL API consumed by both frontends.
- **Contracts (`packages/contracts`)** — Solidity suite implementing gardens, actions, attestation resolvers, and the Karma GAP bridge. Managed through `deploy.ts` wrappers.
- **Agent (`packages/agent`)** — Multi-platform bot (Telegram primary) for notifications and interactions.

All packages share the root `.env`; Base Sepolia (`84532`) is the default network. Use `bun dev` at the repository root for a full stack dev environment.

---

## Cross-Package Imports

**✅ Allowed**:
```typescript
// Import shared hooks and types
import { useAuth, useGardens, type Garden } from '@green-goods/shared';

// Import deployment artifacts
import deployment from '../../../contracts/deployments/84532-latest.json';
import GardenABI from '../../../contracts/out/Garden.sol/Garden.json';
```

**❌ Forbidden**:
```typescript
// Never import source code across packages
import { helper } from '../../client/src/utils/helper';
```

**Rule**: Only import from `@green-goods/shared` barrel or deployment artifacts, never source code.

---

## Build Order

1. **contracts** — generates ABIs
2. **shared** — needs contract artifacts, provides hooks/modules
3. **indexer** — needs ABIs
4. **client/admin/agent** — need shared package

**Run**: `bun build` handles order automatically.

---

## Package Snapshots

### Shared Package

- **Purpose**: Central location for all React hooks, business logic modules, Zustand stores, and TypeScript types.
- **Hook Boundary**: ALL React hooks MUST live here. Client/Admin only contain components and views.
- **Key directories**: `hooks/`, `modules/`, `stores/`, `types/`, `utils/`, `workflows/`
- **Commands**:
  ```bash
  bun --filter shared test         # Run tests
  bun --filter shared storybook    # Start Storybook (port 6006)
  ```
- **Key docs**: [Shared Package Guide](shared) covers hooks, modules, and patterns.

### Client PWA

- **Stack**: React 19, Vite, Tailwind v4, Radix UI, TanStack Query (with offline persister), Viem, Zustand.
- **Auth**: Pimlico passkey smart accounts (primary) and Reown AppKit wallet connections.
- **Offline architecture**: IndexedDB queue (`src/modules/offline`), service worker via `vite-plugin-pwa`, background sync to replay submissions.
- **Commands**:
  ```bash
  bun --filter client dev        # HTTPS dev server on https://localhost:3001
  bun --filter client test       # Vitest suite
  ```
- **Key docs**: [Client Package](client) covers offline patterns and Pimlico setup.

### Admin Dashboard

- **Stack**: React 19, Tailwind v4, Zustand, XState workflows, graphql-request (GraphQL), Viem.
- **Roles**: Admin allow list (see `src/config.ts`) and operator scope resolved from the indexer via the `useRole` hook.
- **Features**: Garden creation & membership management, contract deployment helpers, Hypercert minting wizard.
- **Commands**:
  ```bash
  bun --filter admin dev         # http://localhost:3002
  bun --filter admin test        # Vitest suite
  ```
- **Key docs**: [Admin Package](admin) covers role-based access and garden management.

### Indexer (Envio)

- **Purpose**: Tracks gardens, actions, gardeners, and attestation metadata for frontends.
- **Commands**:
  ```bash
  bun --filter indexer dev       # launches Envio stack + playground on http://localhost:8080
  bun --filter indexer codegen   # regenerate Envio types from config/schema
  ```
- **Troubleshooting**: Use `bun reset` or `./reset-indexer.sh` to clear Docker volumes when Envio state is corrupted.
- **Key docs**: [Indexer Package](indexer) covers schema and event handlers.

### Contracts

- **Scope**: GardenToken (ERC-721), GardenAccount (ERC-6551), ActionRegistry, Work/Assessment resolvers, Karma GAP integration (`KarmaLib`).
- **Tooling**: Foundry (forge/anvil), custom deployment scripts (`script/deploy.ts`, `script/upgrade.ts`), schema config in `config/schemas.json` (read-only).
- **Commands**:
  ```bash
  bun --filter contracts build
  bun --filter contracts test             # includes gas report
  bun --filter contracts deploy:testnet   # wraps deploy.ts (Base Sepolia)
  ```
- **Key docs**: [Contracts Package](contracts) and [Contracts Handbook](contracts-handbook) for deployment procedures.

---

## Data & Integration Flow

1. **Garden creation** (admin) → `GardenToken` mints and emits `GardenMinted` event. Initializes `GardenAccount` (ERC-6551). Indexer captures event. Supported chains create a Karma GAP project via `KarmaLib`.
2. **Action setup** (admin) → `ActionRegistry` emits `ActionRegistered` events. Indexer captures for task registry.
3. **Work submission** (client) → Offline queue stores media + metadata, uploads to IPFS, then creates EAS attestation via `WorkResolver`. Attestations queryable from EAS GraphQL.
4. **Approval** (operator) → `WorkApprovalResolver` validates roles, records EAS attestation, triggers `GreenGoodsResolver` which creates GAP impact attestation via `GardenAccount`.
5. **Assessment** (operator) → `AssessmentResolver` generates assessment attestations (also synced to GAP where supported).
6. **Hypercert minting** (operator) → Aggregates approved work attestations, uploads metadata to IPFS, mints ERC-1155 on Hypercerts protocol.
7. **Consumption** → Frontends query Envio indexer for gardens/actions/members. Work/approval attestations queried from EAS GraphQL.

---

## Data Sources

| Data Type | Source | Query Method |
|-----------|--------|--------------|
| Gardens, Actions, Gardeners | Envio Indexer | GraphQL |
| Work Submissions, Approvals | EAS | GraphQL |
| Hypercerts | Hypercerts API | GraphQL |
| Impact Attestations | Karma GAP | SDK |

---

## Related References

- [Product Overview](../features/overview) — condensed product & data map
- [Getting Started](getting-started) — environment setup
- [Shared Package](shared) — hooks, modules, and patterns
- [Contracts Handbook](contracts-handbook) — lifecycle workflows
- Package-specific guides: [Client](client) | [Admin](admin) | [Indexer](indexer) | [Contracts](contracts)
