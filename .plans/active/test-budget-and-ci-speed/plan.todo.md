# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`
**Stage**: active
**Status**: Velocity follow-through (slices 0–13, D1–D5), the resolution of Astra's review (D6–D8) and two gate fixes pushed to `origin/develop` (`d7cf681ec..fca76d585`); every workflow for each pushed head is green, steps 3 and 5 are closed, and scorecard snapshot 07 is published
**Created**: 2026-09-19
**Last Updated**: 2026-09-28

The user selected local implementation beginning with step 1 and later authorized a commit of completed slices. Item numbers below refer to the supplied twelve-item test-audit prompt. The closeout pass may push to `origin/develop` (D4); a PR, a merge to `main`, a deploy and Linear writes remain unauthorized.

## Current execution truth (2026-09-28)

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

## Current handoff

The closeout pass is done. Next:

- the seven-day CI window from 2026-09-28, for the job medians, the CI Gate median and the red
  rates that snapshot 07 leaves pending;
- the open items in the [closeout report](reports/2026-09-28-closeout-push.md) and the
  [resolution report](reports/2026-09-28-astra-review-resolution.md); the CodeQL cache item is
  decided (D9) and merges with PR #945;
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
