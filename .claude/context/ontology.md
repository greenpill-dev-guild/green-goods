# Ontology Context

Loaded when touching controlled vocabularies (enums, string unions), EAS schemas, glossary entities/personas, or the ontology sidecar itself. Extends CLAUDE.md.

## Quick Reference

```bash
bun run check:ontology       # Drift gate: sidecar ↔ Solidity/GraphQL/TS/EAS/docs (also in agentic:check + drift:check)
bun run ontology:generate    # Regenerate docs/docs/reference/ontology.generated.mdx + entity-matrix.mdx
node --test scripts/quality/check-ontology.test.mjs   # Checker unit fixtures
```

## What the sidecar is

`packages/shared/src/ontology/green-goods-ontology.json` is the canonical, machine-readable specification of the Green Goods domain: entities, personas, controlled vocabularies with per-layer representations, EAS schemas, cross-layer constraints, lifecycle state machines, the integration matrix, known issues, plus the **capability projection** (`capabilities`: five evidence-backed maturity dimensions per entity — implementation / deployment / activation / indexing / availability) and **concept cards** (`concept_cards`: the human explainer per entity). `scripts/quality/check-ontology.mjs` drift-gates it against the code and docs on every relevant change (workflow: `.github/workflows/ontology.yml`; findings baseline: `scripts/data/ontology-drift-baseline.json`). Public claims live in `packages/shared/src/ontology/marketing-claims.json` (maturity enum `available | deployed-not-available | in-build | planned | vision`), validated by the same gate: evidence paths must exist, `json_path` pointers must resolve, and an `available` claim requires user-available capability. The full typed accessor is `packages/shared/src/ontology/index.ts` (internal — not exported).

## Meaning vs maturity

The per-item `status: live | spec` field is only the drift gate's code-crosscheck switch (live = representations checked; spec = planned-anchor watched). It is **never** a product-availability claim — maturity lives in `capabilities` and is what the generated pages render. Commitment pooling is the canonical example: contracts live and unpaused on Arbitrum (implementation/deployment/activation complete) while indexing is not started and availability is blocked.

## Agent query seam (stable usage path)

Agents and app code look terms up through the generated compact manifest, never by loading the full sidecar:

```ts
import { lookupTerm, maturityOf, safeClaim } from "@green-goods/shared/ontology-manifest";

lookupTerm("commitment pool"); // id, definition, aliases, relationships, maturity
maturityOf("commitment-pool"); // { implementation: "complete", …, availability: "blocked" }
safeClaim("commitment-pool");  // the vetted public sentence for this entity
```

The manifest (`packages/shared/src/ontology/ontology-manifest.generated.json`) regenerates with `bun run ontology:generate` and is byte-compared by the gate, so the seam cannot drift from the sidecar.

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

Commitment-pooling vocabularies/schemas/state machines are encoded from the locked spec (`.plans/active/commitment-pooling/contract-spec.md`) with `status: "spec"`, empty representations, and a `planned_anchor`. The gate skips code cross-checks for them but watches the planned anchor: once the anchor file exists and mentions the bare symbol anywhere outside comments (word-boundary match on the comment-stripped source — a type alias or constant set trips it too, not just `enum <Symbol>`; or a spec schema key lands in `config/schemas.json`), the gate fails with instructions to flip the entry to `live` and declare representations. If the spec's vocabulary changes before implementation, update the sidecar in the same PR as the spec edit.

## ⚠ PoolType name collision

Solidity has two unrelated `PoolType` enums: `IGardensModule.PoolType { ActionSignal, HypercertSignal }` (live Gardens V2 signal pools — sidecar id `signal-pool-type`) and the planned `ICommitmentPoolingModule.PoolType { Garden, Protocol }` (sidecar id `commitment-pool-type`). Never merge, cross-map, or "unify" them. Note the shared TS `PoolType` in `gardens-community.ts` is currently inverted vs chain — verified latent (assigned by address identity, never decoded); see baseline entries `signal-pool-type-*` before touching it.

## Human-facing surfaces

Generated reference (listed): `docs/docs/reference/ontology.generated.mdx`. Concept cards + public claim ledger (listed): `docs/docs/reference/concepts.generated.mdx`. Entity matrix (unlisted, generated, grouped by entity/schema/persona/concept): `docs/docs/builders/integrations/entity-matrix.mdx`. Agent manifest: `packages/shared/src/ontology/ontology-manifest.generated.json`. All four carry AUTO-GENERATED banners or headers — edit the sidecar (or `marketing-claims.json`), then regenerate. A new generated docs artifact must also be added to `.github/workflows/ontology.yml` (both trigger lists) and the `Ontology` matcher in `scripts/quality/ci-gate.mjs`.
