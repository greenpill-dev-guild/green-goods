# Codex State/API Handoff

1. What changed: this lane owns the one declared cleanup surface per run and the implementation must stay entirely inside that surface.
2. What remains: when the hub is promoted, pick the first still-valid candidate from `../spec.md`, declare it before editing, run validation, emit one JSONL run record, and update lane state.
3. Validation run: required per live run — targeted package tests for touched files, `node scripts/ci-local.js --quick`, and `node scripts/plan-hub.mjs validate` if plan files changed.
4. Known risks or blockers: do not touch shared tests/Storybook work, `packages/admin/src/views/**`, route files, navigation structure, `packages/shared/src/hooks/**`, `packages/shared/src/providers/**`, or `packages/agent`, `packages/contracts`, `packages/indexer`.
5. Repo-truth references: `../brief.md`, `../spec.md`, `../plan.todo.md`, `../eval.md`, `../metrics.md`, `../status.json`
