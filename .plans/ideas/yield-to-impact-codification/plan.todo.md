# Yield-to-Impact Codification

**Slug**: `yield-to-impact-codification`
**Status**: `IDEA / MAY EXPLORATION`
**Created**: `2026-04-25`
**Priority**: `p2` (outcome-shaping work; not a polish blocker but high strategic value)
**Branch**: `feature/yield-to-impact-codification` (when implementation begins)

## Scheduling Update — 2026-04-26

Moved out of active product execution. Treat May as research/exploration and defer implementation until the `domain-coherence` model is stable, likely June.

Do not merge this into `domain-coherence` yet: the overlap is real, but the responsibilities are different. `domain-coherence` owns the domain/dimension model; this plan owns the yield-to-impact curve, hooks, indexer shape, and downstream reporting surfaces that consume that model.

## Why this exists

The platform produces yield (vault distributions, hypercert sales, cookie-jar inflows) and produces impact (work attestations, assessments, evidence corpus). What it doesn't yet have is a **codified curve** that maps yield to impact across multiple dimensions. Without that mapping, the platform can show outputs (TVL, work submissions, hypercerts minted) but cannot show **outcomes** (what unit of yield produced what unit of multidimensional impact).

This is the measurement primitive Afo named on 2026-04-25:

> "The outcome is to gain coherency around our domains and how we evaluate impact, our yield to impact metrics, the yield to impact curve, and understanding more coherently how the work that's being done translates to both community, environmental, social, cultural, and ecological impact."

The yield-to-impact curve is upstream of every outcome conversation. Without it, Season Two success can only be answered with output metrics. With it, the journal becomes a citation engine (gardens cite the curve in their own grant applications), funder reporting becomes outcome-grounded, and Hypercerts get a meaningful denomination beyond "work bundle."

This plan is paired with `domain-coherence` (its own plan) — yield-to-impact handles the financial → impact transformation, while domain-coherence handles the conceptual model of impact dimensions and how action domains translate into them.

## Strategic frame

- **Inputs** (already captured): vault deposits, vault yield, cookie jar contributions, hypercert sales, work attestations, assessments.
- **Dimensions** (to codify): community, environmental, social, cultural, ecological. These are the impact axes named by Afo. Each garden's work resolves to a vector across them, weighted by domain.
- **Curve** (the deliverable): for a given yield input over a given Season window, what vector of impact is produced? Per-garden, per-Season, per-dimension.
- **Surface** (downstream consumers):
  - Admin Funder Dashboard: "your $X yield this Season produced [community/environmental/social/cultural/ecological] vector Y."
  - Journal `/impact`: network-wide curve visualization.
  - Garden permalinks (where they exist): per-garden curve as an exportable artifact for the garden's own grant applications.
  - Hypercert denomination: bundle-level impact vector at mint time.

## Inputs / state

- **Existing capture**:
  - Vault history + yield split history indexed (per `CLAUDE.md` Indexer Boundary).
  - Work attestations (EAS) with action domain references.
  - Assessments (EAS) with structured impact data.
  - Hypercerts (minimal linkage / claims indexed).
- **Existing framing docs**:
  - `docs/docs/builders/specs/greenwill-gif-one-pager-2026-03.md` — GIF proposal (per Afo: "We have the yield impact work being outlined with our offer proposal").
  - `docs/docs/builders/specs/greenwill-gif-evaluation-plan-2026-03.md`.
  - `docs/docs/builders/specs/greenwill-badging-impact-framework-2026-03.md`.
  - `docs/docs/builders/specs/v1-0.mdx § 3.4` — 5 action domains.
  - `docs/docs/builders/architecture/erd.mdx` and `docs/docs/builders/integrations/entity-matrix.mdx` — current entity model references.
  - `docs/docs/reference/glossary-community.md` — canonical vocabulary reference.
- **Missing**:
  - First-class impact dimensions (community / environmental / social / cultural / ecological) as types in shared.
  - Mapping from action domains × work output → dimensional impact vectors.
  - Yield → impact transformation function (per garden, per Season).
  - Indexer events that capture the transformation outputs.
  - Surfaces that visualize the curve.

## Approach (high-level — implementation detail emerges with discovery)

1. **Discovery** — read the GIF proposal docs + v1 spec + ERD + entity matrix. Document: what dimensions are already partially defined, what's missing, where the gaps are between v1-0.mdx domains and the 5 dimensions Afo named.
2. **Conceptual codification** (paired with `domain-coherence` plan) — name the 5 dimensions formally, define how each of the 5 action domains maps to a dimension vector (likely a domain × dimension matrix with weights).
3. **Type-level codification** — `ImpactDimension`, `ImpactVector`, `YieldImpactCurve` types in `@green-goods/shared`. Pure, no UI.
4. **Indexer extension** — events / GraphQL fields for the transformation outputs (yield consumed, impact vector produced, per Season per garden).
5. **Service / hook layer** — `useYieldImpactCurve(gardenAddress?, seasonId?)` returning the vector per garden per Season; `useNetworkImpactCurve()` for aggregates.
6. **Surfaces (Tier 1)**:
   - Admin Funder Dashboard component visualizing the per-garden curve.
   - Journal `/impact` extension surfacing the network curve (replaces or augments the current oracle-metric tiles).
7. **Surfaces (Tier 2 — optional, future)**:
   - Per-garden exportable PDF citation (the "grant application artifact").
   - Hypercert denomination shown at mint time.

## Constraints

- The curve must be **derivable, not asserted** — every vector should trace to underlying work + assessments + yield events.
- Indexer scope (CLAUDE.md): the transformation can be indexed if it's deterministic from on-chain state; if it requires off-chain expert judgment (Evaluator certification), keep the off-chain piece off-chain and the on-chain anchoring minimal.
- No new contract complexity unless absolutely required — this plan is mostly types + indexer + UI; contract changes are last resort.
- Privacy: gardener-level data does NOT surface in public impact curves; aggregate only.
- All motion / token / vocabulary rules apply to UI surfaces.

## Open questions to resolve in discovery

- **Dimension-to-domain mapping authority**: who defines the matrix? Platform team initially, with intent to move toward Operator / Evaluator / community input later.
- **Single curve vs per-domain curve**: does each action domain (Solar, Water, Soil, etc.) have its own yield-to-impact curve, or is there one master curve weighted by domain? My instinct: per-domain curves aggregated to a master view.
- **Time resolution**: per-Season is the natural unit; sub-Season (monthly?) granularity may be useful for trend lines.
- **Evaluator role in transformation**: Evaluator certification adjusts vector weights or just gates publication?
- **Integration with Hypercerts**: bundle-level vector at mint, or per-Hypercert-claim vector?

## Success

- Documented dimension model + domain-to-dimension mapping in `docs/docs/builders/specs/yield-to-impact.mdx`.
- Typed `ImpactDimension` / `ImpactVector` / `YieldImpactCurve` in `@green-goods/shared`.
- Indexer schema additions land deterministically on existing events (no new contracts in v1).
- `useYieldImpactCurve` and `useNetworkImpactCurve` hooks ship with tests.
- Admin Funder Dashboard surfaces a real curve for at least one Season One garden.
- Journal `/impact` shows network curve.
- A garden Operator can point a funder at the curve as evidence in a grant application.

## Out of scope

- New Hypercert denomination logic in v1 (notes only; deferred to Tier 2).
- Evaluator-side certification UI (per Afo, not in scope this round).
- Cross-platform impact aggregation (Coop / WEFA contributions to GG impact).
- Real-time IoT / Silvi oracle integration for environmental/ecological dimensions (depends on `External Data Partnerships` epic #465).

## Checklist

- [ ] Discovery doc summarizing GIF proposal alignment + dimension definitions in `docs/docs/builders/specs/yield-to-impact.mdx`.
- [ ] Domain × dimension mapping matrix (paired with `domain-coherence` plan).
- [ ] Types in `@green-goods/shared` (`ImpactDimension`, `ImpactVector`, `YieldImpactCurve`).
- [ ] Indexer schema extension if deterministic; design doc for any contract anchor needed.
- [ ] `useYieldImpactCurve` + `useNetworkImpactCurve` hooks with tests.
- [ ] Admin Funder Dashboard curve component.
- [ ] Journal `/impact` network curve surface.
- [ ] Validation suite green.
