---
paths:
  - "packages/indexer/**"
---

# Indexer Rules

## Rule: chainId on Every Entity

All GraphQL entities MUST include `chainId: Int!`. All entity IDs MUST use composite format: `${chainId}-${identifier}`.

```graphql
# Good
type Garden @entity {
  id: ID!          # "11155111-0x1234..."
  chainId: Int!    # REQUIRED
}
```

Why: Prevents ID collisions in multi-chain deployments. Without chainId prefix, same contract on two chains would overwrite each other.

## Rule: Bidirectional Relationship Updates

When updating a relationship, ALWAYS update BOTH sides. If Garden gains a Gardener, update both `Garden.gardeners` and `Gardener.gardens`.

## Rule: Create-If-Not-Exists for Update Events

Events may arrive out of order. Update handlers must create the entity if it doesn't exist yet, not fail silently.

## Rule: Use the Envio v3 Bun Entry Point

Use `bun run dev` for the standard Envio v3 local runtime. The Bun-first script reads the
repository-root `.env` and launches Envio through the supported system Node 22 runtime selected by
`scripts/dev/node-cli.js`. Envio manages PostgreSQL and Hasura through Docker. Use `bun run
dev:docker` only when validating the package's self-contained Docker image.

## Rule: Run Codegen After Schema Changes

After modifying `schema.graphql` or `config.yaml`, run `bun run codegen` before writing handler
code. Generated types will be stale otherwise.

> Full package context: [.claude/context/indexer.md](../context/indexer.md) (Envio patterns, EAS boundary, Docker workflow).
