# Green Goods Indexer — Bugbot Rules (warnings-first)

Envio-specific patterns for multi-chain indexing.

---

## A) New entities must include chainId

If any changed file adds a new GraphQL entity without `chainId`, then:
- Pattern: New `type X @entity` in `schema.graphql` without `chainId: Int!`
- Add a non-blocking Bug titled "Indexer: entity missing chainId"
- Body: "All entities must include `chainId: Int!` for multi-chain support. See `packages/indexer/.cursor/rules/envio-conventions.mdc#entity-requirements`."

---

## B) Use composite IDs

If any changed file creates entities with simple IDs instead of composite, then:
- Pattern: `context.Entity.set({ id: tokenId, ...` without `${chainId}-` prefix
- Add a non-blocking Bug titled "Indexer: verify composite ID"
- Body: "Use composite IDs: \`${chainId}-${identifier}\` to prevent collisions across chains. See `packages/indexer/.cursor/rules/envio-conventions.mdc#composite-id-pattern`."

---

## C) Bidirectional relationship updates

If any changed file updates one side of a relationship without the other, then:
- Add a non-blocking Bug titled "Indexer: verify bidirectional update"
- Body: "Update both sides of relationships. When adding gardener to garden, also add garden to gardener. See `packages/indexer/.cursor/rules/envio-conventions.mdc#bidirectional-relationships`."

---

## Reference

- `.cursor/rules/envio-conventions.mdc` — Entity/handler patterns
- `.cursor/rules/development.mdc` — Codegen workflow
