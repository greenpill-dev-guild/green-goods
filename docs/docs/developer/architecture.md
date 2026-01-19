# Architecture

> **Audience:** Contributors who need an end-to-end view across packages.
> **Networks:** Arbitrum One (42161), Celo (42220), Base Sepolia (84532). Deployment data lives in `packages/contracts/deployments/*.json`. Updated November 2024.
> **External references:** Review [Envio docs](https://docs.envio.dev/) and [EAS docs](https://docs.attest.org/) when working on indexer or attestation flows.

This guide maps the Green Goods monorepo, summarising package responsibilities, technology stacks, and operational entry points. It pulls together the essentials that previously lived in package-level READMEs.

## System Layers

- **Client (`packages/client`)** — offline-first PWA for gardeners and operators. Persists submissions locally, syncs to the contracts/indexer pipeline, and handles sign-in via Pimlico passkeys and WalletConnect.
- **Admin (`packages/admin`)** — administrative console for garden setup, membership management, and contract lifecycle actions. Provides operator-scoped views via the indexer.
- **Indexer (`packages/indexer`)** — Envio project ingesting contract events and exposing a GraphQL API consumed by both frontends.
- **Contracts (`packages/contracts`)** — Solidity suite implementing gardens, actions, attestation resolvers, and the Karma GAP bridge. Managed through `deploy.ts` wrappers.

All packages share the root `.env`; Base Sepolia (`84532`) is the default network. Use `bun dev` at the repository root for a full stack dev environment.

## Package Snapshots

### Client PWA

- **Stack**: React 19, Vite, Tailwind v4, Radix UI, TanStack Query (with offline persister), Viem, Zustand.
- **Auth**: Pimlico passkey smart accounts (primary) and Reown AppKit wallet connections. Privy variables exist only for legacy migrations.
- **Offline architecture**: IndexedDB queue (`src/modules/offline`), service worker via `vite-plugin-pwa`, background sync to replay submissions.
- **Useful commands**:
  ```bash
  bun --filter client dev        # HTTPS dev server on https://localhost:3001
  bun --filter client test       # Vitest suite
  bun --filter client format     # Biome formatter
  ```
- **Key docs**: `packages/client/AGENTS.md` covers offline patterns, queue APIs, and Pimlico setup.

### Admin Dashboard

- **Stack**: React 19, Tailwind v4, Zustand, XState workflows, Urql (GraphQL + subscriptions), Viem.
- **Roles**: Admin allow list (see `src/config.ts`) and operator scope resolved from the indexer via the `useRole` hook.
- **Features**: Garden creation & membership management, contract deployment helpers, Karma GAP impact viewing (via SDK), planned impact exports.
- **Commands**:
  ```bash
  bun --filter admin dev         # http://localhost:3002
  bun --filter admin test        # Vitest suite
  ```
- **Note**: Karma GAP data is fetched through the SDK using `gapProjectUID` exposed by the indexer; see the appendix below.

### Indexer (Envio)

- **Purpose**: Tracks gardens, actions, submissions, approvals, and attestation metadata for frontends.
- **Runbook**:
  ```bash
  bun --filter indexer dev       # launches Envio stack + playground on http://localhost:8080
  bun --filter indexer codegen   # regenerate Envio types from config/schema
  ```
- **Troubleshooting**: Use `bun reset` or `./reset-indexer.sh` to clear Docker volumes when Envio state is corrupted. ReScript-generated artifacts live in `generated/`; run `npm install --legacy-peer-deps` inside that folder if codegen complains about missing packages.
- **GAP queries**: Gardens expose `gapProjectUID` in GraphQL; consumers should fetch impacts/milestones with the Karma GAP SDK (see the hook skeleton in `packages/indexer/KARMA_GAP_QUERIES.md`).

### Contracts

- **Scope**: GardenToken (ERC-721), GardenAccount (ERC-6551), ActionRegistry, Work/Assessment resolvers, Karma GAP integration (`KarmaLib`).
- **Tooling**: Foundry (forge/anvil), custom deployment scripts (`script/deploy.ts`, `script/upgrade.ts`), schema config in `config/schemas.json` (read-only).
- **Commands**:
  ```bash
  bun --filter contracts build
  bun --filter contracts test             # includes gas report
  bun --filter contracts deploy:testnet   # wraps deploy.ts (Base Sepolia)
  bun --filter contracts upgrade:testnet  # UUPS upgrade wrapper
  ```
- **Checklist**: See the [Contracts Handbook](contracts-handbook) for deployment, upgrade, schema, and validation procedures.

## Data & Integration Flow

1. **Garden creation** (admin) → `GardenToken` mints and emits `GardenMinted` event. Initializes `GardenAccount` (ERC-6551). Indexer captures event. Supported chains create a Karma GAP project via `KarmaLib`.
2. **Action setup** (admin) → `ActionRegistry` emits `ActionRegistered` events. Indexer captures for task registry.
3. **Work submission** (client) → Offline queue stores media + metadata, uploads to IPFS, then creates EAS attestation via `WorkResolver`. Attestations queryable from EAS GraphQL.
4. **Approval** (operator) → `WorkApprovalResolver` validates roles, records EAS attestation, triggers `GreenGoodsResolver` which creates GAP impact attestation via `GardenAccount`.
5. **Assessment** (operator) → `AssessmentResolver` generates assessment attestations (also synced to GAP where supported).
6. **Consumption** → Frontends query Envio indexer for gardens/actions/members. Work/approval attestations queried from EAS GraphQL. GAP impact data fetched via SDK using stored project UIDs.

## Karma GAP At a Glance

- **Supported chains**: Optimism, Arbitrum, Celo, Base Sepolia, Sepolia, Optimism Sepolia, Sei, Sei Testnet.
- **UID storage**: `GardenAccount.gapProjectUID` (bytes32) exposed through the indexer as strings.
- **SDK usage**: Install `@show-karma/karma-gap-sdk`, map chain ID to network string, and fetch impacts/milestones using the project UID. Example hook lives in `packages/indexer/KARMA_GAP_QUERIES.md`.
- **Resilience**: GAP calls are best-effort; failures emit logs but do not revert the parent transaction.

## Related References

- [Product Overview](../features/overview) — condensed product & data map
- [Developer Docs](../developer/getting-started) — environment, testing, troubleshooting
- [Contracts Handbook](../developer/contracts-handbook) — lifecycle workflows
- Package-specific deep dives remain in their respective `AGENTS.md` and README files for implementation details.
