# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`
**Stage**: active
**Status**: Steps 1–2, 4, 6–7 complete locally; step 8's first Shared batch and guard reviewed; steps 3 and 5 await current-SHA CI
**Created**: 2026-09-19
**Last Updated**: 2026-09-19

The user selected local implementation beginning with step 1 and later authorized a commit of completed slices. Item numbers below refer to the supplied twelve-item test-audit prompt. Branch changes, push, PR, and Linear writes remain unauthorized.

## Decision log

| Decision | State | Reason |
|---|---|---|
| Refresh the audit and save a dedicated backlog hub | Authorized; preparation complete | Current code and PRs differ from the audit snapshot |
| Guidance → manual evidence → CI speed → critical proof → consolidation → measurement | Selected execution order | Establish the rules and protection before removing tests |
| Ordinary push may complete with browser proof still owed at readiness | Selected by user; implemented locally | Automated failures and missing automated capabilities remain blocking; strict and critical gates still require browser proof |
| Measured coverage floors replace the calendar-based two-point ratchet | Proposed; coordinate with architecture hub | Protect useful coverage without arbitrary percentage growth |
| Keep test isolation enabled | Default for this plan | Item 6a requires a separate measured adoption decision |
| Consolidate by subject and prove deletions | Required boundary | Similar setup does not establish equivalent fault detection |
| Work serially in bounded slices | Selected procedure | Avoid overlapping guidance, workflow, and test rewrites |
| Existing hubs retain architecture and onboarding ownership | Required coordination | Avoid duplicate sources of execution truth |

## Ordered work

Each row is a reviewable slice or a series of independently reviewed slices, not one large PR. Split package work further when it cannot be understood and verified in one session.

| Done | Order | Original items | Work and acceptance |
|---|---|---|---|
| [x] | 0 | Preparation | Refresh targets, local branch/PR overlap, inventory, recent Shared timing, nightly coverage, and representative push plan. See the dated report; no current-head full-suite claim. |
| [x] | 1 | 1 | Add test budget to testing.md, excess-proof review lens, and one root agent-guide pointer. Coordinate September 22 checkpoint and PRs #795/#802. Guidance checks pass; semantic evaluation only if trigger wording changes. |
| [x] | 2 | 4 | Presented both designs; user selected ordinary automated push with manual browser proof pending for readiness. Implemented exact browser-only deferral and negative proof for automated failure, missing automated capability, and critical/readiness requirements. Actual hook passed in a disposable checkout; see eval.md. |
| [ ] | 3 | 3 | Local implementation: two Shared CI shards through the wrapper, failed/missing shard CI Gate proof, nightly coverage unchanged, and one local timing comparison. Acceptance remains open for green shards and three comparable CI runs at a published current SHA; another session's uncommitted locale edit fails one test. |
| [x] | 4 | 11 | Added informational source/test changed-line and file-count summary to the existing Supply Chain Guardrails change-detection job. The step is explicitly non-blocking, adds no required check or threshold, and handles zero-source changes. |
| [ ] | 5 | 2 | Shared, Client and Admin sub-slices implemented: eight measured aggregate glob floors and three measured exact-file floors (Cookie Jar and image compression), parity proof, deliberate below-floor failure, and full coverage enforcement. Global floors unchanged; current-SHA CI acceptance remains open. |
| [x] | 6 | 7 | Added direct proof for Cookie Jar hooks, connectivity background work, queued-upload chain/cancellation, image compression, login messaging and timeframe boundaries; paired Cookie Jar and image compression with measured file floors. Preserved the flagged-upload toast proof. All focused/selected local checks passed; current-SHA CI remains in step 5. |
| [x] | 7 | 7 | Admin excessive-withdrawal rejection, Client claim confirmation and garden-join argument/failure proof passed. Cached #802 head showed no claim test; fresh PR status/head remains network-unverified. No runtime defect was exposed. |
| [ ] | 8 | 5 | First Shared helper batch reviewed: usePublicImpactEvidence and usePublicCommitmentImpact retain query-only providers and identical test names/results. A diff-aware guard is in test-quality with a documented Cookie Jar exception. Further package batches remain; preserve exceptional providers/cache behavior. |
| [ ] | 9 | 8 | Recheck six settlement exports against callers and active Commitment Pooling before deletion. Separately consolidate memory/SQLite join-request conformance and add missing production-store cases. |
| [ ] | 10 | 9, 10, 6b | Remove proven-stale mocks; replace only named layout/CSS cases with equivalent proof; merge small same-subject files only when no baseline/registry names them. Review the first file pair before rollout. |
| [ ] | 11 | 12 | After selected merges, record Snapshot 06: comparable Shared timing, worker buckets, coverage, churn, fault panel and line/file deltas. State unavailable methods explicitly. External republishing requires authorization. |
| [ ] | Deferred | 6a | Consider isolate:false only if setup/import costs still justify it: three comparable CI runs each way, no new failures, explicit adoption decision. |

## First implementation handoff

Step 1 is selected and the hub is active. Read the nearest agent guides and [scope](spec.md); recheck baseline and PR overlap at each slice. The plan skill's `linear-sync` start gate produced a `parent_only` manifest with a missing parent. That manifest is planning output; this request authorizes no Linear record. Preserve the parent-only footprint if a mirror is later authorized.

No branches are assigned. Stay on the current branch. Keep each change focused, record its working-copy identity, proof, and remaining obligations at every boundary, and do not dispatch agents automatically. A representative helper conversion and first file merge receive review before rollout.

## Follow-on order and ownership

1. After representative test improvements, reassess the Work/Agent import paths with the [architecture hub](../../active/codebase-architecture-skills/plan.todo.md). Avoid mechanically migrating setup in a subject already selected for dependency refactoring. Runtime changes remain outside this test-only scope.
2. Deliver one local write → index → displayed-result journey before expanding OrbStack concurrency. Reuse the first-run obligations from the `developer-onboarding` hub, archived on 2026-09-21 — see the [archive ledger](../../ARCHIVE.md); its Node-pin gap is named there and the hub itself lives only in Git history. Select the environment design separately.
3. Reconcile [builder docs PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795) as commands and policies settle. Update guidance beside its owning change; broader agent evaluations belong with architecture governance.
4. Prune verified unused forwarding files, replaced runners, and completed plans after caller/closeout checks. No root-folder purge or unresolved-plan deletion is selected here.

## Validation status

Preparation used non-mutating source/API reads and validation-plan rendering. Steps 1–2 and 4, plus step 3's local sharding code, are implemented in the working copy. Direct guidance checks, focused policy/sharding/reporting tests, and the disposable pre-push hook passed. The selected validation-system suite fails under Apple Git on an unchanged Git-variable list but passes with installed Git 2.55. Shared shard 2 and the unsharded suite both fail on another session's uncommitted locale edit. Live browser QA, fresh local coverage, and controlled CI performance comparisons remain pending. See eval.md for exact results; plan-file validation does not certify product behavior.

## Step 1 review boundary (2026-09-19)

The test budget, review lens, and agent-guide pointer are in place. The architecture hub still owns the September 22 two-point coverage checkpoint; this slice changes no threshold. PR #795 remains open over testing.md and PR #802 remains open over the review skill and AGENTS.md at the heads recorded in eval.md. The Plan Hub is active on the current `develop` branch, with a `parent_only` Linear manifest and no Linear write.

Direct guidance and test-quality checks passed. The selected validation-system check failed twice because Git lists `GIT_INTERNAL_SUPER_PREFIX` as repository-local while the unchanged `REPOSITORY_LOCAL_GIT_VARIABLES` array omits it. Track that tooling defect separately; do not blend a fix into this guidance slice. The changed guidance and hub remain uncommitted, so the HEAD SHA identifies the baseline, not a tested implementation commit.

Next decision: choose how manual authenticated-browser proof interacts with ordinary push. Present both designs before editing gate behavior. Missing automated capabilities must continue to block.

## Step 2 review boundary (2026-09-19)

The user selected the recommended second design: an ordinary noncritical push may proceed when all selected automated checks pass, while authenticated browser proof remains pending for readiness. The selector keeps that manual check visible and blocked by `authenticatedBrave`; only the ordinary local push result defers it. Failed checks, missing automated capabilities, missing focused proof, critical push, and readiness/ship/merge/release gates continue to block.

Focused RED/GREEN tests and a real unmodified pre-push hook in a disposable checkout passed. The selected validation-system suite passed 284/285 and failed only on the separately identified unchanged Git-variable enumeration; see eval.md. The implementation and hub remain uncommitted. The next slice is step 3: two Shared CI shards through the existing wrapper, with failed/missing shard gate proof and comparable measurements. Do not expand to item 11 reporting until the shard slice has been reviewed.

## Step 3 review boundary (2026-09-19)

Shared CI now declares independent `Test (1/2)` and `Test (2/2)` jobs through the package test wrapper. CI Gate requires both named jobs to succeed even if the overall workflow reports success. Nightly coverage stays unsharded. The Shared impact detector now recognizes wrapper changes named by its outer trigger.

Focused RED/GREEN tests and the selected validation-system suite with command-scoped installed Git 2.55 passed. Default Apple Git retains the separate Git-variable failure. Local shard 1 passed; shard 2 and the unsharded run had the same single locale-coverage failure from another session's uncommitted `Agro` entries. Shards and unsharded each covered 499 files and 5,328 tests. One local timing comparison is in eval.md. Three comparable CI runs and a green current-SHA CI Gate remain pending publication authorization and a clean Shared suite. Step 3 stays open for that acceptance. The next local implementation slice is step 4's informational ratio/file-count summary.

## Step 4 review boundary (2026-09-19)

The existing Supply Chain Guardrails change-detection job now writes an informational source/test line-churn ratio and added/deleted file counts to the GitHub step summary for pull requests. It uses the job's existing full-history checkout. `continue-on-error: true` keeps a reporting failure from gating the workflow; no required check or ratio threshold was added. The script has a durable workflow caller and a scripts/README.md entry.

Focused RED/GREEN tests cover additions, deletions, binary changes, and zero-source changes; a direct CLI run wrote the same Markdown to a disposable step-summary file. The selected validation-system suite passed 289/289 with command-scoped installed Git 2.55, and failed only the unchanged Apple Git-variable case under the default Git. See eval.md. Step 4 is locally complete, with no current-SHA CI receipt while publication remains unauthorized.

Next: step 5's per-glob floors. Measure the exact critical globs on a stable source state and verify installed Vitest threshold semantics before choosing numbers. The architecture hub still owns its September 22 two-point ratchet checkpoint; no threshold or checkpoint was changed in steps 1–4. Another session is editing Shared cookie-jar source and tests, so its in-flight work must be left alone while measurements are prepared.

## Step 5 Shared-floor review boundary (2026-09-19)

Four aggregate Shared glob floors now protect already-covered work, job queue, auth-hook and vault-hook paths. The installed Vitest 4.1.11 code confirms that a glob matches package-relative paths, its matching files remain in the global aggregate, and positive values are minimum percentages. Exact committed-source coverage totals and chosen margins are in eval.md. The existing global floors and the architecture hub's September 22 checkpoint remain unchanged.

The new parity case failed before config editing and passed after it. A disposable fault config set the auth-hook line floor to 100%; nine tests passed, and Vitest correctly exited 1 because coverage was 31.57%. The same disposable checkout, restored and then given the proposed config, passed the full Shared `bun run test --scope all-configured --coverage` gate: 497 files passed, 2 skipped; 5,311 tests passed, 17 skipped. The live changed-path selection passed format, lint, 290 validation-system tests and Shared typecheck, then stopped at the unrelated uncommitted locale-coverage failure. Client/Admin checks were not reached by the selector's stop rule. No current-SHA CI receipt exists. Next: measure Client/Admin exact globs on stable source before extending floors; keep near-zero Cookie Jar and compression paths paired with the later proof slices.

## Step 5 Client-floor review boundary (2026-09-20)

The fixed `08f96dc` checkout measured WalletSheet and Profile aggregate coverage from exact counters. Two Client floors now sit below those measurements while the existing global floors stay unchanged. The parity case failed 30/31 before editing the config and passed 31/31 afterward. The full Client `bun run test --coverage` run with the proposed config passed 140 files and 1,290 tests in that fixed checkout. Its Vite watch test needed local loopback access; the ordinary sandbox run failed only at that bind. The live changed-path selection passed format, lint, 291 validation-system tests and 1,292 Client tests, including another session's two uncommitted tests. See eval.md for commands, exact percentages and source identities. No current-SHA CI receipt exists.

Next: measure Admin critical globs at a stable source identity and add only useful floors. Near-zero paths remain paired with later direct behavior proofs.

## Step 5 Admin-floor review boundary (2026-09-20)

The fixed `08f96dc` baseline measured Vault and Garden Pool aggregates from exact coverage counters. Two Admin floors now protect those paths below the observed values; existing global floors are unchanged. Parity went RED 31/32 before config editing and GREEN 32/32 afterward. A repeated full run in the fixed checkout could not collect one Submit Work test because its symlinked dependency tree produced a Vite `/@fs/` import error; the isolated test reproduced that checkout limitation. Full `bun run test --coverage` in the normal live checkout passed 114 files and 863 tests, with both protected globs equal to the fixed baseline and above their floors. The live selected plan passed format, lint, 292 validation-system tests and 863 Admin tests. See eval.md for exact results and source identities.

The eight Shared/Client/Admin floors are locally implemented. Step 5 stays open for near-zero paths paired with later behavior proof and current-SHA CI. Next: step 6's first Shared direct-proof slice, Cookie Jar deposit and campaign behavior. Keep another session's Client, Shared garden-hook and locale edits untouched.

## Step 6 deposit review boundary (2026-09-20)

The new Shared deposit-hook test covers missing-account and insufficient-balance rejection, allowance-aware approval, transaction order, successful jar invalidation and toast completion. It calls the real owning hook while faking external reads and writes. The focused test passed 4/4. The rendered changed-path plan selected format, lint, Shared test typecheck and the focused test; all passed after one assertion formatting fix. No runtime code or existing test was removed, and the flagged-upload toast proof remains. See eval.md for exact commands, source identity and the unavailable PR #802 refresh.

Next: extend the campaign hook's existing test file for distinct read/claim failures, then measure the Cookie Jar path and set a floor only against complete coverage. The recent committed campaign chain-read test should remain intact.

## Step 6 campaign review boundary (2026-09-20)

The committed campaign app-chain read test remains intact, and its disconnected case now truly has no connected user. Two new cases protect allowlist-based claim eligibility and a failed optional contract read that leaves the jar usable while reporting degraded detail. The focused Shared test passed 4/4, and the rendered changed-path plan passed format, lint, Shared test typecheck and that focused test. See eval.md for source identity and commands. No product code or existing behavioral test was removed.

Next: run complete Shared coverage on a stable `08f96dc` source copy with both new Cookie Jar test files, then set a near-zero floor from exact matched counters. Do not infer a glob percentage from individual file percentages or the older nightly directory row.

## Step 6 campaign deposit review boundary (2026-09-20)

The complete fixed-source Shared coverage probe passed 498 files and 5,318 tests with the new deposit and campaign-read cases. It showed that the regular deposit file is well covered but the larger campaign hook remains low; the directory aggregate would hide that distinction. A fifth case now calls the campaign deposit mutation and proves its connected-member campaign invalidation without duplicating the regular approval-order case. The focused file passed 5/5, and selected format, lint, Shared test typecheck and focused test passed. See eval.md for exact coverage counters and commands. No runtime code or existing test was removed.

Next: measure both exact source files after this fifth case, then add exact-file floors below those totals and prove enforcement. Do not use the earlier directory aggregate as a substitute for the near-zero file.

## Step 6 Cookie Jar file-floor review boundary (2026-09-20)

Two exact-source floors now protect the deposit and campaign hooks. The campaign floor uses the lower per-file coverage measured after direct mutation proof; a directory aggregate would have hidden it. The parity test failed before the config edit and passed after it. A deliberate 100% deposit-line floor caused a threshold failure after all nine targeted tests passed, and complete Shared coverage with the proposed floors passed in a fixed `08f96dc` checkout: 498 files and 5,319 tests, two files and 17 tests skipped. The existing global and architecture checkpoint thresholds remain unchanged.

The live changed-path QA plan passed format, lint, validation-system 292/292 and Shared typecheck, then stopped on one other session locale assertion (`Agro` in Spanish and Portuguese); Shared had 497 files and 5,318 tests passing. Dependent checks were not run. See eval.md for exact counters, commands, source identity and limits. No runtime source or existing test was removed; the flagged-upload toast proof remains.

Next: add the distinct 60-second background-work connectivity proof in the existing store test file, then continue queued-upload branches. Keep the other session's locale and garden-hook files untouched.

## Step 6 connectivity review boundary (2026-09-20)

Two cases in the existing Shared store test now prove that background work reuses an origin answer at 30 seconds and re-probes after 60 seconds, while a degraded connection declines background work without starting another probe. The rendered QA plan selected format, lint, Shared test typecheck and focused test; all passed, with 14/14 store tests. No runtime source or prior test changed. See eval.md for exact command and source identity.

Next: inspect queued-upload failure and recovery paths, then add only missing direct proof. Preserve the existing flagged-upload toast case.

## Step 6 queued-upload review boundary (2026-09-20)

The existing Shared upload-all suite now proves that a ready job on another chain is never claimed or processed in this chain's run, and that an embedded wallet's `send-cancelled` result stops later sends while reporting earlier sent work. The first selected test run exposed an assertion setup mistake: `acquire` was not a spy. After correcting only that assertion, selected format, lint, Shared test typecheck and all 23/23 focused tests passed. No runtime source or previous test changed, and the existing flagged-upload toast proof remains. See eval.md.

Next: inspect compression's production callers and current direct proof, then add a measured behavioral slice before any near-zero floor.

## Step 6 image-compression review boundary (2026-09-20)

Three new Shared tests directly call the production image compressor used by work media and Admin. They cover compressed output and named progress, sequential failure fallback, and parallel out-of-order completion with one failed original preserved. Focused test 3/3 and selected format, lint and Shared test typecheck passed after a formatting correction. A fixed `08f96dc` focused coverage probe measured exact-file S/B/F/L at 71/38.09/70.58/72.52%, up from the preceding 3/0/0/3.29% full-suite baseline. An exact-file floor below the new values passed parity RED 31/32 → GREEN 32/32 and complete fixed-source Shared coverage 499 files/5,326 tests.

The live selected config plan passed format, lint, validation-system 292/292 and Shared typecheck, then stopped on the other session's `Agro` locale assertion: 498 files/5,325 tests passed, one failed. Dependent checks did not run. See eval.md for exact commands and source identity. No runtime source or prior test changed.

Next: add distinct login error and browser-guidance proof in the existing direct test, then the timeframe boundary table. Current-SHA CI remains pending publication authorization.

## Step 6 login-message review boundary (2026-09-20)

The existing Shared login-message test now covers distinct account mismatch, network and generic errors, plus Android and iOS in-app browser guidance. The previous missing-passkey and cancellation cases remain. The rendered QA plan selected format, lint, Shared test typecheck and focused test; all passed, with 7/7 tests. No runtime source or prior test changed. See eval.md for the exact command and source identity.

Next: add equal/reversed timeframe boundary cases beside the existing valid, negative and indefinite cases, without duplicating their proof.

## Step 6 timeframe review boundary (2026-09-20)

The existing Shared schema test's indefinite-end case now sits in a three-row table with an equal start/end acceptance and a reversed range rejection. Later-ending validity and negative timestamps retain their separate tests. The rendered QA plan selected format, lint, Shared test typecheck and focused test; all passed, with 58/58 tests. Biome reported this file outside its formatting/lint set (zero files checked), while strict test typecheck and the focused suite ran. No runtime source changed. See eval.md for exact command and source identity.

Step 6 local proof is complete. Next: step 7 Admin excessive-withdrawal rejection, then Client claim/join boundaries. Refresh PR #802 overlap before touching CookieJarTab and leave another session's Client edits alone.

## Step 7 Admin withdrawal review boundary (2026-09-20)

The existing Admin WithdrawModal suite now proves that entering more than the available balance displays its validation error, disables Withdraw, and never calls the withdrawal mutation. Its two previous success cases retain their behavior; their repeated vault fixture was consolidated locally. The rendered QA plan selected format, lint, Admin test typecheck and focused test; all passed, with 3/3 tests. No runtime source changed. See eval.md.

Next: examine the Client claim-confirmation and garden-join tests against current worktree changes. GitHub reads for #802 and #795 failed to connect in this boundary; use the dated overlap record and avoid CookieJarTab edits unless a fresh comparison is possible.

## Step 7 Client claim-confirmation review boundary (2026-09-20)

The cached September 19 #802 commit was available locally and its CookieJarTab test still contained an empty ConfirmDialog stub with no withdrawal-call assertion. The current clean WalletSheet-path test had the same gap. A single new case now proves that opening and cancelling confirmation cause no mutation, while confirming sends the exact jar, six-decimal amount and purpose. The test's dialog stub gained only the two actions needed to exercise those callbacks. The rendered QA plan selected format, lint, Client test typecheck, focused test and staged-modules; all passed, with 15/15 focused tests. No runtime source changed. Fresh #802 status/head could not be read from GitHub and remains unverified; see eval.md.

Next: garden-join argument and failure proof in its existing Client suite, after checking current file ownership.

## Step 7 garden-join review boundary (2026-09-20)

The existing Client success case now asserts the selected garden ID passed to `joinGarden`. A new rejection case proves an error toast with the thrown error, no success toast, no discovery timer, and the dialog closing. The rendered QA plan selected format, lint, Client test typecheck, focused test and staged-modules; all passed, with 13/13 focused tests. No runtime source or previous test changed. See eval.md.

Step 7 local proof is complete. Next: step 8's first representative `usePublicImpactEvidence.test.ts` helper conversion. Compare provider/cache semantics, preserve test names, validate, and review the before/after diff before any expansion.

## Step 8 first-helper review boundary (2026-09-20)

`usePublicImpactEvidence.test.ts` now uses a narrow `renderHookWithQueryClient` helper, with a fresh client per case. The helper supplies only `QueryClientProvider`; it does not add Intl or other providers. The test name and assertion remain identical. The shared query-client defaults differ from the old local setup only in `staleTime` and mutation retry; this hook sets its own stale time and performs no mutation. A trial using the broad test-utils barrel increased import time sharply and was discarded before this reviewed version.

The rendered QA plan selected format, lint, Shared test typecheck and the focused test; all passed (1/1). Before and after verbose runs passed the same named case. Single-run import time was 319 ms before and 378 ms after; this is a regression check, not a controlled benchmark. No runtime file or test was deleted. See eval.md. Next: a bounded Shared helper batch and the diff-aware guard, then settlement/store work.

## Step 8 Shared batch and guard boundary (2026-09-20)

`usePublicCommitmentImpact.test.ts` is the second query-only candidate. Its three original named cases passed before and after conversion, and its selected format/lint/typecheck/focused checks passed. The helper uses a fresh shared test client. The diff-aware test-quality guard now checks added local `createWrapper` declarations and `new QueryClient` constructions in Shared, Client and Admin tests. It examines added lines only and permits a nearby reasoned exception. The Cookie Jar deposit test needs the exact client for an invalidation spy and its blank Intl context, so that new test carries the one documented exception.

The selected validation-system suite passed 294/294; test-quality first caught the Cookie Jar exception, then passed after the reason was documented. No runtime source changed. This is a bounded Shared batch, not a claim that all local wrappers were migrated. Further helper batches and steps 9–11 remain open. See eval.md.

## Commit handoff (2026-09-20)

The user authorized a commit of completed local slices. Stage only this hub and the changed guidance, validation/CI tooling, coverage configuration, focused tests, and first Shared helper batch recorded above. Concurrent Client Home/Intro/Tabs, Shared garden-hook, and locale edits belong to another session and must remain unstaged. This commit carries local proof, not a current-SHA CI or authenticated-browser readiness claim. Resume with step 8's next bounded helper batch, then the caller-safe settlement/store work and first file consolidation. Keep steps 3 and 5 open for current-SHA CI after publication is authorized.
