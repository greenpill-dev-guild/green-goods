# Seasons — Operator-Managed (v2, backlog)

**Slug**: `seasons-operator-managed-v2`
**Status**: `BACKLOG`
**Created**: `2026-04-25`
**Priority**: `p2` (after `seasons-narrative-v1` ships and we've used it long enough to know what's missing)
**Branch**: `feature/seasons-operator-managed-v2` (when promoted)

## Why this exists

Promote Seasons from hardcoded config to operator-creatable records. Stewards (or hybrid governance — see Open Question) open Season Two with a theme, time window, and success criteria; admin gets a harvest workflow at close. Read-side gains real archived Volumes when Season One harvests.

## Depends on

- `seasons-narrative-v1` must ship first. UI surfaces and config-consuming primitives must already exist before promoting to operator-creatable records.
- At least one full Season cycle of usage on narrative-v1 — promotion should be informed by what gardeners/operators actually wanted, not speculation.

## Scope

- **Off-chain Season records** (db-backed, no contract change yet) with: `id`, `name`, `theme`, `start`, `end`, `status` (`open` / `active` / `harvest` / `closed`), `successCriteria`, `narrativeOpener`, `createdBy`, `createdAt`.
- **Admin Season management surface**: open new Season modal, mid-Season check-in publishing, harvest workflow (close window for new submissions, surface unfinalized actions, generate Season summary that auto-publishes as the next journal Volume).
- **Read-side**: archived Volumes navigable (`/stories/season-one`, `/stories/season-two` pattern); current Volume reflects active Season; transitions surfaced narratively ("Season One harvested · Season Two now open").
- **Strict M3 anatomy** for admin Season surfaces (sheet-based, no glass except AppBar).
- **Hats authority** for who can open/close Seasons — see governance question.

## Open governance question (must answer before promoting from backlog)

When Season Two opens, **who decides the theme**?

1. **Platform team** proposes and announces. Simple, fast, less legitimate.
2. **Steward council** decides via Hats Protocol authority (specific hat granted to participating stewards). Slower, more legitimate.
3. **Hybrid**: platform proposes, stewards ratify or amend within a defined window.

Afo leans **hybrid** given existing gardener input volume that could inform proposals. Final decision before this plan promotes from backlog.

## Out of scope (see `seasons-coordination-mechanic-v3`)

- On-chain Season primitive
- Hypercert binding to Season
- Vault distribution gating by Season state
- Cross-garden coordination contracts

## Checklist (when promoted)

- [ ] Decide governance model (1 / 2 / 3 above).
- [ ] Season db schema + service in shared.
- [ ] Hats hat (or reuse existing hat) for Season-opening authority.
- [ ] Admin "Open Season" flow with theme + window + criteria + opener.
- [ ] Mid-Season check-in publishing surface.
- [ ] Harvest workflow with finalize-or-defer prompt and auto-Volume-publish.
- [ ] Read-side archived Volumes navigation + transition narrative.
- [ ] Validation suite green.
