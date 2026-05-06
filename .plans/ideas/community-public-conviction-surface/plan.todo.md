# Community Member Public Conviction Surface

**Slug**: `community-public-conviction-surface`
**Status**: `IDEA`
**Created**: `2026-04-25`
**Priority**: `p2` (closes the most concrete persona gap in current code)
**Branch**: `feature/community-public-conviction-surface` (when promoted)

> Moved to ideas on 2026-04-27. Current public-read-side work intentionally avoids public conviction voting; revisit this only after the public browser direction settles and a concrete community-member allocation need returns.

## Why this exists

`v1-0.mdx § 3.1` names Persona E (Community Member) and explicitly identifies their **key interface as "Public Signal Feed and Gardens Conviction Voting."** The journey-codification agent (2026-04-25) confirmed the conviction hooks already exist and are wired — but only into admin Community / Strategies / SignalPool views. There is **no public PWA view** in `packages/client/src/views/Public/` that lets a community member allocate signal. Persona E is the most under-served persona in the codebase right now.

This plan closes that gap with a minimal, focused public surface — not a redesign of conviction, just a public consumer of the existing primitives.

## Inputs / state

- **Hooks already shipped** (in `@green-goods/shared`, used by admin):
  - `useAllocateHypercertSupport` — allocate signal to a hypercert.
  - `useHypercertConviction` — read conviction state.
  - `useGardenPools` — pool-level conviction.
  - `useRegisteredHypercerts` — what's registerable.
- **Admin consumers** (already wired): `packages/admin/src/views/Community/`, Strategies / SignalPool views.
- **Public consumer (gap)**: no view in `packages/client/src/views/Public/` consumes these hooks.
- **Spec reference**: `docs/docs/builders/specs/v1-0.mdx § 3.1` Persona E + JTBD "Community Prioritization."
- **Journey doc**: `docs/docs/builders/journeys/persona-surfaces.mdx` (when journey docs land) will reference this gap.

## Approach

1. **Discovery** — read the admin Community / Strategies / SignalPool views to understand the current conviction allocation UX. Identify the minimum viable public allocator surface.
2. **Public surface** — add a public conviction allocator inside one of the four canonical public routes. Probably `/impact` (since signal allocation is an impact-prioritization act) or `/gardens` (per-garden allocation). **Do NOT add a new route**; layer onto an existing one per `feedback_stitch_visual_only`.
3. **Auth boundary** — allocation requires identity (the community member needs an address). Wallet connect at the moment of allocation, not on entry to the surface. Read paths (showing what's allocatable, what's currently funded) are public.
4. **Mobile-first**: Persona E is on a phone. PWA-native feel inside the browser surface; install path remains the upgrade.

## Constraints

- **No new routes** beyond the existing four (`/gardens` `/impact` `/fund` `/actions`).
- Use existing conviction hooks; do not duplicate logic in client.
- Wallet connect at allocation step only (matches the funder flow pattern in `Fund.tsx`).
- Strict offline-correctness for read; allocation is a write so requires connectivity.
- All other read-side constraints apply (Warm Earth, semantic tokens, no console.log, Address type).
- Vocab lint compliance.

## Success

- A community member visiting `/impact` (or `/gardens`) from their phone can see what's allocatable, see current conviction state, and allocate signal — wallet connection prompted only at allocation.
- Existing admin Community surfaces continue to work unchanged.
- `bun run lint && bun run lint:vocab && bun run test && bun build` pass.

## Out of scope

- Redesign of conviction mechanic.
- Cross-platform (Coop/WEFA) signal aggregation.
- New conviction primitives in shared.
- Reputation surface for community members beyond what's needed for allocation.

## Promotion criteria

Promote from backlog when:
- `seasons-narrative-v1` and `public-read-side-journal` have shipped (existing public surfaces are visually upgraded so the conviction allocator lands on a coherent surface, not a basic-Tailwind one).
- OR Tier 1 onboarding bundle has shipped (so community members can actually reach this surface as the platform grows).

## Checklist (when promoted)

- [ ] Read admin Community / Strategies / SignalPool views.
- [ ] Decide layering (`/impact` vs `/gardens` vs split).
- [ ] Public conviction allocator component.
- [ ] Wallet-connect-at-allocation flow (mirror `Fund.tsx`).
- [ ] Mobile QA at 375 / 768.
- [ ] Validation suite green.
