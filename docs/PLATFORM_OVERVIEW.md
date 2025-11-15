# Platform Overview

High-level map of the Green Goods protocol, surfaces, and supporting services.

## Core Components

- **Client (PWA)** — offline-first gardener/operator app built with React, TanStack Query, and Viem. Persists work submissions in IndexedDB and syncs when connectivity returns.
- **Admin** — management console for garden operators to configure actions, approve work, and monitor assessments.
- **Indexer** — Envio project that consumes contract events and exposes a GraphQL API for the frontends.
- **Contracts** — Solidity suite handling garden identity (ERC-721 + ERC-6551), action registry, and attestation resolvers connected to Ethereum Attestation Service (EAS).

All packages read the same root `.env`. The default deployment network is Base Sepolia (`84532`); production networks include Arbitrum and Celo.

## Data Flow

1. **Garden setup** — Operators mint gardens through the admin app. Contracts create token-bound accounts and register the garden in the indexer.
2. **Action configuration** — Operators define actions (what counts as valid work) and publish them on-chain.
3. **Work capture** — Gardeners submit evidence (photos, metadata) through the PWA, which queues entries offline until the network is available.
4. **Approval** — Operators review submissions in the admin UI. Approvals create on-chain attestations via `WorkApprovalResolver`.
5. **Verification** — Attestations and assessments feed the indexer, populating dashboards and the Karma GAP bridge (see appendix).

## Offline Strategy

- IndexedDB-backed queue for pending work and assessments
- Service worker caches core shell assets for repeat visits
- Background sync resumes submissions automatically once connectivity returns

## Tooling Highlights

- **bun** — workspace orchestrator for scripts and package management
- **Biome + 0xlint** — formatting and linting across TypeScript sources
- **Playwright** — end-to-end regression suite with offline flow coverage
- **Foundry** — Solidity toolchain for tests, deployments, and upgrades

## Where to Go Next

- App-specific architecture: `packages/client/AGENTS.md`, `packages/admin/AGENTS.md`
- Contract details and lifecycle: [Contracts Handbook](./CONTRACTS_HANDBOOK.md)
- Impact attestations: [Karma GAP Integration](./KARMA_GAP_INTEGRATION.md)
