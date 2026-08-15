# Seasons Roadmap Specification

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

**Decision accepted**: 2026-07-12 by Afo  
**Scope**: campaign Cookie Jars only

This specification owns the current Campaign-to-Seasons decision. A Season is a
durable public narrative and lifecycle concept; it is not synonymous with a Cookie
Jar. The separate vault-crowdfunding domain and unrelated uses of "campaign" are out
of scope.

## Current implementation baseline

- The v1 read side is `usePublicVolume`, `SEASON_ONE_VOLUME_ID`, and
  `SEASON_ONE_WINDOW` in
  `packages/shared/src/hooks/public/usePublicVolume.ts`.
- `usePublicFieldNotes` consumes the same volume window.
- The current window is hard-coded and open-ended, with the editorial label
  "Season One: Onboarding & Cultivation."
- There is no on-chain Season entity or indexer binding.

Historical names such as `SEASON_ONE_ID` and `usePublicSeason` are stale inputs, not
current APIs.

## Tier contract

| Tier | Decision | Promotion gate |
| --- | --- | --- |
| **v1 — narrative** | Keep a configured read-side Season/Volume window and narrative metadata. Do not add contracts, indexer schema, or action-level Season tags. | A bounded narrative pass with current routes, copy, locales, and browser proof. |
| **v2 — operator managed** | Add off-chain Season records and lifecycle tooling only after v1 usage supplies real evidence. The active configuration/record remains the public read-side source. | A completed v1 cycle plus a written governance choice for who opens, edits, and closes a Season. |
| **v3 — coordination** | Consider an on-chain primitive only after v2 completes a full cycle and a shared coordination failure requires it. | A named need shared by at least two stakeholder groups, an approved model, and an audit budget. |

## Rename and compatibility contract

New concepts and newly introduced user-facing copy may use **Season** for this domain,
but existing campaign names are not mechanically renamed in one pass.

1. Inventory campaign-Cookie-Jar APIs, metadata, i18n, routes, and UI terms before a
   rename.
2. Preserve compatibility aliases and durable protocol/data identifiers wherever a
   rename would break stored data or consumers.
3. Keep the completed `CampaignCookieJarPanel` extraction structure-only: its public
   exports, behavior, routes, metadata, and existing copy remain compatible.
4. Treat any rename as its own bounded plan with `en`, `es`, and `pt` coverage plus
   current browser proof.

## Open governance decision

Before v2 can leave ideas/backlog, Afo must choose whether themes are set by the
platform, an operator council with appropriate Hats authority, or a hybrid where the
platform proposes and operators ratify or amend. Hybrid is the current preference,
not an accepted decision.

## Constraints

- Do not use “season” as a cosmetic rename for unrelated campaign behavior.
- Do not promote v2/v3 because historical source plans exist.
- Any promoted tier becomes its own standard backlog hub with current paths,
  acceptance criteria, and validation.
