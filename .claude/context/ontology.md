# Ontology Context

Loaded when touching controlled vocabularies (enums, string unions), EAS schemas, glossary entities/personas, or the ontology sidecar itself. Extends CLAUDE.md.

## Quick Reference

```bash
bun run check:ontology       # Drift gate: sidecar ↔ Solidity/GraphQL/TS/EAS/docs (also in agentic:check + drift:check)
bun run ontology:generate    # Regenerate docs/docs/reference/ontology.generated.mdx + entity-matrix.mdx
node --test scripts/quality/check-ontology.test.mjs   # Checker unit fixtures
```

## What the sidecar is

`packages/shared/src/ontology/green-goods-ontology.json` is the canonical, machine-readable specification of the Green Goods domain: entities, personas, controlled vocabularies with per-layer representations, EAS schemas, cross-layer constraints, lifecycle state machines, the integration matrix, and known issues. `scripts/quality/check-ontology.mjs` drift-gates it against the code and docs on every relevant change (workflow: `.github/workflows/ontology.yml`; findings baseline: `scripts/data/ontology-drift-baseline.json`). The typed accessor is `packages/shared/src/ontology/index.ts` (internal — not in `package.json#exports` yet).

## Canon rules

- **On-chain wins for chain-backed vocabularies.** If a Solidity enum exists (Capital, Domain, GardenRole, WeightScheme, signal-pool PoolType…), its member names, order, and values are canonical. TypeScript/GraphQL representations declare their expected spelling in the sidecar; deviation is drift.
- **The glossary wins for entity/persona prose.** The sidecar `definition` fields and the glossary's Domain Entities / Personas table cells are locked together character-for-character (normalized) by the docs-glossary guard — edit both together.
- **Each layer's spelling is declared, not inferred.** SCREAMING in GraphQL, numeric enums in shared TS, lowercase slugs — every representation lists its exact expected members. Layer-only extras (the indexer's `UNKNOWN` sentinel, `mutual_credit`) are declared in the sidecar, never baselined.

## Changing a vocabulary

1. Edit the code (Solidity/TS/GraphQL) and the sidecar's canonical + representation member lists **in the same change**.
2. Run `bun run check:ontology` — fix anything it reports; never hand-edit the generated pages.
3. Run `bun run ontology:generate` and commit both regenerated artifacts.
4. If the change intentionally leaves temporary drift, add a baseline entry (below) instead of skipping the gate.

## Baseline discipline

`scripts/data/ontology-drift-baseline.json` entries carry `guard`, `subject`, `detail` (must equal the checker's computed detail verbatim), `owner`, `expires` (≤ 250 days out), and a `note` ≥ 12 chars explaining the fix direction. The gate is bidirectional: unlisted findings fail, and **fixed drift also fails until its entry is deleted**. Renewing an expiry is a conscious act — re-date it with a fresh note, never silently.

## `status: "spec"` semantics

Commitment-pooling vocabularies/schemas/state machines are encoded from the locked spec (`.plans/active/commitment-pooling/contract-spec.md`) with `status: "spec"`, empty representations, and a `planned_anchor`. The gate skips code cross-checks for them but watches the planned anchor: the moment `enum <Symbol>` appears in that file (or a spec schema key lands in `config/schemas.json`), the gate fails with instructions to flip the entry to `live` and declare representations. If the spec's vocabulary changes before implementation, update the sidecar in the same PR as the spec edit.

## ⚠ PoolType name collision

Solidity has two unrelated `PoolType` enums: `IGardensModule.PoolType { ActionSignal, HypercertSignal }` (live Gardens V2 signal pools — sidecar id `signal-pool-type`) and the planned `ICommitmentPoolingModule.PoolType { Garden, Protocol }` (sidecar id `commitment-pool-type`). Never merge, cross-map, or "unify" them. Note the shared TS `PoolType` in `gardens-community.ts` is currently inverted vs chain — verified latent (assigned by address identity, never decoded); see baseline entries `signal-pool-type-*` before touching it.

## Human-facing surfaces

Generated reference (listed): `docs/docs/reference/ontology.generated.mdx`. Entity matrix (unlisted, generated): `docs/docs/builders/integrations/entity-matrix.mdx`. Both carry AUTO-GENERATED banners — edit the sidecar, then regenerate.
