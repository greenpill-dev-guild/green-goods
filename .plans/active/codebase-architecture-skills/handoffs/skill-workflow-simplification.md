# Skill workflow simplification

The accepted audit follow-up repairs cleanup proof and validation, isolates auxiliary QA
extraction without Git mutations, and makes the QA triage entrypoint disclose its active branch.
The user authorized implementation in an isolated worktree and publication as a draft PR.
No product behavior, dependencies, permission settings, or live QA records are changed.

## Scope and decisions

- A passing suite cannot settle evidence that removed code still has consumers. Cleanup now
  verifies the cited caller or runtime path and classifies the demonstrated consequence.
- Cleanup baseline and post-change checks use the canonical validation selector, including
  critical overrides, instead of independent full-suite command lists.
- Auxiliary extraction copies notes, prompt, and schema into a fresh temporary directory. The
  read-only ephemeral child runs outside Git; its result returns to the run workspace. Current-run
  scratch ownership is recorded; failed and pending work remains resumable. Legacy Git worktrees
  require separately authorized cleanup.
- QA triage keeps its existing discovery description, flags, external-write gates, exact-ID rule,
  private Sheet boundary, late-result handling, and call-mode behavior. Its entrypoint shrank from
  567 to 75 lines; call, intake, and filing details are conditional references. This is a loading
  change, not a measured token or latency improvement.
- Four duplicate personal skills were consolidated on the operator's machine. Originals were
  backed up, Claude compatibility aliases retained, redundant legacy Codex discovery entries
  retired, and Dev Surfaces UI metadata preserved. Those host-local changes are outside this PR;
  private paths and backup contents stay out of Git.

The closest existing mechanisms are the QA prompt template, guidance regression suite, validation
selector, and this hub's pilot. No new skill, runtime helper, or evaluation framework is added.

## Verification

The first focused run before the dispatch correction passed five existing tests and failed all
four new cases on the attempted Git command. After correction, all nine cases passed. The tests
execute the documented shell recipe with a local child stub, proving:

- no Git operation and only copied inputs in the child directory;
- read-only, ephemeral execution and exclusion of parent service credentials;
- fresh scratch for repeated runs and preservation of evidence after child failure;
- no child launch when a required input cannot be copied.

Command: `node --test scripts/quality/check-codex-docs.test.mjs`.
This is command-boundary proof; it does not prove model extraction accuracy or live filing.

Working-tree guidance checks passed: `node scripts/quality/check-codex-docs.js`,
`node scripts/quality/check-skill-behavior-contracts.mjs` (15 scenarios and 15 routes), and
`node scripts/quality/check-guidance-links.mjs` (97 files; unrelated DL-042 warning).
These observations preceded the commit and are not a commit-attributed readiness receipt.
The PR carries the committed Push Gate and current-head CI state.

The broader focused regression run passed 59 tests. Docs authority passed 81 tests, the docs
build indexed 78 live routes, all test-quality checks passed, and 32 Plan Hubs validated. The
first worktree runs lacked workspace dependency links; reusing existing installed dependencies
resolved those environment failures without installation or lockfile changes. Docs authority
retains two unrelated advisory endpoint warnings.

## Pilot and trial limits

The ordinary documentation-correction observation is recorded in `eval.md`. The prior bug-fix
observation remains intact. Domain change, UI correction, bounded runtime refactor, and Claude
Desktop Code observation still need normally authorized work; no product tasks were invented.

One independent agent used the original QA instructions and synthetic notes to produce six
findings, preserve supplied Test IDs, and state unavailable live checks. The second agent could
not start because workspace credits were exhausted. The before/after comparison remains
incomplete; no behavioral improvement or equivalence is claimed from it. The unchanged discovery
description did not require another billed description-classifier run.

The parent verified PRD-835 is In Progress after reviewing the parent-only sync manifest.
No Linear fields or QA services were written. Browser proof: none; no UI runtime changed.

## Task record

Task: skill workflow simplification | Type: guidance | Outcome: implementation with pilot limits
Agent: Codex; exact model unknown | Coverage: this implementation segment

| Phase | Start → end (UTC) | Evidence |
|---|---|---|
| Investigate | 2026-10-25 02:51:04 → unknown | Fresh integration base, owning guidance, and prior pilot inspected |
| Implement | Unknown → 2026-10-25 03:11:21 | Approved skill changes and local discovery consolidation |
| Verify | Unknown → 2026-10-25 03:11:21 | Working-tree proof above; committed publication gate follows separately |

Human corrections: 0 observed; human attention: unknown.

## Requested review corrections

The user authorized both P2 findings from the follow-up review of PR #1273. Extraction now
writes into the current attempt's scratch and publishes only after a successful child exit.
Redispatch invalidates the success pointer before setup; the completion handler requires matching
attempt pointers, a completion marker, and matching result contents. Previous results and scratch
pointers remain evidence, including when setup or the child fails.

The manual fallback now renders a separate prompt with absolute paths to the existing notes and
schema. It works when automatic dispatch is skipped or fails before input copies. Unreadable
inputs stop rendering and withdraw an older manual prompt. Manual responses still require parent
validation, deduplication, and the additive scope gate.

Before correction, nine existing tests passed and four new regression tests failed. After
correction and an additional scratch-allocation failure case, all 14 focused tests pass. They
exercise the documented recipes, including failed redispatch, CLI/input setup failure, partial
output, recovery, paths with spaces, and manual input resolution from another directory. Test
growth exceeds executable recipe growth to cover these failure and fallback boundaries.

The working-tree QA selector passed all five selected checks: formatting, lint, docs authority,
docs build, and agent guidance. Docs authority passed 81 tests, the docs build indexed 78 routes,
and guidance passed 15 scenarios, 15 routes, and 97 files. Existing advisory warnings remain as
recorded above. Committed Push Gate and current-head CI evidence belong in the PR. These fixes do
not fill the remaining real-task or model-comparison pilot rows.

Task record: PR #1273 review corrections | Type: fix | Outcome: implemented; publication follows
Agent: Codex; exact model unknown | Coverage: this review-correction segment

| Phase | Start → end (UTC) | Evidence |
|---|---|---|
| Investigate | 2026-10-25 04:33:02 → unknown | Both accepted review findings traced to the documented recipes |
| Implement | Unknown → 2026-10-25 04:38:11 | Attempt-scoped publication and portable manual fallback |
| Verify | 2026-10-25 04:38:11 → 2026-10-25 04:41:53 | Focused regressions and selected QA checks passed |
| Review | 2026-10-25 04:41:53 → ongoing | Final diff and failure boundaries inspected before publication |

Human corrections: 0 observed; human attention: unknown.
