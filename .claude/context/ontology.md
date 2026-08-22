# Ontology Context

Read this when changing controlled vocabularies, EAS schemas, glossary entities or personas,
ontology constraints or state machines, capability evidence, or the ontology sidecar itself.

## Quick reference

```bash
bun run ontology:generate    # Regenerate all five projections from the sidecar and projection data
bun run check:ontology       # Verify declarations, anchors, generated output, and accepted drift
node --test scripts/quality/check-ontology.test.mjs   # Run the checker fixtures directly
```

## Source of truth

`packages/shared/src/ontology/green-goods-ontology.json` is the canonical machine-readable
specification for entities, personas, vocabularies, EAS schemas, constraints, lifecycle state
machines, integration mappings, and known issues. Capability maturity, human-language concepts,
and safe claims live in `packages/shared/src/ontology/green-goods-projections.json`.

The full typed accessor in `packages/shared/src/ontology/index.ts` remains internal. Application
code and agents should use the compact read-only query API exported by `@green-goods/shared`, which
loads `agent-manifest.generated.json`.

## What the gate proves

`bun run check:ontology` performs exact checks for declared Solidity, GraphQL, and TypeScript
vocabularies; EAS schema shapes; mappings; glossary definitions; stable source symbols; generated
artifacts; and the bidirectional drift baseline. It validates state-machine structure, planned
implementation arrival, and evidence-file presence.

Constraint prose, transition behavior, capability evidence, and marketing claims still require
their named implementation tests or human verification. An existing evidence file is not proof
that its contents still support a claim.

## Canon rules

- **On-chain wins for chain-backed vocabularies.** When a Solidity enum exists, its member names,
  order, and values are canonical. TypeScript and GraphQL representations declare their spelling
  in the sidecar; unexplained deviation is drift.
- **The glossary wins for entity and persona prose.** Sidecar definitions and the glossary's Domain
  Entities and Personas tables are locked together after normalization.
- **Each layer's spelling is explicit.** GraphQL sentinels, numeric enums, lowercase slugs, and
  other layer-specific forms belong in declared representations or mappings, not assumptions.

## Change protocol

1. Edit the implementation, sidecar, and projection data together.
2. Run `bun run ontology:generate`; never hand-edit generated projections.
3. Run `bun run check:ontology` and fix every unlisted or stale finding.
4. If temporary drift is intentional, add one bounded baseline entry with an owner, expiry, and
   concrete burn-down direction.

## Baseline discipline

`scripts/data/ontology-drift-baseline.json` entries carry `guard`, `subject`, the checker's exact
`detail`, `owner`, `expires` (at most 250 days away), and a meaningful `note`. The gate is
bidirectional: new drift fails, changed drift fails, and fixed drift fails until its stale baseline
entry is removed. Renewing an expiry requires a fresh decision and note.

## Specified-source semantics

A `source_status: "specified"` vocabulary, constraint, or state machine must name its governing
specification and a planned source anchor. The gate watches the comment-stripped source for that
symbol and fails when implementation arrives, forcing the entry to become `implemented` with
declared representations or implementation evidence. Specified EAS schemas are similarly watched
through `packages/contracts/config/schemas.json`.

## PoolType name collision

Solidity has two unrelated `PoolType` enums:

- `IGardensModule.PoolType { ActionSignal, HypercertSignal }` describes Gardens V2 signal pools
  (`signal-pool-type`). Its shared and GraphQL representations remain intentionally baselined while
  their compatibility migration is planned.
- `ICommitmentPoolingModule.PoolType { Garden, Protocol }` describes commitment-pooling anchors
  (`commitment-pool-type`) and is implemented across contracts, shared, and the indexer.

Never merge or cross-map these vocabularies because they share only an identifier.

## Generated projections

`bun run ontology:generate` owns all five outputs:

- `docs/docs/reference/ontology.generated.mdx`
- `docs/docs/builders/integrations/entity-matrix.mdx`
- `docs/docs/reference/ontology-human.generated.mdx`
- `docs/docs/community/green-goods-claims.generated.mdx`
- `packages/shared/src/ontology/agent-manifest.generated.json`

Every output carries a generated-file notice and must remain deterministic.
