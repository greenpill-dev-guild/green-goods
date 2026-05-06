# Seasons — Narrative v1 (hardcoded config + UI surfaces)

**Slug**: `seasons-narrative-v1`
**Status**: `BACKLOG` — queued for **early May** per Afo (UI surfaces deferred until other margin work finishes)
**Created**: `2026-04-25`
**Priority**: `p1` (when promoted)
**Branch**: `feature/season-narrative-v1` (when promoted)

> Moved to backlog 2026-04-25 with explicit early-May trigger. The hook-side work (Season config constants, time-window filters) already shipped via `public-read-side-journal` Lane B. The remaining UI consumption (Season framing, Hub Season ribbon, gardener Season banner) waits until the public read-side and admin polish bundle land.

## Why this exists

Season-as-narrative is the lightweight Seasons primitive. UI surfaces the current Season transparently; data layer pulls from a hardcoded config and uses time-window filters on existing Works to compute Season-scoped views. **No action tagging** — Actions are Season-agnostic templates; only the time window of individual Work attestations defines Season membership. **No contract change.** **No indexer schema change.**

This is the canonical Season narrative layer that remains after treating external visual references as visual-only input.

## Current state (already shipped via `public-read-side-journal` Lane B)

- ✅ `SEASON_ONE_ID` and `SEASON_ONE_WINDOW` exported from `@green-goods/shared` (location: in the public hooks barrel; verify exact path before consuming).
- ✅ `usePublicSeason(seasonId)` returns Season-scoped aggregates filtered by time window — active gardens, action/contributor/attestation counts.
- ❌ UI consumption: Season label primitive, Hub Season ribbon, gardener Season banner.
- ❌ Season metadata richness: theme description, narrative opener, success criteria.

## Approach

1. **Extend the existing Season config** co-located with the constants: add `name` ("Season One"), `theme` (one-line: "Onboarding, new growth, refining domains for coherence"), `narrative` (longer opener used on the public browser Season section), `successCriteria` (display-only for now). Type the config.
2. **Read-side public browser**: build a `SeasonLabel` primitive; consume config to render the active Season name prominently on public browser surfaces and as a section divider where useful.
3. **Admin**: persistent Season ribbon on Hub showing current Season name + days-since-open. Filter chip on Actions / Hypercerts / Vault views: default = current Season window, archive accessible. Strict M3 anatomy — no glass on the ribbon.
4. **Client PWA Home**: subtle Season banner — "You're contributing to Season One: Cultivation." Warm Earth full expression. Below the fold, not blocking.
5. **Client PWA Profile**: per-Season contribution count using the public Season filter.

## Constraints

- **No indexer schema change** — Season metadata lives in shared config only.
- **No contract change** — no on-chain Season primitive.
- **No action-level seasonId tagging** — Actions remain Season-agnostic; time-window filtering on Work attestations is the only Season scoping mechanism.
- **Single source of truth**: one config file in `@green-goods/shared` defines Season metadata; admin/client/journal all read from it.
- All motion via spring tokens; no hardcoded `cubic-bezier` or duration literals.
- React patterns (`.claude/rules/react-patterns.md`) and TypeScript rules apply.
- Vocabulary: client copy avoids `streak`, `countdown`, `leaderboard`, `dashboard`. Admin avoids glass on Season ribbon.

## Open governance question (parking, not blocking)

When Season One closes and Season Two opens, **who decides the theme**? Afo leans toward a **hybrid** approach (platform proposes given gardener input, Operators ratify). Final decision deferred to `seasons-operator-managed-v2` — narrative-v1 ships with Season One only, no theme-creation UI yet.

## Out of scope

- Operator-managed Seasons (theme creation, harvest workflow, off-chain Season records) → `seasons-operator-managed-v2` (backlog)
- Coordination mechanics (hypercert binding to Season, vault distribution gating) → `seasons-coordination-mechanic-v3` (backlog)
- Action tagging by Season — explicitly rejected.

## Success

- Funder/visitor sees Season One editorial framing as the active narrative chapter on the public browser surface.
- Operator sees Season state at a glance on Hub; can filter by Season scope.
- Gardener sees they're contributing to a named Season on Home; their Profile shows Season contribution count.
- All Season metadata changes via a single config edit; no UI hardcodes "Season One" in copy or routes outside the config consumer.

## Checklist

- [ ] Extend Season config with `name` / `theme` / `narrative` / `successCriteria` (typed).
- [ ] `SeasonLabel` primitive (coordinate with `public-read-side-journal` public browser components).
- [ ] Admin Hub Season ribbon (strict M3 anatomy).
- [ ] Admin filter chips on Actions / Hypercerts / Vault (default = current Season).
- [ ] Client PWA Home Season banner (Warm Earth).
- [ ] Client PWA Profile per-Season contribution count.
- [ ] `bun run lint && bun run lint:vocab && bun run test && bun build` pass.
