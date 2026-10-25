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
