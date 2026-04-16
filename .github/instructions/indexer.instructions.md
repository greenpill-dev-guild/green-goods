---
applyTo: "packages/indexer/**"
---

- The indexer owns protocol event indexing, not EAS attestations. Do not move EAS indexing into this package.
- Every persisted entity needs a `chainId`, and entity IDs should include `chainId` to avoid cross-chain collisions.
- When relationships change, update both sides of the relationship.
- Schema and config changes are high-risk because generated code can drift silently. After touching `schema.graphql` or `config.yaml`, regenerate before trusting tests.
- Review handler changes with codegen awareness: check entity shapes, chain-aware IDs, and relationship updates together.
- Validate schema or config changes with `cd packages/indexer && bun run codegen && bun run setup-generated`.
- Validate general indexer changes with `cd packages/indexer && bun run check:indexing-boundary && bun run test && bun run build`.
