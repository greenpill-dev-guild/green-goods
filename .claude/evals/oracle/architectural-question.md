# Oracle Eval: Indexer Boundary Question

## Question

What does the Envio indexer index vs what is queried from external services like easscan.org? Where is the boundary between on-chain data that our indexer handles and data that comes from third-party indexers?

## Context

A new developer is building a feature that needs to display work approval details alongside garden information. They want to know whether to query the Envio indexer or the EAS GraphQL API for the attestation data, and what the reasoning is behind the boundary.

## Expected Answer

The oracle should identify and explain the **Indexer Boundary** rule:

### What Envio indexes (Green Goods core state):
- **Actions**: Action registry entries (create, update, deactivate)
- **Gardens**: Garden creation, membership changes, configuration updates
- **Hats role membership**: Who wears which hats (operators, gardeners, evaluators)
- **Vault history**: Deposits, withdrawals, yield events for garden treasuries
- **Yield split history**: How yield is allocated across gardens/gardeners
- **Minimal hypercert linkage/claims**: Just the link between gardens and hypercert token IDs, not full metadata

### What is NOT indexed by Envio (queried from external services):
- **EAS attestations** (work submissions, work approvals, assessments) -> queried from `easscan.org` GraphQL per chain
- **Gardens V2 community/pools** -> queried from Gardens V2 protocol APIs
- **Marketplace data** -> queried from Hypercerts marketplace API
- **ENS lifecycle** -> queried from ENS subgraph
- **Cookie jars** -> queried from cookie jar contract reads
- **Hypercert display metadata** -> queried from Hypercerts API

### Key source files:
- **CLAUDE.md**: Indexer Boundary rule in Key Patterns section
- **`packages/shared/src/modules/data/eas.ts`**: EAS GraphQL queries for attestations
- **`packages/shared/src/modules/data/gardens.ts`**: Garden data from Envio indexer
- **`packages/shared/.claude/context/shared.md`**: EAS Data Layer section explaining the split
- **`packages/shared/src/config/blockchain.ts`**: Schema UIDs and EAS addresses per chain

### Rationale:
The boundary exists because EAS has its own well-maintained indexer (easscan.org) that handles attestation queries efficiently. Re-indexing the same data in Envio would be redundant, add maintenance burden, and risk inconsistency. The Envio indexer focuses on state that is unique to Green Goods contracts and not available from any existing third-party service.
