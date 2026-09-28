# Reliable Work Drafts and Resumable Uploads

**Feature Slug**: `reliable-work-drafts`
**Stage**: `active`
**Status**: `CLOSED — shipped in 7bb26ff86 and PR #827; installed-device acceptance moves to the QA catalog`
**Linear Issue**: PRD-920
**Created**: 2026-09-09
**Last Updated**: 2026-09-27

The dated acceptance section below (`## Reliable offline submission and browsing — accepted
2026-09-12`) records what the user approved on that date and keeps its own date.

## Implementation

- [x] Independent byte capture and compression fallback
- [ ] Atomic complete snapshots, shared identity, hydration and legacy recovery
- [ ] Durable encoder checkpoints, wallet retries and queue ownership
- [x] Video/photo/audio boundaries, approximate location and sheet integration
- [ ] Focused regression tests and limited authenticated Brave recovery proof
- [ ] Selected automated validation gates; see validation.md
- [ ] Full media/device matrix and physical Android production acceptance

## Review repairs

- [x] Reconcile direct, queued and batch broadcasts before sending; wait automatically and require explicit retry after revert
- [x] Centralize discard/retirement and serialize deletion with saves
- [x] Bound preview ownership and load draft thumbnails on demand
- [x] Recover readable legacy entries with durable reselection identities
- [ ] Re-run regression, critical readiness and authenticated browser proof

Automated repair evidence and remaining device acceptance: [repair-validation.md](repair-validation.md). Original acceptance rows remain reopened until live proof is complete.


## Reliable offline submission and browsing — accepted 2026-09-12

**Status**: ACTIVE — implementation complete; installed-device acceptance remains
**Linear Issue**: PRD-920
**Last Updated**: 2026-09-12

The user approved all nine findings in the [review](reports/2026-09-12-offline-review.md) and
[offline experience review](reports/2026-09-12-offline-experience.md), plus the installed Android
banner investigation and the preparation policy below. The accepted 150 MiB budget supersedes
any provisional budget in those historical reports. Earlier validation is historical, not proof
of this implementation or the concurrent shell/passkey changes.

- [x] Admit every offline-capable submission durably by normalized account, chain and clientWorkId; use one execution claim across immediate, queue and batch sending.
- [x] Persist upload/broadcast checkpoints and permanent completion identities before retiring drafts or deleting evidence; preserve Admin's explicit offline prohibition.
- [x] Confirm passkey UserOperations from execution receipts; keep timeouts and ambiguous legacy checkpoints unresolved; require explicit retry after proved failure.
- [x] Revalidate account, chain and session generation after uploads and before signing; filter terminal and exhausted jobs within batch selection.
- [x] Unify work and avatar drafts in the existing versioned database, with restartable legacy copying, preserved bytes/identities and separate count limits.
- [x] Repair Shared connectivity lifecycle/subscription behavior, bounded uncached reachability checks and banner safe-area/stacking implementation.
- [x] Make cached/queued work projection local, persist approval/metadata queries, use stable identity deduplication and scope by account/chain.
- [x] Implement bounded recent work reads, selective query retention, verified media preparation and priority/LRU eviction under the accepted policy.
- [x] Apply cached, missing, partial, empty, refresh-failed and reconnect states to garden views and compact settings controls; translate en/es/pt.
- [ ] Run regression tests, cross-package compatibility and selector-required critical readiness gates with fresh evidence.
- [ ] Observe authenticated Brave UI, installed Android airplane mode/restart/wallet/passkey reconnect and installed iOS compatibility before production readiness.

Execution ownership: submission module and queue execution; offline read/connectivity and garden presentation;
preparation coordinator/persistence/media/settings; coordinator-owned draft migration and integration.
Existing shell, scrolling and passkey diffs are preserved. No contract changes, dependency installs,
branch changes, commits, pushes or deployment are part of this implementation pass.


## Background offline preparation and online browsing — accepted 2026-09-14

**Status**: ACTIVE — implementation committed locally; device measurements pending
**Linear Issue**: PRD-920
**Last Updated**: 2026-09-14

Afo accepted one read model, tiered preparation, photos on cellular and the two-line Settings copy
after [the online regression report](reports/2026-09-14-online-regression.md). The revised policy is
in [spec.md](spec.md#revised-offline-preparation-accepted-2026-09-14).

- [x] Service worker answers gateway media from `ipfs-cache` before storing a sized copy; legacy prepared photos read through; Workbox no longer owns that cache.
- [x] Images request one gateway at a time, fall back on failure or a visible stall, and retry after an offline failure.
- [x] Replace the coordinator and manifest with a scheduler that yields to screen activity, reprioritizes the garden in view and pauses photos under Data Saver.
- [x] Fill the screens' own work, approval and detail queries; remove the prepared queries and the useWorks manifest subscription; keep metadata lookups referentially stable.
- [x] Coalesce query persistence and keep the offline read model by query group; normalize garden segments in work keys and on restore.
- [x] Move offline status to the Settings row with one-line title and two status lines; keep only offline and refresh-failure lines in gardens; render 50 works with "Show older work"; en/es/pt copy.
- [ ] Measure on an installed Android phone before and after: time to first work photo, long tasks, gateway requests by initiator, cache entry counts, banner text during a run.
- [ ] Confirm the photo cache contract on the installed app: prepared photos open offline, the legacy cache retires after a complete run, Data Saver holds photos.

## Closeout (2026-09-27)

Closed as `closed`. All three accepted scopes shipped to `develop`: durable drafts and resumable
uploads in `7bb26ff86` (2026-09-09), then reliable offline submission, background preparation and
the online browsing repair in PR #827 (merged 2026-09-16). PR #898 (2026-09-24) later stopped a
stalled IndexedDB from holding every query. Afo confirmed the work complete, and PRD-920 went Done
on 2026-09-17.

Several implementation boxes above were never ticked although their work shipped:
`handoffs/codex-state-api.md` records atomic draft snapshots with stable attachment identities and
legacy recovery, persisted upload checkpoints, and wallet retries that keep the original submission
ID. This closes as `closed` rather than `completed` because the `ui` and `state_api` lanes never
recorded clean-commit validation receipts (the handoff says its automated evidence predates the
commit), and neither QA lane ran.

Still open:
- Installed Android and iOS acceptance: airplane mode, close and reopen, reconnect → the QA
  catalog rows PWA-AND-004, PWA-AND-007, PWA-AND-008, PWA-IOS-004, PWA-IOS-005 and PWA-IOS-006,
  walked in the next open run with an installed app.
- The photo cache contract (prepared photos open offline, the legacy cache retires, Data Saver
  holds photos) → no catalog row covers it yet; recorded on PRD-920 so the next QA call adds one.
- Authenticated Brave recovery proof → covered by the same catalog walk, which uses real sessions.
- Before-and-after measurements on an installed Android phone → dropped: every install has
  upgraded past #827, so the "before" build no longer exists to measure.
