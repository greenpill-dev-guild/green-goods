# ADR-020: Campaigns to Seasons

**Date**: 2026-07-11  
**Status**: Accepted — Afo, 2026-07-12

**Acceptance record**: Afo accepted this decision on 2026-07-12. It authorizes the
completed mechanical `CampaignCookieJarPanel` extraction only; campaign vocabulary
and public compatibility remain unchanged pending their separately scoped follow-up.

## Context

The May review identified the campaign Cookie Jar as both a large, fast-moving
admin surface and a concept still being reframed. It called for the campaign →
Seasons decision before further code accreted on
`CampaignCookieJarPanel.tsx`.

The earlier Seasons stubs establish a staged model: narrative framing first,
operator-managed records after use, and an on-chain coordination primitive only
when a concrete need earns it. Their implementation inventory is stale in one
important respect: shared code does **not** export `SEASON_ONE_ID` or
`usePublicSeason`. The current v1 read-side is
`usePublicVolume`, with `SEASON_ONE_VOLUME_ID` and `SEASON_ONE_WINDOW` in
`packages/shared/src/hooks/public/usePublicVolume.ts`; it uses a hard-coded,
open-ended window and the editorial label “Season One: Onboarding &
Cultivation.” `usePublicFieldNotes` consumes that same volume window. There is
no on-chain Season entity or indexer binding today.

This decision covers the campaign Cookie Jar domain only. It does not rename
unrelated uses of “campaign,” including the separate vault-crowdfunding domain.

## Decision

Green Goods treats a **Season** as the durable public narrative and lifecycle
concept. Campaign Cookie Jars are a current mechanism that can participate in
that narrative; a Season is not synonymous with one Cookie Jar.

### 1. Evolve in three tiers

| Tier | Decision | Boundary |
| --- | --- | --- |
| v1 — narrative | Keep a hard-coded, read-side Season/Volume window and narrative metadata. Use it to frame existing activity; do not add contracts, indexer schema, or action-level Season tags. | Current `usePublicVolume` / `SEASON_ONE_VOLUME_ID` / `SEASON_ONE_WINDOW` are the code baseline, not the stale names in the original stub. |
| v2 — operator-managed | Add off-chain Season records and lifecycle tooling only after v1 has been used long enough to inform it. Operators can open, check in on, harvest, and archive a Season. | No contract primitive. The active configuration/record remains the source for public read-side framing. |
| v3 — coordination | Consider an on-chain Season primitive only after v2 has completed at least one full cycle and a concrete, shared coordination failure requires it. | Potential Hypercert binding, distribution timing, cross-garden coordination, indexer events, and an audit are future work—not a roadmap commitment. |

### 2. Adopt a deliberate rename cadence

New product concepts and newly introduced user-facing copy use **Season** /
**Seasons** for this domain. Existing campaign names are not mechanically
renamed in one pass.

1. This ADR establishes the conceptual target and scopes it to campaign Cookie
   Jars rather than every use of “campaign” in the repository.
2. The panel extraction may proceed only after this ADR is accepted. It is
   structure-only: preserve the existing public exports
   `CampaignCookieJarPanel` and `CampaignCookieJarCreateWorkspace`, behavior,
   routes, metadata, and current user-facing copy.
3. A later, dedicated rename/migration pass inventories each remaining
   campaign-Cookie-Jar API, metadata, i18n, route, and UI term. It moves
   user-facing copy and safe internal names toward Seasons, while retaining
   compatibility aliases or durable protocol/data identifiers where a rename
   would break stored data or consumers.

This sequence makes the destination clear without hiding an API or data
migration inside a component decomposition.

### 3. Leave v2 theme governance open

Before v2 leaves backlog, Afo must choose who sets a Season theme: platform,
an operator council with appropriate Hats authority, or a hybrid in which the
platform proposes and operators ratify or amend. The current preference is a
hybrid, but this ADR does not select it.

## Consequences

- v1 remains a lightweight narrative/read-side layer. The existing volume
  terminology is a compatibility implementation detail, not evidence that the
  broader Seasons UI or operator workflow has shipped.
- v2 must be informed by a real v1 cycle; it is not permission to add a Season
  database, administration workflow, or Hats authority now.
- v3 requires a named coordination trigger shared by at least two stakeholder
  groups, an audit budget, and a completed v2 cycle. “It would be nice” is not
  sufficient.
- The campaign Cookie Jar panel remains blocked for structural extraction until
  Afo accepts this ADR. Acceptance authorizes only the structure-only slice
  described above; it does not itself rename UI copy or unblock a Season
  feature implementation.
- Existing public names and campaign Cookie Jar metadata remain compatible until
  an explicit follow-up migration specifies their replacement and validation.

## Roadmap

1. **Now — ADR review:** Afo accepts, amends, or rejects this record. No status
   JSON or implementation lane changes follow from the draft alone.
2. **After acceptance — panel extraction:** Decompose
   `CampaignCookieJarPanel.tsx` into the planned component directory with
   preserved exports and stories. Do not change user-facing campaign copy in
   that PR.
3. **After extraction — rename plan:** Write and approve a bounded migration
   inventory for campaign-Cookie-Jar code and UI vocabulary, including
   compatibility treatment and `en`/`es`/`pt` copy changes.
4. **Later — v2/v3 gates:** Promote operator management only after evidence
   from v1 and a governance decision; promote on-chain coordination only when
   the stated v3 trigger criteria are met.

## Documentation hygiene

Two existing ADRs are both numbered 019:
`ADR-019-admin-canvas-route-inventory.md` and
`ADR-019-local-first-data-architecture.md`. Resolve that duplicate manually
as adjacent ADR hygiene work. This draft deliberately does not renumber either
existing file.

## Sources

- `.plans/backlog/seasons-narrative-v1/plan.todo.md`
- `.plans/backlog/seasons-operator-managed-v2/plan.todo.md`
- `.plans/ideas/seasons-coordination-mechanic-v3/plan.todo.md`
- `.plans/reviews/2026-05-month-in-review.md` §§3.5 and 5
- `packages/shared/src/hooks/public/usePublicVolume.ts`
- `packages/shared/src/hooks/public/usePublicFieldNotes.ts`
