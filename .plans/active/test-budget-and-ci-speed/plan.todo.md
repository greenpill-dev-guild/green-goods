# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`
**Stage**: `active`
**Status**: `ACTIVE — Software Factory locally implemented through batch 5; live observations and snapshot 09 pending`
**Created**: 2026-09-19
**Last Updated**: `2026-10-06`

The user selected local implementation beginning with step 1 and later authorized a commit of completed slices. Item numbers below refer to the supplied twelve-item test-audit prompt. The closeout pass may push to `origin/develop` (D4); a PR, a merge to `main`, a deploy and Linear writes remain unauthorized.

## Status reconciliation (2026-10-06)

The latest source record is [batch 5](handoffs/software-factory-batch-5.md), which supersedes the opening fourth-batch summary. SF05–SF08 and SF12 have recorded local acceptance; SF10 still requires an actual Claude Desktop Code observation and SF13 retains four ordinary-task categories plus the routine-dispatch observation. These handoffs record local acceptance. This status PR does not certify CI for the owning implementation range.

Snapshot 09 was scheduled for October 5 and remains unchecked in this hub as of October 6. Confirm whether its external scorecard exists before measuring again; if absent, record the actual next measurement date rather than treating the scheduled date as completion. D14's release prerequisite and the human-controlled restart, cleanup and dependency steps remain intact.

## Current execution truth (2026-09-28)

### Snapshot 08 follow-up (2026-09-28, later)

Scorecard snapshot 08, an independent re-audit at `1a3afcb52`, listed eight open items. Afo chose
items 2, 3, 5, 6 and 7 with the page's recommendations (D10). They are done and on `develop`
through `23a8d1ffb`, one commit per root cause. The
[follow-up report](reports/2026-09-28-snapshot-08-follow-up.md) holds the evidence.


The closeout pass pushed the range to `origin/develop` in three pushes (`d7cf681ec..fca76d585`,
31 commits). The [closeout report](reports/2026-09-28-closeout-push.md) holds the timings, the run
links and the evidence for steps 3 and 5. Measuring the push found two gate defects, fixed forward:
the hook could not reuse a manual pass because Husky's shim exports `NVM_DIR` (`627149a4d`), and a
manual run could not find package binaries such as `design.md` (`fca76d585`). The critical plan
for the range took 461 s cold and 2.1 s warm. Every workflow for each pushed head is green, and a
dispatched Coverage Nightly passed every floor at `627149a4d`. Snapshot 07 is on the
[Velocity Scorecard](https://claude.ai/artifact/9TkZM1T9niiwja34G9K2Mg). Metrics that need a
seven-day CI window are pending from 2026-09-28.

Correction to the closeout report, which stays as written: the 250 s cold compile in Contracts ·
Unit Tests on `8e05497f6` happened because slice 9 renamed that job's cache key (`a4b0e98d6`); the
`develop` cache it would otherwise have used had also been evicted. Lint And Build is the clean
eviction case: its key is unchanged, its Sep 25 cache was gone by Sep 28, and it rebuilt in 238 s
against a 90 s median. Afo chose to prune the unreachable CodeQL databases (D9): the 21 already
unreachable were deleted on 2026-09-28, taking the cache from 9.8 GB to 583 MB, and the hourly
prune workflow is in PR #945.

### After the review (2026-09-28)

Astra reviewed the follow-through and returned REQUEST_CHANGES: five Must-Fix findings and one
Should-Fix ([review](reports/2026-09-28-astra-review.md)). All six are fixed, and so are the three
Human Call-Outs that Afo decided (D6–D8), in fourteen commits after `01ba4e2cd`. The
[resolution report](reports/2026-09-28-astra-review-resolution.md) maps each finding to its
commit and proof, and lists the open items with their destinations. Next, the closeout pass
pushes to `origin/develop` and records current-head CI for steps 3 and 5.

### Before the review (2026-09-28)

The velocity follow-through is committed locally on `develop` from `d7cf681ec`, one commit per slice.
The [follow-through report](reports/2026-09-28-velocity-follow-through.md) holds the evidence;
[Astra's review handoff](handoffs/astra-review.md) holds the range, the claims and the limits.
Nothing is pushed. Astra reviews first, then the closeout pass pushes and supplies the current-head
CI that steps 3 and 5 below wait for. The Client validation blocker is resolved (slice 5). Open
items for Afo are listed in the handoff:
- five files whose tests depend on their order within the file;
- the hypercerts SDK's `BigInt.prototype.toJSON` patch;
- the `offlineDownloads` size assertion;
- three CI routing gaps.

### Previous record (2026-09-27)

The user authorized the remaining local work. The September 19–20 implementation is already committed in `9a0a5ac18960730f00d4dff0125286c41f23cb98`; the current cleanup was verified before commit on `develop`, based on `87938a7308d3933f61eebd9e02d27e921df60f5b`. The user authorized a local commit on September 27; the Client repair remains outside scope. Historical evidence is linked at the bottom; this file owns the current checklist.

The current slice adopts 29 Shared and two Admin query helpers, removes six caller-free settlement exports and five stale mocks, shares eight Agent conformance cases across memory and SQLite, and merges the PostHog throttle case into its existing subject. The batch-approval cache fixture and named layout/CSS tests are retained with concrete reasons. See [Snapshot 06](reports/2026-09-26-snapshot-06.md) for evidence, exclusions and measurement limits.

The former dirty-locale and Apple Git blockers are not carried forward as current findings. Current root `AGENTS.md` and the validation pipeline supersede the original browser-policy decision: browser proof is advisory for local intents and attested only at release. This slice changes no visible runtime behavior. PR #802 is merged; #795 remains open at `efd85dcebab17ceb9da87cb78fce8d3fd6aef714` (fresh GitHub read on September 27).

Three recent published Shared runs have both shards green. They provide observational timing evidence, not current-SHA CI for this slice or a controlled A/B comparison. The original twelve-fault definition remains unavailable. Keep the hub active for the Client validation blocker and publication acceptance; no Linear write or external publication is authorized.

## Decision log

| Decision | State | Reason |
|---|---|---|
| Refresh the audit and save a dedicated backlog hub | Authorized; preparation complete | Current code and PRs differ from the audit snapshot |
| Guidance → manual evidence → CI speed → critical proof → consolidation → measurement | Selected execution order | Establish the rules and protection before removing tests |
| Browser evidence policy | Superseded by current AGENTS.md / validation pipeline | Advisory for local intents; release attestation remains required. Historical decision evidence below is retained. |
| Measured coverage floors replace the calendar-based two-point ratchet | Decided (D3, 2026-09-28); the architecture hub closed `coverage_ratchet` | Protect useful coverage without arbitrary percentage growth |
| Keep test isolation enabled | Default for this plan | Item 6a requires a separate measured adoption decision |
| Consolidate by subject and prove deletions | Required boundary | Similar setup does not establish equivalent fault detection |
| Work serially in bounded slices | Selected procedure | Avoid overlapping guidance, workflow, and test rewrites |
| Existing hubs retain architecture and onboarding ownership | Required coordination | Avoid duplicate sources of execution truth |
| D1 (2026-09-28): critical means signing, money, queue and auth | Decided by Afo | Read-only hooks become sensitive; target the critical push at 5–7 minutes |
| D2 (2026-09-28): happy-dom for the Shared DOM project only if the A/B wins | Decided by Afo | Approves this one dev dependency and nothing else |
| D3 (2026-09-28): the 11 measured critical-path floors replace the September 22 ratchet | Decided by Afo | Global floors and parity arrays stay unchanged |
| D4 (2026-09-28): work on `develop`, commit each slice locally | Decided by Afo | No push, PR, merge, deploy or Linear write in the follow-through pass |
| D5 (2026-09-28): the DetailsGate table refactor is approved | Decided by Afo | Resolves the Client validation blocker's scope question |
| D6 (2026-09-28): fix the seven order-dependent Shared test files before the push | Decided by Afo (Astra's Human Call-Out) | Done in `282747338` and `407d4459b`; each file passes 25 in-file shuffle seeds, and the full suite passed shuffled |
| D7 (2026-09-28): fix the `offlineDownloads` byte assertion now; the SDK's `BigInt.prototype.toJSON` patch is a follow-up | Decided by Afo | Test fixed in `7f1c0b7c7`; the SDK patch is a product question in the resolution report's open items |
| D8 (2026-09-28): fix the three CI routing gaps now | Decided by Afo | Done in `ba6feb9b2`, `77cf70b55` and `268bb138f`, each with a guard against drift |
| D9 (2026-09-28): prune CodeQL's unreachable overlay-base databases hourly; keep overlay analysis on | Decided by Afo, from three options | Pull-request analyses restore only the newest database, and overlay keeps them near 2 minutes instead of 7 while the rulesets wait for CodeQL. The free org plan cannot buy more cache. The 21 unreachable databases were deleted by hand; the workflow is PR #945 |
| D10 (2026-09-28): address snapshot 08's items 2, 3, 5, 6 and 7 with the page's recommendations | Decided by Afo | Dispatch the CodeQL prune by hand; speed up what Admin's tests import rather than add a Shared shard; add the vault history's exactly-full page; finish the helper codemod; fix `canonicalJobPayload` instead of the SDK, end the Data Saver override with its session, and move the import-seam case into `check-source-structure.js` |
| D11 (2026-09-29): happy-dom for Admin, and remove MSW | Decided by Afo | Admin's DOM project moves to happy-dom, already a root dev dependency, with the same bar as D2; the unused MSW server, its Shared export and the root `msw` pin go, which changes the lockfile |
| D12 (2026-09-29): happy-dom for Client | Decided by Afo | Client, the last package on jsdom, moves to happy-dom with the same bar as D2 and D11; happy-dom is already a root dev dependency |
| D13 (2026-09-29): harden the test lease and record why a worktree gate skipped it | Decided by Afo (options B and C) | A local `CI=true` run takes the lease, and a leased run waits for Vitest runs that hold none. Catching old worktree branches up with `develop` (option A) stays with each branch's owner |
| D14 (2026-09-29): record the post-release plan in this hub and start it after the 2.0.0 release | Decided by Afo | A review of scorecard version 22 found four items still open, two closed items the page still shows as open and two open items with no row. The ten-row plan is in § After the release, with the evidence in `reports/2026-09-29-post-release-plan.md`; the restart, the worktree removal and the setup-debt row need Afo, Dependabot #948 needs dependency approval, and the Linear sync needs authorization |

## Ordered work

Each row is a reviewable slice or a series of independently reviewed slices, not one large PR. Split package work further when it cannot be understood and verified in one session.

| Done | Order | Original items | Work and acceptance |
|---|---|---|---|
| [x] | 0 | Preparation | Refresh targets, local branch/PR overlap, inventory, recent Shared timing, nightly coverage, and representative push plan. See the dated report; no current-head full-suite claim. |
| [x] | 1 | 1 | Add test budget to testing.md, excess-proof review lens, and one root agent-guide pointer. Coordinate September 22 checkpoint and PRs #795/#802. Guidance checks pass; semantic evaluation only if trigger wording changes. |
| [x] | 2 | 4 | Presented both designs; user selected ordinary automated push with manual browser proof pending for readiness. Implemented exact browser-only deferral and negative proof for automated failure, missing automated capability, and critical/readiness requirements. Actual hook passed in a disposable checkout; see eval.md. |
| [x] | 3 | 3 | Two Shared shards implemented. Current-head CI at `8e05497f6`: Test (1/2) 168 s and Test (2/2) 146 s, Vitest 128.9 s and 116.7 s, 730.7 worker-seconds against 1,039.8 in Snapshot 06. One run; the job median waits for the seven-day window. See the closeout report. |
| [x] | 4 | 11 | Added informational source/test changed-line and file-count summary to the existing Supply Chain Guardrails change-detection job. The step is explicitly non-blocking, adds no required check or threshold, and handles zero-source changes. |
| [ ] | 5 | 2 | Shared, Client and Admin sub-slices implemented: eight measured aggregate glob floors and three measured exact-file floors (Cookie Jar and image compression), parity proof, deliberate below-floor failure, and full coverage enforcement. Global floors unchanged (D3 closed the ratchet). Coverage Nightly, dispatched at `627149a4d`, passed every floor: statements Shared 74.05%, Client 72.6%, Admin 69.06%. See the closeout report. |
| [x] | 6 | 7 | Added direct proof for Cookie Jar hooks, connectivity background work, queued-upload chain/cancellation, image compression, login messaging and timeframe boundaries; paired Cookie Jar and image compression with measured file floors. Preserved the flagged-upload toast proof. All focused/selected local checks passed; current-SHA CI remains in step 5. |
| [x] | 7 | 7 | Admin excessive-withdrawal rejection, Client claim confirmation and garden-join argument/failure proof passed. Cached #802 head showed no claim test; fresh PR status/head remains network-unverified. No runtime defect was exposed. |
| [x] | 8 | 5 | Expanded helpers to 29 Shared and two Admin files. All 301 Shared test names/results match baseline; 30 focused Admin tests pass. Batch-approval cache behavior, Client persistence and custom-provider/cache/network fixtures retain their necessary setup. Existing guard passes. |
| [x] | 9 | 8 | Removed six caller-free settlement exports and their exclusive tests; retained live recognition/delivery/authority code. Eight common Agent cases run on memory and SQLite, including cap, withdrawal, sweep and revision boundaries; adapter encryption/restart proof remains. |
| [x] | 10 | 9, 10, 6b | Removed five stale WithdrawModal mocks and consolidated the PostHog throttle file without deleting its case. Retained named layout/CSS guards: current browser checks do not detect the same faults. No speculative broad file merge. |
| [x] | 11 | 12 | Local Snapshot 06 saved with inventory, recent shard timing/worker buckets and one defined fault check. Shared coverage and local proof recorded; the Client whole-suite timeouts are resolved (velocity slice 5). Post-merge publication, controlled timings and the unrecovered original fault panel remain explicit limits. |
| [x] | Deferred | 6a | Adopted for mock-free Shared Node files in velocity slice 6, which Afo approved, on three local A B B A pairs with identical results; comparable CI timing comes with current-head CI. |

## Velocity follow-through (2026-09-28)

Afo approved these slices and decisions D1–D5 on September 28 as follow-through on Velocity
Scorecard snapshot 06. Each slice is a local commit on `develop` from `d7cf681ec`; evidence lives in
the [follow-through report](reports/2026-09-28-velocity-follow-through.md).

| Done | Slice | Work | Evidence |
|---|---|---|---|
| [x] | 0 | Preflight and baseline: critical push 263 s cold / 57 s warm (`useWorkApprovals.ts`); read-only `useFilteredGardens.ts` 360 s cold (contended) / 73 s warm | Report § Slice 0 |
| [x] | 1 | Machine-wide test lease in the package test path: the second full run waits, names the holder and never times out; timing bound (both within twice one quiet run) not met in contended samples | Report § Slice 1 |
| [x] | 2 | Critical scope matches D1: 52 read-only hooks left the tier, 60 uncovered mutation files entered it; the selector escalates new ones from their code; CI Gate guards the list | Report § Slice 2 |
| [x] | 3 | Critical push 274 s cold (twice) and 3 s on a rerun; read-only hook 6–8 s cold; estimate 267 s instead of 965 s | Report § Slice 3 |
| [x] | 4 | Push gate routes `test-quality`, `docs-generated`, `docs-authority`: 37 of 39 CI red pairs now select their check (19 own paths, 18 branch diff); 2 were base drift whose introducer now selects it | Report § Slice 4 |
| [x] | 5 | DetailsGate table already landed in `ee5c8a147`; `--maxWorkers` was ignored, now passed as `VITEST_MAX_WORKERS`; full Client suite passes at one worker (104 s) | Report § Slice 5 |
| [x] | 6 | Shared Node project split: 145 mock-free files share one graph, 67 stay isolated, lean Node setup; Node files −51% to −54% wall at four workers, full suite −8% to −13%; identical names and results; four leak classes found and fenced (registry resets, IndexedDB, a built-in patched by `@hypercerts-org/sdk`, direct global assignment); Check 7 in `test-quality` checks the resolved membership | Report § Slice 6 |
| [x] | 7 | happy-dom adopted for the Shared DOM project (D2): DOM wall −21%, −28%, −26% in three A B B A pairs; three full runs identical to jsdom; five files pinned to jsdom with reasons; `offlineDownloads` found asserting jsdom's `[object Blob]` size; Client and Admin stay on jsdom | Report § Slice 7 |
| [x] | 8 | Three budget rules in `testing.md`; Check 8 fails a new test file below four cases without a reason; ten small Shared files folded into their subject files (549 → 540 files, identical names and results); 102 candidates listed | Report § Slice 8 |
| [x] | 9 | Contracts gas gate: develop PRs reuse a production tree restored under an exact key over every build input; pushes, release PRs, the local release gate and a new nightly step rebuild from scratch; local unit command 71–72 s fresh, 18 s cached; CI hit unverified until a PR runs | Report § Slice 9 |
| [x] | 10 | Test-utils barrel: three A B B A pairs over its 55 importers showed −16% to −18% duration and −27% to −29% import, so Shared tests now import leaves (`render-helpers.tsx` split out; 60 files moved); Check 9 rejects the barrel in Shared tests; Admin and Client keep `@green-goods/shared/testing` | Report § Slice 10 |
| [x] | 11 | Behaviour tests for the six near-zero files (lines now 60%, 85%, 65%, 100%, 80%, 77% from the new tests alone); each caught one injected fault | Report § Slice 11 |
| [x] | 12 | Ratchet closed (D3): `testing.md` states the decision; the architecture hub records decision 11 and closes `coverage_ratchet`; global floors and parity arrays unchanged | Report § Slice 12 |
| [x] | 13 | Hub updated for this pass; Astra's review handoff written | [handoffs/astra-review.md](handoffs/astra-review.md) |
| [x] | 14 | Astra's review resolved: receipts fingerprint the effective environment and never serve the strict gates, the mutation analyzer follows references and fails closed on unreadable imports, shared-graph admission follows helpers under a fresh-module and globals guard, the Seed leaf imports, a real small-file reason; then D6–D8 | [Resolution report](reports/2026-09-28-astra-review-resolution.md) |
| [x] | 15 | Closeout push: three pushes; two gate fixes found while measuring (`627149a4d` lets the hook reuse a manual pass under Husky's `NVM_DIR`; `fca76d585` gives manual runs the package binaries the hook has); critical plan 461 s cold and 2.1 s warm; every workflow green; Coverage Nightly passed; lease sample on a quiet machine; snapshot 07 | [Closeout report](reports/2026-09-28-closeout-push.md) |

## Snapshot 08 follow-up (2026-09-28)

Afo chose these on September 28 (D10). Each is a local commit on `develop` from `1a3afcb52`;
evidence lives in the [follow-up report](reports/2026-09-28-snapshot-08-follow-up.md).

| Done | Item | Work | Evidence |
|---|---|---|---|
| [x] | 2 | CodeQL prune dispatched by hand: 3 unreachable databases (1,364 MB) deleted, one left; the hourly schedule is still to be confirmed | Report § Item 2 |
| [x] | 3 | Admin tests: viem external, AppKit's React entry and wagmi adapter mocked, MSW no longer started, FormWizard off the Shared hooks barrel | Report § Item 3 |
| [x] | 3, later | Client and Shared: AppKit aliased to stubs in all three packages, which also makes Admin's adapter stand-in take effect; Shared leaves viem external; Client's viem stays external. Instructions: Shared −19%, Client −8.2%, Admin −3.2%, identical results | Report § Client and Shared imports |
| [x] | 5 | Vault history paging covers an exactly-full last page; fault f3 now fails 1 of 55 related tests | Report § Item 5 |
| [x] | 6 | Helper codemod: 45 Shared test files converted with identical names and results, 18 kept with reasons | Report § Item 6 |
| [x] | 7 | `canonicalJobPayload` reads raw values; the Data Saver override ends with its session; import seams checked by `check-source-structure.js` | Report § Item 7 |

## Admin happy-dom and MSW removal (2026-09-29)

Afo chose both follow-ups on September 29 (D11). Two commits on `develop` after `3fc9f132f`;
evidence in the [follow-up report](reports/2026-09-28-snapshot-08-follow-up.md) § happy-dom for
Admin and MSW removal.

| Done | Work | Evidence |
|---|---|---|
| [x] | Admin's DOM project runs in happy-dom (`9703b5402`); two files that assert authored inline styles stay on jsdom. Instructions −29% and Vitest time −29% in A B B A, identical names and results in all six runs, coverage unchanged | Report § happy-dom for Admin |
| [x] | MSW removed (`1c6948d50`): the unused GraphQL mock server and its Shared export, unused imports in the Playwright Pimlico mocks, and the root `msw` pin. Every other lockfile edge keeps its version; four seam fingerprints re-certified because they hash Shared's manifest | Report § MSW removal |

The D11 evidence went into the dated 2026-09-28 report in `30bfcf9fb`, against the plan skill's
rule that dated reports are immutable, and CI's Guidance integrity job failed on that head. It
stays there: restoring the report would be a second edit, which the same check rejects on the next
push. The local push gate did not select `immutable-plan-reports` for the edit; it has since `57916fed7`.

## Client happy-dom (2026-09-29)

Afo chose it after D11 (D12). One commit on `develop`; evidence in
[its report](reports/2026-09-29-client-happy-dom.md).

| Done | Work | Evidence |
|---|---|---|
| [x] | Client's DOM project runs in happy-dom (`46be0573a`); three files stay on jsdom, one for a `Storage.prototype` spy and two for accessible names joined from adjacent inline elements. Instructions −31% and Vitest time −28% in A B B A, identical names and results in all six runs, coverage unchanged | Report |

## Test lease gaps (2026-09-29)

Afo asked why a worktree's push gate ran without the lease, then chose to harden the lease and
record the answer (D13). Evidence in [its report](reports/2026-09-29-test-lease-gaps.md).

| Done | Work | Evidence |
|---|---|---|
| [x] | Diagnosed: the worktree's branch predates the lease (`d1bc5d86e`), so its gate and suites carry no lease code; 33 of 34 worktrees were in that state on September 29 | Report § Why |
| [x] | A local `CI=true` run takes the lease; only a GitHub runner skips it (`e0046ac17`) | Report § Fixes |
| [x] | A leased run waits up to five minutes for Vitest runs that hold no lease, naming them, then starts on half the machine (`09ada5970`) | Report § Fixes |

## After the release (planned 2026-09-29)

Afo asked for a review of the Velocity Scorecard (version 22) and a plan for what it still lists as
open, then chose to record the plan here and start it after the 2.0.0 release (D14). The
[post-release plan report](reports/2026-09-29-post-release-plan.md) holds the evidence, read on
September 29 at `22592595d`, including the worktree lists; this table is the checklist. Snapshot 09
goes first because its reading decides row 7. Rows marked *call* need Afo before anyone builds them.

| Done | Order | Work | Who | Proof |
|---|---|---|---|---|
| [ ] | 1 | Snapshot 09 on October 5: fill the fourteen pending CI fields on snapshots 07 and 08 from the September 28 to October 5 window; job medians for Admin · Test, Client · Test, both Shared shards, Storybook and Admin Playwright, divided by the test-body bucket; recheck the Actions cache total, the prune's cadence and the lease bound | a session | Snapshot 09 published; no `pending` field left on 07 or 08 |
| [ ] | 2 | Restart the laptop, then the worker test: on an idle machine, four full Shared runs at the default worker count and four at `VITEST_MAX_WORKERS=5`, recording Vitest `Duration` and the `tests` bucket; size the lease's worker cap from the result | Afo restarts (*call*); a session measures | The fourth run within 20% of the first at one of the two counts |
| [ ] | 3 | Worktree cleanup: `git worktree prune` for the three dead registrations; remove the 26 merged, idle worktrees the report lists, after a fresh `lsof` check; the four branches with unmerged work merge `develop` from their owning sessions, `feature/agent-reporting-core` first | Afo authorizes (*call*); a session and the branch owners | `git merge-base --is-ancestor d1bc5d86e <head>` holds for every worktree left |
| [ ] | 4 | Scorecard version 23: mark the order-flaky test closed and CodeQL holding, give the contracts row its new reason, replace the worktree line with the report's split, add rows for the setup debt and for Storybook and Admin Playwright | a session | The page matches the report |
| [ ] | 5 | Dependabot #948 (js-yaml in `packages/contracts`): regenerate `bun.lock` on its branch or close it and bump by hand within the release-age gate. It cannot prove the production-tree cache, because `bun.lock` is one of the cache key's inputs | needs approval as a dependency change | PR green and merged, or closed with the bump landed |
| [ ] | 6 | Contracts pull-request path: read the Unit Tests log of the next contracts pull request that changes none of the cache key's inputs | waits for such a PR | `Cache restored` for `foundry-release-production-*` |
| [ ] | 7 | After snapshot 09: if Storybook or Admin Playwright lead the gate, measure them next; if the Shared shards lead, stop optimising the gate | decide after 09 | Job p50 of the leader |
| [ ] | 8 | Setup debt (183 `toHaveClass` assertions, 152 heavy-mock files): leave for the December re-measure unless a batch rides along with feature work; no new rule | Afo (*call*) | Counts in December |
| [ ] | 9 | `linear-sync` for PRD-835 (architecture hub) | needs Linear write authorization | Hub and Linear agree |
| [ ] | 10 | December: redraw the 36-file sample and rerun the nineteen faults | a session | A new snapshot |

## Agentic development follow-up (proposed 2026-10-04)

The user requested a comparison of the independent Fable and Astra/Codex audits and a
comprehensive update plan. The
[reconciled report](reports/2026-10-04-software-factory-comparison.md) records the verified
findings, corrections, candidate designs, and evidence limits. This section is the canonical
checklist for that proposal. The authorization updates below track the selected slices; completed historical slices stay closed.

**Authorization update (2026-10-04):** Afo selected SF01–SF04 with “Go ahead and implement
the first batch.” This authorizes these four local slices to start now, superseding D14's timing
for this batch only. SF05–SF13 and unrelated post-release work remain unselected. No dependency
installation, Git publication, Linear write, or browser-policy change is included. The start-gate
manifest is parent-only and proposes creating a Linear parent; external sync remains deferred
under the existing local-only scope.

**Implementation checkpoint:** SF01, SF02 and SF04 meet their local acceptance checks. SF03 is
implemented but remains open: final Admin readiness checks fail, including in an original-source
control. The [batch handoff](handoffs/software-factory-batch-1.md) records all passes, failures
and the remaining qualification work. No full Admin-green or merge-readiness claim is made.

**Second-batch authorization:** Afo selected the next batch. Following the report's independent
constraint sequence, SF10–SF11 are selected for local implementation now. SF03 remains open;
SF05–SF09 and SF12–SF13 remain unselected. This batch diagnoses worktree hook chains without
repairing other checkouts, and repairs only a reproduced Address type boundary with consumer
probes. No dependency installation, branch change, publication or external write is included.

**Historical second-batch checkpoint:** The local SF10 diagnostics and disposable Git/Husky dispatch proof
pass; live agent hook loading remains pending in the architecture hub's existing pilot. SF11
adds a passing Client guard and traces the Admin widening. The Admin repair awaits explicit
approval to declare `abitype@1.2.3` and fix the seven exposed caller boundaries. Both rows stay
open for their remaining acceptance criteria. See the [second-batch handoff](handoffs/software-factory-batch-2.md).

**Selected first scope:** SF01–SF04. They improve existing evidence before adding more
automation. SF10–SF11 can follow as separately bounded constraint work. SF05–SF08 expand proof
only after its baseline is trustworthy. SF09 and SF12 depend on observed operator cost;
SF13 evaluates the result and the already-configured outer-loop handoff.

**Third-batch authorization:** Afo explicitly approved dependency changes and continuation.
Finish SF11 with exact `abitype@1.2.3`, one Admin registration, real consumer guards, and the seven
exposed caller boundaries. Then implement SF09's reporting checkpoint in the existing local
validation runner. The observed sandbox blocks, test-lease waits, and readiness failures supply
its concrete cases. Preserve first failures, distinguish lease/capability blocks from failed tests,
and report selected scope and unfinished proof. PR-text export is a later checkpoint; no retries,
policy weakening, publication, or external writes are included. SF05–SF08 stay behind their
existing qualification prerequisites; live hook loading remains with the architecture pilot.

**Third-batch checkpoint:** SF11 and the selected SF09 reporting checkpoint meet local acceptance.
The 15-check QA plan passes, followed by focused validation of the final fixture adjustment.
SF11 adds only Admin's exact ABIType dependency; Shared's package exports are unchanged.
The [third-batch handoff](handoffs/software-factory-batch-3.md) records scope, failures, final
checks and evidence limits. Checkmarks mean local acceptance, not a commit or publication.
SF03 remains open after an isolated Admin browser run with one pass and one readiness failure.
SF10's live pilot and SF05–SF08/SF12–SF13 remain outstanding.

**Fourth-batch authorization:** Afo selected the next batch: qualify SF03's Admin browser
journeys and complete the available SF10 live hook-loading observations. Diagnose the actual
rendered readiness failure before changing runtime or test code. Keep zero-retry proof and
existing outcome assertions. Codex session evidence belongs in the existing architecture
pilot; Claude Desktop Code evidence requires that actual session. Publication and the later
SF07/SF08 exploration rollout remain separate checkpoints.

**Fourth-batch checkpoint:** SF03 meets local acceptance: full Admin browser project 12 passed,
one declared fork-only skip, zero retries. A smoke fixture now shares its garden identity across
indexer and RPC responses. The earlier hydration-loader timeout did not recur and is not claimed
fixed. SF10 has actual Codex session/edit-hook observations; Claude Desktop Code is still pending.
The [fourth-batch handoff](handoffs/software-factory-batch-4.md) preserves the exact RED/GREEN
commands, scope and limits. No runtime, dependency, hook or CI configuration changed this batch.

**Remaining-work authorization:** Afo selected all remaining local Software Factory implementation.
Proceed serially through SF05–SF08 and SF12, retaining the existing reporting for SF09.
Dependency changes remain authorized if needed. SF10 and SF13 require actual session/task
observations; do not manufacture them. No publication, branch change, or external write is included.

**Implementation boundaries:** Reuse the existing E2E runner, Playwright configuration and strict
backend fixtures. The passkey spec owns a real virtual-authenticator ceremony with a deterministic
server rejection; it cannot certify a production identity provider. The PWA case uses an anonymous
production login shell, preserving production auth restrictions. The work-review pilot owns seeded
read/recovery actions, with no signing or dispatch. These capabilities are missing from the current
permissive passkey spec, development-worker proof and fixed work-review examples respectively.
Only locally qualified scenarios enter the validation policy. Owner-local CLI guards address
observed empty/scoped/retried proof and replay mistakes; no application rules are changed.

**Remaining-work checkpoint:** SF05–SF08 and SF12 meet local acceptance. Seven selected QA
checks passed, including 378 tooling tests, 333 fixture tests and four Chromium browser scenarios
with zero skips/retries. The final selector/runner suite passed 115 tests; final fixture and style
checks passed after the profile/routing closeout. Qualified checks are wired into the existing
Client browser job, with matching workflow triggers and required-workflow selection. The
[fifth-batch handoff](handoffs/software-factory-batch-5.md) records failures, final source identity,
commands, fork assessment and proof limits. SF10 and SF13 remain open for actual Claude Desktop,
ordinary-task and live-dispatch evidence. Current-head GitHub CI remains unrun for these local changes.

### Workstream A — Make a passing check meaningful

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF01 | Align local smoke/verification startup with the CI test profile. Reuse `scripts/dev/test-e2e.js`, `playwright.config.ts`, and `scripts/dev/command-runners.test.mjs`; change `scripts/dev/stack.js` only if a narrow explicit profile is needed. Preserve normal live-development defaults and ownership cleanup. | Selected; start-now exception to D14 | RED reproduces test-profile replacement by development/42161. GREEN uses the same intended chain/fixtures locally and in CI, rejects mismatched existing servers, and stops only its owned processes. |
| [x] | SF02 | Make `tests/helpers/mock-backend.ts` reject unsupported requests and validate scenario arguments. Extend its owning fixture tests and `tests/helpers/test-utils.ts` only where callers need request accounting. Keep legitimate empty results explicit. | SF01 for rendered proof | Unsupported GraphQL operation, wrong RPC method/selector/address, and missing required request fail with useful traces. Existing supported smoke and offline scenarios pass. |
| [x] | SF03 | Strengthen approval and admin journey outcomes in `tests/specs/client.work-approval.ci.spec.ts` and `tests/specs/admin.production-flows.ci.spec.ts`, using the shared fixtures. One subject per checkpoint: approval first, then the selected admin flow. Keep independently useful smoke coverage. | SF02 | A shell-only response, disabled dispatch, unexpected request, and endless loader fail. Assert the selected result and visible recovery from injected rejection; retain the stronger offline-queue test. |
| [x] | SF04 | Extend the existing required-job map in `scripts/quality/ci-gate.mjs` and its tests to the Client/Admin browser jobs. Read their current workflow job names before editing; do not add a second aggregate gate. | Can follow scope selection independently | Missing, skipped, cancelled, and failed required jobs fail; both successful jobs pass. Existing terminal-workflow and current-head behavior remains intact. |

### Workstream B — Extend active verification with reproducible evidence

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF05 | Qualify the passkey browser scenario in `tests/specs/client.passkey.spec.ts`, its helpers, and `tests/mocks/pimlico-handlers.ts` before promoting the project. Separately assess `tests/specs/client.fork.spec.ts` for faithful browser/chain/indexer wiring; do not attach the entire fork suite to every critical edit. | SF01–SF03; capability inventory | Remaining on login, missing expected input, unfinished registration, and silent auth fallback fail. One registration/session-restoration or rejection outcome completes with a virtual authenticator. Record which real-wallet/device claims this cannot prove. Fork gaps get a separate selected checkpoint before execution. |
| [x] | SF06 | Add a bounded production-PWA-preview case using the existing browser lifecycle, `playwright.config.ts`, `tests/specs/client.offline-sync.ci.spec.ts`, and a direct runner fixture. Design authentication without enabling a production bypass. Add CI wiring as a separate checkpoint after local proof. | SF01 and explicit preview-auth design | Production app shell reloads offline after controlled installation; removing navigation cache fails. Test worker update/recovery where the selected change warrants it. Record clean-room and installed/authenticated proof separately. |
| [x] | SF07 | Pilot bounded role/data/viewport interaction through the existing browser CLI and scenario helpers. A proposed browser subcommand may be added; it is not an existing runnable interface. Start with one data-rich journey and one recovery variant, reusing route-proof error/overflow checks and current mock-role identifiers. | SF02–SF03; one scenario selected | Seed and action log replay the same failure; fresh context/reset prevents cross-case contamination; required outcome asserts completion. Unknown network operations and out-of-scope navigation fail. No blind click-all or real-wallet signing. |
| [x] | SF08 | Register only qualified proof in `scripts/data/validation-policy.json` and `scripts/quality/select-validation.mjs`, with its direct tests. Connect scenario artifacts to existing runner evidence, adding `scripts/dev/ci-local.js` changes only when necessary. Keep each registration independently reviewable. | The relevant SF05/SF06/SF07 proof; measured cost | Relevant changed paths select the check, unrelated edits do not; critical overrides survive. Missing capability is BLOCKED, missing/failed required scenario is not a pass, and source/fixture/profile/toolchain drift invalidates reuse. |

SF07 exploration runs only against an owned disposable profile. Route actions must be allowlisted
for the scenario; effects use strict substitutes or an explicitly selected local fork with
disposable accounts. A proposed pilot budget is at most two exploration/repair attempts within
five minutes after startup, adjusted from measurement. Repair still requires implementation
scope. Deterministic replay becomes ordinary regression proof; stochastic exploration never
silently turns a failure into green. A dedicated accessibility package or property-test library
requires separate dependency approval. Use the installed stack for initial proof where faithful.

### Workstream C — Reduce repeated operating judgment

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF09 | Extend `scripts/dev/ci-local.js` and its owning tests with concise outcome diagnostics derived from observed evidence. Reporting is locally complete; optional PR validation text remains deferred. Capture bounded load/lease context without secrets. Start with reporting; do not add automatic retries or broad regeneration. | Representative failures and actual workflow needs | Deterministic failure, budget exhaustion, capability block, cancellation, and suspected contention remain distinct. Output preserves the first failure, exact scope, pending proof, and an actionable next command. Focused proof never claims an unrun full gate. |
| [ ] | SF10 | Extend `scripts/dev/doctor.js` and its existing shared helpers/tests to diagnose missing effective worktree hook chains and point to the owning setup path. Complete live hook-loading evidence in the architecture hub's existing pilot. Setup repair, if selected, is a separate checkpoint. | Scope selection; coordinate current worktree owners | Fixture matrix covers relative/absolute paths, missing dispatcher or target, inactive checkout, and differing branch tooling. A selected disposable worktree proves dispatch end-to-end. Doctor performs no install, Git-config edit, cleanup, or broad retargeting. |
| [x] | SF11 | Establish source-controlled negative Address type probes for Client/Admin using the owning typecheck/test entrypoints, then trace and repair the augmentation or package boundary causing widening. Choose at most one owning declaration/config plus its consumer probes per checkpoint. | Scope selection; current compiler baseline | Non-hex string assignment fails under each actual project graph; valid address use passes. Preserve runtime validation and public type compatibility. Record unrelated baseline diagnostics; do not hide them with assertions or broad suppressions. |
| [x] | SF12 | Mine a small authorized sample of repeated interventions; choose at most three reproduced failure classes. Add each guard or property check beside its owner, and link the superseded guidance only after proof. Candidate areas: message IDs, provider composition, codec round-trips, time boundaries, and indexed access in a bounded leaf. | Evidence sampling; separate selection per rule/property | Each rule has an offending and valid case; each property has an explicit invariant and deterministic replay/seed where needed. Demonstrate reduced repeated work. No memory deletion quotas, blanket regex bans, blanket compiler flip, or dependency install. |
| [ ] | SF13 | Evaluate the selected changes in five ordinary authorized tasks and verify the existing routine-to-Codex handoff operationally when access/authorization is available. Reuse the architecture pilot and existing scorecard; record only missing measurements here. | Implemented selected slices; read access or separate dispatch authorization | Report intervention categories, replay success, missed regressions, and comparable p50/p90 costs. Verify configured delegation through an actual linked outcome before proposing another dispatcher. Decide adoption from evidence, not elapsed calendar time. |

### Execution and test strategy

Keep each checkpoint to one failure class and about three or four owning files. Split any slice
that exceeds one session or combines fixture repair, runner integration, and workflow rollout.
Do not parallelize edits to the selector, runner, or shared browser fixtures. Implementation
starts only after scope selection, the applicable release gate, fresh ownership checks, and the
plan skill's normal start procedure; this request did not authorize Linear writes.

Before each selected implementation, read the nearest guide, the testing contract, the relevant
runtime callers, and the selector's `selectedBy` reasons. Record a failing behavioral proof first
for confirmed defects; preserve a passing control. Use direct fixture tests for tooling and
rendered proof for browser assertions. Qualification of one proof class never certifies another.

Use repository commands after rendering the actual plan:

```sh
bun run check --plan -- --intent qa
# Run the selected subject's direct test/observable proof.
# For the matching established CI browser projects, when their prerequisites are ready:
PLAYWRIGHT_APP=client APP_ENV=test bunx playwright test --project=client-ci
PLAYWRIGHT_APP=admin APP_ENV=test bunx playwright test --project=admin-ci
```

Contracts continue through Bun wrappers, and new checks retain the full selected critical
override. A coherent cross-package checkpoint uses the existing Quick Gate. A later authorized
push uses the push intent; live current-head CI is still required for merge readiness.

Artifacts record the source fingerprint (including dirty inputs), scenario/fixture version,
profile, browser engine/session class, attempted/completed cases, failures/skips, commands,
exit status, and private artifact paths. Only exact passing evidence may be reused. The receipt
store must not become a source of implicit authorization for edits, retries, publication, or merge.

### Scope decisions and deferred recommendations

The [proposal constraints](spec.md#agentic-development-proposal-2026-10-04) and
[acceptance matrix](eval.md#agentic-development-proposal-2026-10-04) govern this follow-up.
Keep advisory completion hooks and current authenticated-browser policy. Reconsider either only
through an explicit policy decision backed by the pilot. Keep native sandbox/permission posture.

Do not implement Fable's suggested worktree deletion inside `dev:clean`, mass memory reduction,
automatic post-edit regeneration, universal retry-on-load, or receipts-in-commit-trailers as proof
of trustworthy execution. Fresh scope-specific artifact generation and dry-run codemods can be
proposed once repeated demand and a durable caller are demonstrated. Existing contract fork
push lanes remain; a scheduled fork campaign is optional, separate work, not a missing baseline.

## Current handoff

The snapshot 08 follow-up reached `develop` at `23a8d1ffb`, and D11 in `9703b5402` and
`1c6948d50`, D12 in `46be0573a`, and D13 in `e0046ac17` and `09ada5970`, which reached `origin`
inside another session's push at `58d442042`. On September 29 Afo reviewed the scorecard's open
items and chose to park the rest until after the 2.0.0 release (D14): the checklist is in
§ After the release and the evidence in the
[post-release plan report](reports/2026-09-29-post-release-plan.md). Next, in order:

- snapshot 09 on 2026-10-05: the seven-day CI window from 2026-09-28, which fills the fourteen
  fields snapshots 07 and 08 leave pending; Admin · Test runs happy-dom from D11's push on and
  Client · Test from D12's, so the window also shows whether they dropped on the runner. Recheck
  the CodeQL prune there: its hourly schedule (`37 * * * *`) fired at 02:42, 10:06 and 16:36 UTC
  on September 29 and 00:43 UTC on September 30, and its push trigger runs on each `develop` push;
- the laptop restart and worker test, then the worktree cleanup, both Afo's calls; the report
  lists the 26 removable worktrees and the four branches whose owners merge `develop`;
- `linear-sync` for PRD-835 (architecture hub), in a pass that may write to Linear.

The earlier instructions below are historical.

Resolve or explicitly disposition the Client validation blocker after scope approval; exact local results are in Snapshot 06 and eval.md. Preserve the serial scope and current branch. Do not repeat completed September 19–20 slices or treat their historical local failures as live findings. Subsequent publication, current-SHA CI acceptance and any external scorecard/Linear update require their own authorization. Existing architecture and onboarding ownership stays with the hubs below.

## Follow-on order and ownership

1. After representative test improvements, reassess the Work/Agent import paths with the [architecture hub](../../active/codebase-architecture-skills/plan.todo.md). Avoid mechanically migrating setup in a subject already selected for dependency refactoring. Runtime changes remain outside this test-only scope.
2. Deliver one local write → index → displayed-result journey before expanding OrbStack concurrency. Reuse the first-run obligations from the `developer-onboarding` hub, archived on 2026-09-21 — see the [archive ledger](../../ARCHIVE.md); its Node-pin gap is named there and the hub itself lives only in Git history. Select the environment design separately.
3. Reconcile [builder docs PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795) as commands and policies settle. Update guidance beside its owning change; broader agent evaluations belong with architecture governance.
4. Prune verified unused forwarding files, replaced runners, and completed plans after caller/closeout checks. No root-folder purge or unresolved-plan deletion is selected here.

## Validation status

Current focused evidence and final-check results are maintained in [Snapshot 06](reports/2026-09-26-snapshot-06.md) and the latest eval.md entry. Plan-file validation establishes hub consistency only. Earlier sections below preserve dated commands and results for traceability.

## Historical evidence

The September 19–20 slice commands, RED/GREEN results, coverage counters and limitations remain in [eval.md](eval.md), the [preparation report](reports/2026-09-19-preparation.md), and `status.json#history`. Their implementation is committed in `9a0a5ac18960730f00d4dff0125286c41f23cb98`. This live checklist replaces the duplicated historical next-step instructions; it does not erase or supersede the dated evidence.

## Current validation blocker (resolved 2026-09-28)

Resolved by slice 5 of the velocity follow-through: the table refactor landed in `ee5c8a147`, and the full Client suite passes at one worker. The original diagnosis below ran at full width, because `--maxWorkers` did not reach Vitest; the report has the measurements.

### Original record (2026-09-27)

Full Client runs with two and one workers hit `DetailsGate.test.tsx`'s unchanged 10-second deadline (one and two failing cases respectively). A focused run passed with both original and restored runtime source, so this is timing-sensitive rather than a consistently reproduced behavioral regression. The proposed repair parameterizes the existing 23-template loop while preserving assertions and the deadline. This file is outside the accepted target list: scope expansion was requested and no Client edit has been made. Do not mark the Client gate or this hub complete while that obligation remains.
