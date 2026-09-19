# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`  
**Stage**: backlog  
**Status**: Preparation complete; implementation not started  
**Created**: 2026-09-19  
**Last Updated**: 2026-09-19

The user authorized preparation and saving this plan. Item numbers below refer to the supplied twelve-item test-audit prompt. Its publication and branch instructions have not been activated by this planning request.

## Decision log

| Decision | State | Reason |
|---|---|---|
| Refresh the audit and save a dedicated backlog hub | Authorized; preparation complete | Current code and PRs differ from the audit snapshot |
| Guidance → manual evidence → CI speed → critical proof → consolidation → measurement | Proposed execution order | Establish the rules and protection before removing tests |
| Ordinary push may complete with browser proof still owed at readiness | Recommendation; unresolved | Automated failures and missing automated capabilities remain blocking |
| Measured coverage floors replace the calendar-based two-point ratchet | Proposed; coordinate with architecture hub | Protect useful coverage without arbitrary percentage growth |
| Keep test isolation enabled | Default for this plan | Item 6a requires a separate measured adoption decision |
| Consolidate by subject and prove deletions | Required boundary | Similar setup does not establish equivalent fault detection |
| Work serially in bounded slices | Proposed procedure | Avoid overlapping guidance, workflow, and test rewrites |
| Existing hubs retain architecture and onboarding ownership | Required coordination | Avoid duplicate sources of execution truth |

## Ordered work

Each row is a reviewable slice or a series of independently reviewed slices, not one large PR. Split package work further when it cannot be understood and verified in one session.

| Done | Order | Original items | Work and acceptance |
|---|---|---|---|
| [x] | 0 | Preparation | Refresh targets, local branch/PR overlap, inventory, recent Shared timing, nightly coverage, and representative push plan. See the dated report; no current-head full-suite claim. |
| [ ] | 1 | 1 | Add test budget to testing.md, excess-proof review lens, and one root agent-guide pointer. Coordinate September 22 checkpoint and PRs #795/#802. Guidance checks pass; semantic evaluation only if trigger wording changes. |
| [ ] | 2 | 4 | Present both browser-evidence designs and settle policy. Implement the selected path with negative proof for automated failure, missing automated capability, and critical/readiness requirements. Review this and step 1 to close the first milestone. |
| [ ] | 3 | 3 | Two Shared CI shards through the existing wrapper. Prove a failed/missing shard cannot pass CI Gate. Keep nightly coverage unsharded; compare equivalent runner measurements. |
| [ ] | 4 | 11 | Add non-blocking ratio/file-count summary to an existing workflow. No new required check; this reporting convenience does not block step 5. |
| [ ] | 5 | 2 | Measure already-covered critical globs at the implementation baseline, verify installed Vitest threshold semantics, then add floors and parity proof. Keep global floors unchanged. A deliberate below-floor result must fail. |
| [ ] | 6 | 7 | Add missing Shared proofs in bounded subject slices: deposit/campaign, connectivity, queued-upload branches, compression, login, timeframe. Pair near-zero paths with floors. Preserve existing flagged-upload toast proof. |
| [ ] | 7 | 7 | Add Admin excessive-withdrawal rejection, then Client claim confirmation and garden-join arguments/failure proof in separate package slices. Reconcile CookieJarTab with PR #802 first. Report exposed runtime defects separately. |
| [ ] | 8 | 5 | Convert usePublicImpactEvidence.test.ts as the first helper candidate after comparing helper semantics. Show before/after and identical test names/results. Expand by package in bounded batches, retaining exceptional providers/cache behavior. Add the diff-aware guard last. |
| [ ] | 9 | 8 | Recheck six settlement exports against callers and active Commitment Pooling before deletion. Separately consolidate memory/SQLite join-request conformance and add missing production-store cases. |
| [ ] | 10 | 9, 10, 6b | Remove proven-stale mocks; replace only named layout/CSS cases with equivalent proof; merge small same-subject files only when no baseline/registry names them. Review the first file pair before rollout. |
| [ ] | 11 | 12 | After selected merges, record Snapshot 06: comparable Shared timing, worker buckets, coverage, churn, fault panel and line/file deltas. State unavailable methods explicitly. External republishing requires authorization. |
| [ ] | Deferred | 6a | Consider isolate:false only if setup/import costs still justify it: three comparable CI runs each way, no new failures, explicit adoption decision. |

## First implementation handoff

Start at step 1 after execution is selected. Read the nearest agent guides and [scope](spec.md); recheck baseline and PR overlap. Promote the hub only when work is ready to begin. Follow the plan skill's `linear-sync` start gate; this session created no Linear record, and a manifest is not permission to publish one. Preserve the selected visibility footprint and record identifiers only when a mirror is authorized.

No branches are assigned. Follow current Git authorization and shared-checkout rules rather than copying historical permissions from the attachment. Keep each change focused, record its commit, proof, remaining obligations and PR at every boundary, and do not dispatch agents automatically. A representative helper conversion and first file merge receive review before rollout.

## Follow-on order and ownership

1. After representative test improvements, reassess the Work/Agent import paths with the [architecture hub](../../active/codebase-architecture-skills/plan.todo.md). Avoid mechanically migrating setup in a subject already selected for dependency refactoring. Runtime changes remain outside this test-only scope.
2. Deliver one local write → index → displayed-result journey before expanding OrbStack concurrency. Reuse the [developer-onboarding hub](../../active/developer-onboarding/plan.todo.md) for existing first-run obligations; select the environment design separately.
3. Reconcile [builder docs PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795) as commands and policies settle. Update guidance beside its owning change; broader agent evaluations belong with architecture governance.
4. Prune verified unused forwarding files, replaced runners, and completed plans after caller/closeout checks. No root-folder purge or unresolved-plan deletion is selected here.

## Validation status

Preparation used non-mutating source/API reads and validation-plan rendering. Implementation tests, live browser QA, fresh local coverage, and controlled performance comparisons remain pending. Plan-file validation is recorded in eval.md; it does not certify product behavior.
