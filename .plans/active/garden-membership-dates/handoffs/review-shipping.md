# Membership regression review and shipping

Reviewed scope: garden join/role history across Indexer, Shared, PWA/profile, and Admin member controls. Requirements are the accepted scope in this hub and the user's November 12 request to review and ship it. Review batches: event facts and reduction; shared query/presentation; PWA/profile consumers; Admin state, composition, and recovery. Publication is isolated from the original shared checkout on `feature/garden-membership-history`, based on `origin/develop` at `cb9ef105c923ff32990ca39d996e5ce646c31635`.

## Findings and resolution

- Restored delayed history refresh after clean removal runs as well as partial/failed runs; the current removal integration test asserts the refresh callback.
- Fixed browser Back escaping state-opened Add role / Add Members overlays with unsaved input or a pending write. Route guarding now covers both opening modes, distinguishes state closes, and resets discarded drafts. A controlled restoration of the old guard failed the new unsaved-role regression; the fix passes. The sibling partial-batch path now confirms discard of remaining rows.
- Ported onto the newer Manage Roles removal workflow instead of replacing it with the older dialog. Preserved removal selection, preflight, signer checks, settlement and recovery. The new Add role action is disabled while removal picks exist; removal checkboxes remain usable. Extracted selection-summary presentation from the large dialog while keeping state and rules in their owners.
- Dates and labeled copy controls live in the current person rows. Directory name-aware search and current role controls remain intact. Explicit one/two-element detail tuples preserve the shared row contract.

## Safety facts

- Optional history cannot authorize a role change. Read path and UI callers traced; existing mutation hooks remain authoritative. Reader rejects malformed/incomplete pages and separates first grant, current continuous membership and role grant dates. Shared focused proof passed 14 cases.
- BigInt block ordering stays exact. The deployed public indexer's existing LoanEvent BigInt field was observed returning a decimal string, matching the new reader. New GardenRoleEvent publication and historical replay remain unverified deployment steps.
- Role additions stay scoped to the chosen person, including unsettled recovery. Existing Admin interaction and recovery tests passed after the port.

## Fresh working-tree proof

- Locked dependencies installed with `bun install --frozen-lockfile`; manifests' dependency fields and lockfile unchanged. Selected the already-installed pinned Bun 1.4.4 locally, without changing global tools.
- Shared: 14 focused tests passed. Client roster/profile: 27 passed. Indexer: 24 role-event tests and generated-type build passed. Admin: 68 cases passed across five suites, including the current removal workflow, navigation guards, batch refresh, copying, and role retry.
- Shared source, Client test, and Admin test typechecks passed. Post-commit push gate owns remaining required checks and final source type proof.
- Rendered proof: CI Playwright Chromium with Storybook synthetic fixtures, November 12 local / November 13 UTC. 29 Admin stories passed, including seeded join dates in current Manage Roles. This is not authenticated signing/profile proof; that remains pending. No live membership transaction occurred.
- Commands/logs: `/private/tmp/member-shipping/` (`admin-last.log`, `shared-locked.log`, `client-locked.log`, `indexer-tests.log`, `indexer-build.log`, `browser-final.log`, typecheck logs, and selected push plan).

## Publication limits

The original checkout and its concurrent edits are untouched. The Shared manifest change is limited to two leaf exports; no dependency, lockfile, permission policy or harness configuration change belongs to this patch. Linear search and workspace lookup repeatedly return unknown-tool errors; browser fallback requires login. No issue is invented. The repository requires a real Linear reference before PR creation. Current-head PR CI is therefore not yet available; this is not an approval/readiness verdict.

Rollout remains indexer schema publication → full historical replay → catch-up/known-history verification → UI publication. Account removal and Safe ownership are outside this code shipment. This hub stays active until rollout and committed lane certification are complete.

Task record: garden-membership-dates | Type: review and shipping | Outcome: in progress
Agent/model: Codex / exact model unknown | Coverage: current review/shipping segment

| Phase | Start → end (UTC) | Evidence or blocker |
| --- | --- | --- |
| review | unknown → 2026-11-13 02:09:15 | Four scoped batches and navigation finding above |
| implement | unknown → 2026-11-13 02:09:15 | Port to current develop and bounded regression fix |
| verify | unknown → ongoing | Focused tests/types/rendered proof; push gate pending |
| wait | unknown → unknown | Worktree and locked-install approvals received; Linear retry still failed |
| publish | unknown → ongoing | Commit/push preparation; PR blocked on Linear access/reference |

Human corrections: 0 observed; attention: unknown. Times include tools and overlapping checks; do not sum them.
