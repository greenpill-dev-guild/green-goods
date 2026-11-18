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

## Export-manifest certificate refresh

The push gate exposed the manifest-wide seam fingerprint boundary. Compared all 24 registered implementation, root, consumer and proof files byte-for-byte with develop; all are unchanged. Existing export targets and dependency fields are unchanged. The only manifest delta is the two new, independent UI/history leaf exports. All 13 registered direct/conformance/integration suites were rerun: 359 passed, four existing governed skips. Refreshed the four existing certificates' fingerprints and review dates from the canonical checker after this evidence; lifecycle, criticality, declared boundaries, proof paths, and policy are unchanged. No waiver or baseline relaxation was used.

Evidence: `/private/tmp/member-shipping/seam-input-proof.txt`, `develop-seams.json`, and `seam-proof.log`. The develop evidence snapshot reproduces its original certificates; the new manifest alone caused their staleness.

## Publication continuation, November 13 UTC

Linear access works with the Green Goods account identifier; the earlier unknown-tool errors came from the wrong account identifier in tool calls. [PRD-1484](https://linear.app/green-goods/issue/PRD-1484/show-garden-membership-history-with-clear-member-controls) is In Progress and linked to [draft PR #1596](https://github.com/greenpill-dev-guild/green-goods/pull/1596). The branch includes develop through `62297af57da456129679fb55b4190a75a5a1dc5a`; the only merge conflict was a generated command-page digest, resolved by the canonical generator.

CI exposed two test integration gaps: an unsupported Testing Library `exact` option, corrected with an anchored accessible-name regex; and the strict browser backend's missing `GardenMemberHistory` operation. The backend now declares an empty history for the fixture's valid garden/account scopes and rejects invalid chain, scope and pagination inputs. New fixture contract cases failed before that response was added. Production code, fixture rejection policy and signing behavior are unchanged by these CI repairs.

The last published head before the fixture repair passed all package unit suites and builds, Admin browser CI, and Storybook. Client browser CI rejected the missing fixture operation, so current-head CI remains pending for the repair. Local Admin test typing and 17 dialog regressions passed. After the fixture repair, all 51 backend contract tests and eight focused Client navigation/app-shell browser cases passed with zero retries (CI Playwright Chromium, clean-room mock auth). The final CI result is recorded in the PR and chat handoff; authenticated profile/signing and production replay acceptance remain pending.
