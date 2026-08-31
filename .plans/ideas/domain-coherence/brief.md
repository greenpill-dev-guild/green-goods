# Domain Coherence — Action Domains × Impact Dimensions

**Slug**: `domain-coherence`
**Status**: `IDEA / MAY EXPLORATION`
**Created**: `2026-04-25`
**Priority**: `p2` (outcome-shaping; pairs with `yield-to-impact-codification`)
**Branch**: `feature/domain-coherence` (when implementation begins)

## Scheduling Update — 2026-04-26

Moved out of active product execution. Treat May as research/exploration for the domain and dimension model, with implementation deferred to June.

Keep this paired with `yield-to-impact-codification`: this plan owns the conceptual domain/dimension model, while yield-to-impact owns the measurement curve that consumes it.

## Why this exists

Green Goods has four production **action domains** in `packages/shared/src/ontology/green-goods-ontology.json` — Solar, Agroforestry, Education, and Waste — describing *where* work happens. It also has proposed **impact dimensions** (community, environmental, social, cultural, ecological — named by Afo on 2026-04-25) describing *what* work produces. The relationship between the two is not yet codified.

This plan codifies the conceptual model so that:
- Every action domain has a defined dimension footprint (what it tends to produce).
- Every action template inherits a default vector that operators can refine.
- Impact reporting surfaces (admin, journal) speak the same language about what each garden's work produced.
- The `yield-to-impact-codification` plan has a coherent dimension model to consume.

This is **conceptual + type-system work** in the first instance — not UI. UI consumers (admin reports, journal `/impact`, grant-export artifacts) come downstream.

## Inputs / state

- **Existing**:
  - Four production action domains declared in `packages/shared/src/ontology/green-goods-ontology.json` and drift-checked against code.
  - `docs/docs/builders/architecture/erd.mdx` and `docs/docs/builders/integrations/entity-matrix.mdx` — current entity model references.
  - `docs/docs/reference/glossary.generated.mdx` — generated vocabulary reference (authority: `packages/shared/src/ontology/green-goods-ontology.json`).
  - This hub and `yield-to-impact-codification` retain the durable framing from the historical GreenWill/GIF proposal set; exact proposal text remains in Git history.
- **Missing**:
  - Formal definition of the 5 dimensions as types.
  - Domain × dimension mapping matrix (which domains tend to produce which dimensions, in what proportion).
  - Per-action-template default dimension vector.
  - Operator-side override path (when a specific Garden's Solar work also delivers strong cultural impact, can the operator say so?).

## Approach

1. **Read the authority layer end to end** — the ontology, entity matrix, ERD, this hub, `yield-to-impact-codification`, and the regenerative/ecosystem design guidance. Inventory every mention of domain or dimension.
2. **Name the dimensions formally** — extend the ontology with definitions, examples of qualifying and non-qualifying evidence, and sample metrics after the taxonomy is accepted.
3. **Domain × dimension matrix** — for each of the four action domains, define which dimensions it typically produces and with what relative weight. Store the machine-readable matrix with the ontology and generate its documentation projection.
4. **Type-level codification** — `ImpactDomain` and `ImpactDimension` enums in `@green-goods/shared`; `DimensionVector` type (5-tuple of weights, normalized); domain-to-default-vector lookup.
5. **Per-action-template vector** — every Action template gets a default vector (derived from its domain). Operators can refine per-template. Stored either off-chain (db) or as a metadata field on the on-chain Action template — confirm in discovery.
6. **Operator override surface** (admin) — minimal: when an operator creates or edits an Action template, they see the default vector and can adjust weights. Out of scope for v1 if the per-template vector is enough.

## Constraints

- Conceptual codification first; UI second. No journal or admin surface work in this plan beyond the optional operator override. The yield-to-impact plan consumes the dimension model.
- Single source of truth: the accepted dimensions and matrix live in the ontology and are projected into generated documentation. Code and human guidance reference that contract.
- Backwards compatibility: existing Action templates inherit a default vector based on their domain — no manual migration burden.
- No new contracts. If on-chain anchoring of vectors is required, defer to a follow-up.
- Vocabulary lint compliance: dimension names land in canonical glossary (per `vocabulary-glossary-consolidation` plan).

## Open questions to resolve in discovery

- **5 vs more dimensions**: are community / environmental / social / cultural / ecological the final list, or do we expect to add (economic, governance, regenerative-specific)? Lock the count before codifying types.
- **Vector normalization**: weights sum to 1.0 (normalized) or independent (each 0-1 absolute)? Normalized is cleaner; absolute is more honest about "low impact across all dimensions."
- **Domain stability**: the current closed set is Solar, Agroforestry, Education, and Waste. Decide whether impact dimensions can evolve without changing that domain enum.
- **Override authority**: does override require Evaluator certification, or is operator self-attestation enough for v1? Self-attestation default; Evaluator gating is a future enhancement.
- **Cross-domain actions**: an Action template could span multiple domains (e.g., a school garden = Solar + Cultural + Community). Is the action's domain a singleton or a set?

## Success

- The ontology contains dimension definitions, evidence guidelines, a domain-to-dimension matrix, and sample metrics, with a deterministic documentation projection.
- `ImpactDomain` and `ImpactDimension` types in `@green-goods/shared` with the matrix as data.
- Existing Action templates have default vectors derivable from their domain.
- `yield-to-impact-codification` plan can consume `DimensionVector` from shared without duplicating the model.
- Vocabulary lint passes; new dimension names land in the canonical glossary.

## Out of scope

- UI for visualizing dimension vectors (that's `yield-to-impact-codification` territory).
- Evaluator certification of dimension vectors (deferred).
- Hypercert denomination by dimension (deferred).
- Cross-platform dimension aggregation (Coop / WEFA → GG).
- Per-garden / per-Season aggregation surfaces (downstream of yield-to-impact).

## Checklist

- [ ] Read the ontology, this hub, yield-to-impact framing, entity matrix, ERD, regenerative guidance, and ecosystem guidance.
- [ ] Confirm the 5 dimensions and 5 domains (count + names).
- [ ] Author the impact-dimension definitions + matrix in this hub's `spec.md` (authored docs spec pages were retired in the docs-authority migration; the public surface generates from the ontology).
- [ ] `ImpactDomain` / `ImpactDimension` enums + `DimensionVector` type in `@green-goods/shared`.
- [ ] Domain → default-vector lookup function with tests.
- [ ] Per-Action-template default vector derivation.
- [ ] Reference the doc from glossary + prompt contracts (via vocabulary plan).
- [ ] `bun run test && bun run lint:vocab` pass.
