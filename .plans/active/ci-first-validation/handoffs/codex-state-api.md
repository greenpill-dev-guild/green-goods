# CI-First Validation Balance - State/API Handoff

## Lane

- Owner: Codex
- Branch: `perf/ci-first-validation`
- Status: implementation and local Ship Gate complete; GitHub CI pending

## Scope

- Implement the bounded push selector, hard deadline, exact receipt reuse, local hook reductions,
  CI routing cuts, and agent workflow alignment accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- No product package API or UI behavior changed.

## TDD Proof

- RED: `node --test scripts/quality/select-validation.test.mjs scripts/dev/ci-local.test.mjs scripts/quality/workflow-performance-parity.test.mjs` produced 9 expected failures before implementation.
- GREEN: `bun run test:validation-system` completed 189 tests with no failures after implementation.
- Proof limit: none.

## Validation

- Representative calendar push plans selected only changed-path format/lint, the focused behavior
  test, and source structure. The three measured runs completed in 2.89s, 0.86s, and 0.84s.
- `node scripts/dev/ci-local.js --intent ship --reuse-passing-receipts` passed all 11 mandatory
  selected checks, including 189 validation-system tests, 65 ontology tests plus drift guards,
  docs build, Design, agent guidance, and supply-chain/Plan Hub validation.
- `bun format`, `bun lint`, and `VITE_CHAIN_ID=11155111 bun run build` passed. The uncached root
  suite passed Contracts, Shared, Indexer, Client, and Agent; two Admin tests failed only under the
  parallel full-suite load and then passed in isolation at 7/7 and 6/6. Current-head GitHub CI
  remains the broad merge authority.

## Validation Receipt

- Tested implementation commit SHA: `a273b140d5f72727538f2412e0ed9dbdefeb3e0e`
- Run at (UTC): `2026-09-01T03:45:57Z`
- Exact command(s): `node scripts/dev/ci-local.js --intent ship --reuse-passing-receipts`;
  `bun format`; `bun lint`; `bun run test`; `VITE_CHAIN_ID=11155111 bun run build`;
  `bun run test src/__tests__/components/CreateAssessmentDialog.test.tsx` and
  `bun run test src/__tests__/components/CreateHypercertDialog.test.tsx` from `packages/admin`.
- Result: selected Ship Gate passed all 11 mandatory checks; production build passed; full package
  proof is green except for two parallel-contention Admin false negatives that both passed on exact
  isolated rerun. GitHub CI remains required for current-head merge readiness.
- Validated paths: `scripts/`, `.github/workflows/`, `.husky/`, `.claude/`, `AGENTS.md`, and `docs/`.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts .github/workflows .husky .claude AGENTS.md docs` returned no output (clean).
- Evidence-only diff command and result (if applicable): `git diff --exit-code a273b140d..HEAD -- scripts .github/workflows .husky .claude AGENTS.md docs` exited 0 with no output.
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- scripts .github/workflows .husky .claude AGENTS.md docs` returned no output (clean).

## Risks / Blockers

- GitHub CI cannot be evaluated until the branch is pushed and the PR exists. The two Admin
  full-suite contention failures are not implementation regressions but remain visible until CI
  supplies independent current-head package results.
