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

## Rule: Always Use Docker Commands on macOS

Use `bun dev:docker` (not `bun dev`) on macOS. The Envio indexer requires Docker Compose for local development.

## Rule: Run Codegen After Schema Changes

After modifying `schema.graphql` or `config.yaml`, run `bun codegen` before writing handler code. Generated types will be stale otherwise.
