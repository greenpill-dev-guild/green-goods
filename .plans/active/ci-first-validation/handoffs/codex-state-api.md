# CI-First Validation Balance - State/API Handoff

## Lane

- Owner: Codex
- Branch: `perf/ci-first-validation`
- Status: implementation complete; final Ship Gate and GitHub CI pending

## Scope

- Implement the bounded push selector, hard deadline, exact receipt reuse, local hook reductions,
  CI routing cuts, and agent workflow alignment accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- No product package API or UI behavior changed.

## TDD Proof

- RED: `node --test scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs scripts/quality/workflow-performance-parity.test.mjs` produced 9 expected failures before implementation.
- GREEN: `bun run test:validation-system` completed 188 tests with no failures after implementation.
- Proof limit: none.

## Validation

- Interim dirty-tree evidence: validation-system 188 tests; ontology 65 tests plus all drift guards;
  skill behavior 15 scenarios/15 routes; guidance links 61 files.
- Final commit-attributed Ship Gate and timing receipts remain pending.

## Validation Receipt

- Tested implementation commit SHA: pending final commit
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- GitHub CI cannot be evaluated until the branch is pushed and the PR exists.
