# Public Supporters / Partnerships Section

**Slug**: `public-supporters-band`
**Stage**: `backlog` (state: `investigate-further`)
**Priority**: `p2`
**Created**: `2026-04-28`
**Sibling plan**: `.plans/active/public-read-side-journal/`

## Problem

The public site has no surface for partnerships, supporters, ecosystem
collaborators, or infrastructure backers. Grant docs (NLnet, Vrbs, Octant)
name partners (Hypercerts Foundation, GreenPill Network, Vrbs, Octant) but
none of that surfaces on `greengoods.app`. Funders/visitors who land on the
public homepage cannot see who is behind or supporting Green Goods.

## Desired Outcome

- Visitors can see, on the public website, the partners and supporters
  backing Green Goods.
- Treatment matches the editorial Warm Earth voice (no "logo soup",
  no marketing-banner energy).
- Content model is simple enough that Afo can update partners without
  shipping code (typed module is fine for v1; CMS is overkill).
- Surface is reusable across `/`, `/impact`, and possibly `/gardens/:id`
  without each page reinventing the layout.

## Scope Notes

- In scope (when activated):
  - One reusable component (`PublicSupportersBand`) in `packages/client`.
  - Typed content module (mirroring `publicCuration.ts`) for partner data.
  - At least one placement (homepage after `PublicProofBand` is the
    leading candidate).
  - Real partner logos sourced and stored under `/public/partners/`.
  - Honest fallback when no partners are configured (hide section).
  - en/es/pt copy for kicker, h2, optional blurb.

- Out of scope:
  - Garden-scoped supporters (Vault depositor display) — separate plan
    once Vault depositor data is curated for public consumption.
  - Funder profile pages — out of scope for v1.
  - Logo-submission form — partners are curated, not self-serve.
  - Replacing existing internal `useFunders` / `app.funders.*` PWA UI —
    that stays internal.

## Investigate-Further Questions

These need Afo's input before turning the plan active:

1. **Audience**: Green Goods–level partners (Hypercerts, Octant, GreenPill,
   Vrbs) or also Garden-level supporters (Vault depositors)? Different
   placements and content models.
2. **Placement priority**:
   - Homepage band after `PublicProofBand` (proposed default).
   - `/impact` "Backed by" section above evidence cards.
   - `/gardens/:id` per-Garden supporters rail.
   - Footer in `PublicShell` (lowest cost, lowest status).
3. **Logo treatment**: monochrome with hover color vs full color? Aligned
   row vs free-form grid?
4. **Tier semantics**: do we differentiate `partner` vs `supporter` vs
   `infrastructure` vs `ecosystem` visually, or treat all as "backed by"?
5. **Permission**: do all named partners (Hypercerts, Octant, etc.) have
   an explicit OK to be displayed on the public site?

## Success Signal

A first-time visitor lands on `/`, scrolls past ProofBand, and sees a
short, editorial credibility statement: "Built with [Hypercerts /
GreenPill / Octant / Vrbs / ...]" — without it feeling like a SaaS
landing page.

## Status

`investigate-further` — do not implement until Afo answers the questions
above and the parent `public-read-side-journal` regressions are landed.
