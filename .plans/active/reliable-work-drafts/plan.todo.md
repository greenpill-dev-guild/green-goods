# Implementation

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
