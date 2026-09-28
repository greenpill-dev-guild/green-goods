# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`
**Stage**: active
**Status**: Velocity follow-through in progress on local `develop` commits (September 28, D1–D5); publication acceptance remains open
**Created**: 2026-09-19
**Last Updated**: 2026-09-28

The user selected local implementation beginning with step 1 and later authorized a commit of completed slices. Item numbers below refer to the supplied twelve-item test-audit prompt. Branch changes, push, PR, and Linear writes remain unauthorized.

## Current execution truth (2026-09-27)

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
| Measured coverage floors replace the calendar-based two-point ratchet | Proposed; coordinate with architecture hub | Protect useful coverage without arbitrary percentage growth |
| Keep test isolation enabled | Default for this plan | Item 6a requires a separate measured adoption decision |
| Consolidate by subject and prove deletions | Required boundary | Similar setup does not establish equivalent fault detection |
| Work serially in bounded slices | Selected procedure | Avoid overlapping guidance, workflow, and test rewrites |
| Existing hubs retain architecture and onboarding ownership | Required coordination | Avoid duplicate sources of execution truth |
| D1 (2026-09-28): critical means signing, money, queue and auth | Decided by Afo | Read-only hooks become sensitive; target the critical push at 5–7 minutes |
| D2 (2026-09-28): happy-dom for the Shared DOM project only if the A/B wins | Decided by Afo | Approves this one dev dependency and nothing else |
| D3 (2026-09-28): the 11 measured critical-path floors replace the September 22 ratchet | Decided by Afo | Global floors and parity arrays stay unchanged |
| D4 (2026-09-28): work on `develop`, commit each slice locally | Decided by Afo | No push, PR, merge, deploy or Linear write in the follow-through pass |
| D5 (2026-09-28): the DetailsGate table refactor is approved | Decided by Afo | Resolves the Client validation blocker's scope question |

## Ordered work

Each row is a reviewable slice or a series of independently reviewed slices, not one large PR. Split package work further when it cannot be understood and verified in one session.

| Done | Order | Original items | Work and acceptance |
|---|---|---|---|
| [x] | 0 | Preparation | Refresh targets, local branch/PR overlap, inventory, recent Shared timing, nightly coverage, and representative push plan. See the dated report; no current-head full-suite claim. |
| [x] | 1 | 1 | Add test budget to testing.md, excess-proof review lens, and one root agent-guide pointer. Coordinate September 22 checkpoint and PRs #795/#802. Guidance checks pass; semantic evaluation only if trigger wording changes. |
| [x] | 2 | 4 | Presented both designs; user selected ordinary automated push with manual browser proof pending for readiness. Implemented exact browser-only deferral and negative proof for automated failure, missing automated capability, and critical/readiness requirements. Actual hook passed in a disposable checkout; see eval.md. |
| [ ] | 3 | 3 | Two Shared shards implemented. Three recent successful published runs measured in Snapshot 06; current-slice published CI and controlled same-SHA comparison remain pending. |
| [x] | 4 | 11 | Added informational source/test changed-line and file-count summary to the existing Supply Chain Guardrails change-detection job. The step is explicitly non-blocking, adds no required check or threshold, and handles zero-source changes. |
| [ ] | 5 | 2 | Shared, Client and Admin sub-slices implemented: eight measured aggregate glob floors and three measured exact-file floors (Cookie Jar and image compression), parity proof, deliberate below-floor failure, and full coverage enforcement. Global floors unchanged; current-SHA CI acceptance remains open. |
| [x] | 6 | 7 | Added direct proof for Cookie Jar hooks, connectivity background work, queued-upload chain/cancellation, image compression, login messaging and timeframe boundaries; paired Cookie Jar and image compression with measured file floors. Preserved the flagged-upload toast proof. All focused/selected local checks passed; current-SHA CI remains in step 5. |
| [x] | 7 | 7 | Admin excessive-withdrawal rejection, Client claim confirmation and garden-join argument/failure proof passed. Cached #802 head showed no claim test; fresh PR status/head remains network-unverified. No runtime defect was exposed. |
| [x] | 8 | 5 | Expanded helpers to 29 Shared and two Admin files. All 301 Shared test names/results match baseline; 30 focused Admin tests pass. Batch-approval cache behavior, Client persistence and custom-provider/cache/network fixtures retain their necessary setup. Existing guard passes. |
| [x] | 9 | 8 | Removed six caller-free settlement exports and their exclusive tests; retained live recognition/delivery/authority code. Eight common Agent cases run on memory and SQLite, including cap, withdrawal, sweep and revision boundaries; adapter encryption/restart proof remains. |
| [x] | 10 | 9, 10, 6b | Removed five stale WithdrawModal mocks and consolidated the PostHog throttle file without deleting its case. Retained named layout/CSS guards: current browser checks do not detect the same faults. No speculative broad file merge. |
| [ ] | 11 | 12 | Local Snapshot 06 saved with inventory, recent shard timing/worker buckets and one defined fault check. Shared coverage and local proof recorded; Client whole-suite timeouts remain blocked. Post-merge publication, controlled timings and the unrecovered original fault panel remain explicit limits. |
| [ ] | Deferred | 6a | Consider isolate:false only if setup/import costs still justify it: three comparable CI runs each way, no new failures, explicit adoption decision. |

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
| [ ] | 10 | Test-utils barrel: measure, then move only if it pays | |
| [ ] | 11 | Behavior proof for six near-zero live files | |
| [ ] | 12 | Close the ratchet (D3) | |
| [ ] | 13 | Hub closeout for this pass and Astra's handoff | |

## Current handoff

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
