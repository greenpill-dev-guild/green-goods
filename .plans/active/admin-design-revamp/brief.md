# Admin Design Revamp

**Slug**: `admin-design-revamp`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-05-02`
**Target**: `2026-05-16` (cleanup tier; Tiers 0–5 already shipped)

## Problem

The admin cockpit had drifted from the v2 design language captured in `design_handoff_admin-revamp/`:

1. No unified Warm-Earth token vocabulary — admin scattered between M3-strict and ad-hoc inline values; canvas/ink/stone never wired through to runtime variables.
2. Per-view atmosphere via `[data-workspace]` painted too many surfaces; v2 spec wanted a barely-perceptible `[data-tone]` canvas wash + a strength axis (off / subtle / default).
3. Conviction-voting UI absent — proposal cards still implied a non-existent for/against/abstain TallyCard.
4. Information-architecture mismatch — Garden carried "Impact" (which Hub Certify+History abstracts); Community used "Members" where the user-facing framing is broader (funders + supporters + contributors).
5. No canonical decisions log — Tier 0 audit findings + flag-back questions had nowhere durable to land.

## Desired Outcome

- Admin renders Warm-Earth tokens consistently with tone-aware canvas wash + handoff-aligned status palette, scoped to admin (client PWA unaffected).
- Five Tier 2/3 atoms+organisms ship and mount inside Community → Governance (`GovernancePanel`); Garden Members tab surfaces real gardener/operator data.
- Garden tabs restructure to Overview / Activity / Members / Settings; Community renames Members → People; legacy URLs (`/garden/impact/*`) still resolve (no 404s).
- Every locked decision in the audit (audit §5) is recorded, dated, and referenced from at least one commit.
- Sibling agents have a coordination contract embedded in their plan files (signal-pool-yield-wiring is the live example).

## Scope Notes

- **In scope**: token system, atoms/molecules, organisms, screen recompose, IA changes, conviction-wiring adapter hooks + GovernancePanel mount, Garden Members roster.
- **Out of scope** (deferred to cleanup tier or downstream features):
  - Conviction pool-config reads (decay rate, points-per-voter, member count) — waits on `signal-pool-yield-wiring` UI lane.
  - Per-member supporter count — needs a `useHypercertSupporters` hook.
  - Threshold formula reverse-engineering — stable derivation API, math is approximate.
  - FAB action registration per view (Hub / Garden / Community / Actions).
  - Garden Activity tab content — no per-garden work-feed source today; plot/planting/milestone events not on-chain yet.
  - 21 failing client-homepage tests from commit `0b4a67e8` (separate agent's editorial polish).
  - Unit tests for `percent-points.ts` + `derivation.ts`; integration test for `useConvictionWeightAllocator` round-trip.

## Success Signal

A solo operator navigates Hub → Garden → Community → Actions and sees consistent Warm-Earth tokens, the tone-aware canvas wash, and the conviction-voting surface inside Community → Governance. The audit at `docs/admin-revamp/audit.md` reads as a single coherent decisions log. Sibling agents working on `/community` (signal-pool-yield-wiring's UI lane is the first) reach the right adjacency notes before they start coding.

## Canonical Artifacts

- Audit + decisions log: [`docs/admin-revamp/audit.md`](../../../docs/admin-revamp/audit.md) (committed in `c228fa12`).
- Handoff bundle: [`design_handoff_admin-revamp/`](../../../design_handoff_admin-revamp/) (committed in `bfc841c3`).
- Upstream context (the briefs that produced the handoff bundle): [`.plans/active/admin-claude-design-export/`](../admin-claude-design-export/).
