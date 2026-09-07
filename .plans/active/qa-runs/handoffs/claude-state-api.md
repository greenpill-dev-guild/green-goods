# QA Runs - State/API Handoff

## Lane

- Owner: Claude
- Branch: `feature/qa-runs`
- Status: in progress (2026-09-07)

## Scope

- Run index, per-run shards, migration of the legacy shards into Run 1, rollover endpoint, closed-run refusal (`packages/qa/runs.ts`, `packages/qa/api/state.ts`, `packages/qa/api/runs.ts`, `packages/qa/dev.mjs`).
- Run-aware `qa:pull`, `qa:status`, and `qa:report` (`scripts/agents/qa-state-pull.ts`, `qa-status.ts`, `qa-report.ts`).
- Catalog split with `replacedBy` successors, ledger append, docs regeneration (`scripts/data/qa-test-catalog.json`, `qa-test-id-ledger.json`).

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
