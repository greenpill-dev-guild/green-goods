# ADR-004: Indexer Boundary

**Date**: 2026-04-02
**Status**: Accepted

## Context

Green Goods interacts with multiple on-chain protocols: EAS (attestations), Gardens V2 (community/pools), Hypercerts, Hats Protocol (roles), ENS, Cookie Jars, and a custom Octant vault system. Indexing everything into a single Envio indexer would create a maintenance burden -- every upstream protocol upgrade could break the indexer, and the schema would grow beyond what the app actually queries.

## Decision

The Envio indexer (`packages/indexer/`) indexes **only Green Goods core state**. External protocol data is fetched at query time from their native APIs or subgraphs.

Indexed (via handler modules in `src/handlers/`):

- **actionRegistry**: Action creation and updates
- **garden**: GardenToken + GardenAccount events (garden creation, membership)
- **hatsModule**: Role membership changes via Hats Protocol
- **octantVault**: OctantModule + OctantVault deposit/withdrawal events
- **hypercerts**: HypercertMinter events (minimal linkage and claims)
- **yieldSplitter**: Yield split configuration changes

**Not indexed** (fetched via external APIs at runtime):

- EAS attestations (queried from EAS GraphQL: `easscan.org/graphql`)
- Gardens V2 community/pools (queried from Gardens subgraph)
- Marketplace listings and trades (Hypercerts marketplace SDK)
- ENS names/avatars (resolved via viem ENS utilities)
- Cookie Jar state beyond what's in on-chain events
- Hypercert display metadata (fetched from IPFS via Hypercerts SDK)

## Consequences

- **Enables**: Fast, focused indexer that only re-indexes when Green Goods contracts change. External protocol upgrades don't require indexer redeployments.
- **Constrains**: Some views require multiple data sources (indexer + EAS + subgraph), increasing frontend query complexity. Cross-source joins happen in the shared hooks layer.
- **Trade-off**: Runtime queries to external APIs add latency and failure modes that a pre-indexed approach would avoid. The stale time configuration in react-query (`STALE_TIME_FAST/MEDIUM/SLOW`) mitigates repeated fetches.
