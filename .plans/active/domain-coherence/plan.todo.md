# Domain Coherence — Action Domains × Impact Dimensions

**Slug**: `domain-coherence`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2` (outcome-shaping; pairs with `yield-to-impact-codification`)
**Branch**: `feature/domain-coherence` (when implementation begins)

## Why this exists

Green Goods has **action domains** (the 5 categories of regenerative work in `v1-0.mdx § 3.4`: Solar Infrastructure, plus 4 others) — these are *where* work happens. It has *implicit* **impact dimensions** (community, environmental, social, cultural, ecological — named by Afo on 2026-04-25) — these are *what* work produces. The relationship between the two is currently fragmented across spec docs, prompt contracts, and operator intuition.

This plan codifies the conceptual model so that:
- Every action domain has a defined dimension footprint (what it tends to produce).
- Every action template inherits a default vector that operators can refine.
- Impact reporting surfaces (admin, journal) speak the same language about what each garden's work produced.
- The `yield-to-impact-codification` plan has a coherent dimension model to consume.

This is **conceptual + type-system work** in the first instance — not UI. UI consumers (admin reports, journal `/impact`, grant-export artifacts) come downstream.

## Inputs / state

- **Existing**:
  - 5 action domains documented in `v1-0.mdx § 3.4` (Solar Infrastructure named explicitly; 4 others implied).
  - `docs/docs/builders/specs/v1-0.mdx` — canonical v1 spec, including Personas and action-domain references.
  - `docs/docs/builders/architecture/erd.mdx` and `docs/docs/builders/integrations/entity-matrix.mdx` — current entity model references.
  - `docs/docs/reference/glossary-community.md` — canonical vocabulary reference.
  - `docs/docs/builders/specs/greenwill-gif-*` — proposal-level framing for impact.
- **Missing**:
  - Formal definition of the 5 dimensions as types.
  - Domain × dimension mapping matrix (which domains tend to produce which dimensions, in what proportion).
  - Per-action-template default dimension vector.
  - Operator-side override path (when a specific Garden's Solar work also delivers strong cultural impact, can the operator say so?).

## Approach

1. **Read the spec layer end to end** — `v1-0.mdx`, `greenwill-gif-*.md`, `greenwill-badging-impact-framework-2026-03.md`, `entity-matrix.mdx`, `erd.mdx`, and the `regenerative.md` and `ecosystem.md` design skill files. Inventory every mention of domain or dimension.
2. **Name the 5 dimensions formally** — single-source-of-truth definition in a new `docs/docs/builders/specs/impact-dimensions.mdx`. For each dimension: definition, examples of evidence that counts, examples of evidence that does not, sample metrics.
3. **Domain × dimension matrix** — for each of the 5 action domains: which dimensions does this domain typically produce, with what relative weight. Document in `docs/docs/builders/specs/impact-dimensions.mdx` as a table. This becomes the seed for default vectors.
4. **Type-level codification** — `ImpactDomain` and `ImpactDimension` enums in `@green-goods/shared`; `DimensionVector` type (5-tuple of weights, normalized); domain-to-default-vector lookup.
5. **Per-action-template vector** — every Action template gets a default vector (derived from its domain). Operators can refine per-template. Stored either off-chain (db) or as a metadata field on the on-chain Action template — confirm in discovery.
6. **Operator override surface** (admin) — minimal: when an operator creates or edits an Action template, they see the default vector and can adjust weights. Out of scope for v1 if the per-template vector is enough.

## Constraints

- Conceptual codification first; UI second. No journal or admin surface work in this plan beyond the optional operator override. The yield-to-impact plan consumes the dimension model.
- Single source of truth: the dimensions and matrix live in `docs/docs/builders/specs/impact-dimensions.mdx`. Code, glossary, and prompt contracts reference that doc.
- Backwards compatibility: existing Action templates inherit a default vector based on their domain — no manual migration burden.
- No new contracts. If on-chain anchoring of vectors is required, defer to a follow-up.
- Vocabulary lint compliance: dimension names land in canonical glossary (per `vocabulary-glossary-consolidation` plan).

## Open questions to resolve in discovery

- **5 vs more dimensions**: are community / environmental / social / cultural / ecological the final list, or do we expect to add (economic, governance, regenerative-specific)? Lock the count before codifying types.
- **Vector normalization**: weights sum to 1.0 (normalized) or independent (each 0-1 absolute)? Normalized is cleaner; absolute is more honest about "low impact across all dimensions."
- **Domain count**: v1-0.mdx names Solar Infrastructure explicitly; what are the other 4? Confirm before codifying domain enum.
- **Override authority**: does override require Evaluator certification, or is operator self-attestation enough for v1? Self-attestation default; Evaluator gating is a future enhancement.
- **Cross-domain actions**: an Action template could span multiple domains (e.g., a school garden = Solar + Cultural + Community). Is the action's domain a singleton or a set?

## Success

- `docs/docs/builders/specs/impact-dimensions.mdx` exists with: dimension definitions, evidence guidelines, domain-to-dimension matrix, sample metrics per dimension.
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

- [ ] Read v1-0.mdx § 3.4 + greenwill-gif-* + greenwill-badging-impact-framework + entity-matrix.mdx + erd.mdx + regenerative.md + ecosystem.md.
- [ ] Confirm the 5 dimensions and 5 domains (count + names).
- [ ] Author `docs/docs/builders/specs/impact-dimensions.mdx` with definitions + matrix.
- [ ] `ImpactDomain` / `ImpactDimension` enums + `DimensionVector` type in `@green-goods/shared`.
- [ ] Domain → default-vector lookup function with tests.
- [ ] Per-Action-template default vector derivation.
- [ ] Reference the doc from glossary + prompt contracts (via vocabulary plan).
- [ ] `bun run test && bun run lint:vocab` pass.
