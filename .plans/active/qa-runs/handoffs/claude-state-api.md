# QA Runs - State/API Handoff

## Lane

- Owner: Claude
- Branch: `feature/qa-runs`
- Status: passed (implementation and local proof complete 2026-09-07; the deployed two-tester smoke is `qa_pass_1`)

## Scope

- Run index, per-run shards, migration of the legacy shards into Run 1, rollover endpoint, closed-run refusal (`packages/qa/runs.ts`, `packages/qa/store.ts`, `packages/qa/api/state.ts`, `packages/qa/api/runs.ts`, `packages/qa/dev.mjs`).
- Run-aware `qa:pull`, `qa:status`, and `qa:report` (`scripts/agents/qa-state-pull.ts`, `qa-status.ts`, `qa-report.ts`).
- Catalog split with `replacedBy` successors, ledger append, docs regeneration (`scripts/data/qa-test-catalog.json`, `qa-test-id-ledger.json`).

## What changed

- `packages/qa/runs.ts` — the pure run model: `RunRecord` / `RunIndex`, `runIndexShapeError`, `legacyRunRecord`, `rolloverIndex`, input validators. Erasable TypeScript so `dev.mjs` imports it under Node's type stripping (engine floor `>=22.19`).
- `packages/qa/store.ts` — the Blob half shared by both endpoints: shard shape, `readText`, `putCreateOnly` (create, confirm by read on failure), `putConditional`, `readRunIndex`, `ensureRunIndex` (first-contact migration: create-only copies, create-only index, idempotent, legacy never written).
- `packages/qa/auth.ts` — `resolveCaller` moved here from the state endpoint.
- `packages/qa/api/state.ts` — `?run=<id>` (default open; 404 for an unknown id on GET), `runs`/`run`/`openRun` in the response, POST `run` field: missing → open run, malformed → 400, closed or unknown → 409 `{ reason, openRun }` with no write.
- `packages/qa/api/runs.ts` — GET lists runs; POST `{ action: "rollover", label, environment, builds?, catalog? }` closes and opens in one ETag-conditional write, 409 with the fresh index on contention, carries tester names into the new run.
- `packages/qa/dev.mjs` — file-backed runs (`tmp/qa/runs.json`, `runs/<id>/<name>.json`), migration of `tmp/qa/<name>.json`, `/api/runs`, `QA_DEV_STATE_DIR`, dev pseudo-addresses for openedBy/closedBy.
- `scripts/agents/qa-state-pull.ts` — `--run open|latest-closed|run-N`, `readRunIndex`, `selectRun`, `readRun` with the legacy fallback and warning, `run` in `qa-state.json`; `qa-status.ts` open-run line; `qa-report.ts` run-labelled baseline, `newlyWalked`, `inherited` via `successorMap` (public heading `## Delta vs previous run`); `CatalogCase` gains the lifecycle fields.
- Catalog: 8 retirements (PWA-021, 035, 036, 037, 038, 043, 044, PWA-AND-003) with `replacedBy`, 22 new ids, wording fixes per `catalog-feedback-2026-09-04.md § Disposition`; ledger append; `docs/docs/builders/quality/test-cases.mdx` regenerated; ADM-026 in all three locales.

## What remains

- The deployed first contact (migration on the live store) and Tuesday's rollover are `qa_pass_1`.
- Fast-follow candidates (not blocking Tuesday): `qa:status --run`, a `--previous <run id>` shorthand that resolves the pulled directory, migration enumeration by `list()` for de-listed testers.

## TDD Proof

- RED: `bun --bun x vitest run --dir scripts/agents qa-app-store` — the concurrent-rollover case returned `[200, 200]` (expected `[200, 409]`) until the keyed Blob mock gated both index reads on one ETag; the migration, closed-run, and unknown-run cases were written before `store.ts` existed and failed on missing imports.
- GREEN: `bun run test:agent-tools` — Test Files 11 passed, Tests 245 passed (2026-09-07).
- Proof limit: none

## Validation

- `bun run test:agent-tools` — 245 passed.
- `bun run test:review-guardrails` — 0 failures.
- `bun run check:docs-generated` — 18 projections current.
- `bun run check:qa-id-ledger` — 175 ids, none removed, reintroduced, or reactivated since `3922caa8c`.
- `bun run check:guidance-links` — 61 guidance files OK.
- Local rehearsal (`node packages/qa/build.mjs && node packages/qa/dev.mjs` with a pre-runs `tmp/qa/`): first request migrated Run 1 with byte-identical copies and the right window; a verdict recorded into Run 1; Gui's rollover produced Run 2 (client SHA and catalog revision recorded, names carried, Run 1 untouched); the compare read Run 1's PWA-021 fail onto PWA-052 as inherited; Run 1 rendered read-only.
- `bun run drift:check` fails on `check:docs-design-parity` (`docs/DESIGN.md` vs `docs/src/css/custom.css`), which this branch does not touch — pre-existing on `develop`.

## Validation Receipt

- Tested implementation commit SHA: `62e2d604356c2eb0b1c2c8a2dbb1cb0f3ca25c93`
- Run at (UTC): `2026-09-07T22:19:00Z`
- Exact command(s): `bun run test:agent-tools && bun run test:review-guardrails && bun run check:docs-generated && bun run check:qa-id-ledger && bun run check:guidance-links && node scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
- Result: `245 tests passed; guardrails 0 failures; 18 projections current; ledger 175 ids clean; 61 guidance files OK; node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts → format, lint, docs-authority, agent-guidance, qa-id-ledger, agent-tools-test (245 tests) passed; browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension (tabs_context probe failed), so rendered proof is recorded BLOCKED and belongs to the 2026-09-08 deployed smoke`
- Validated paths: `packages/qa, scripts/agents, scripts/data, docs/docs/builders/quality, .claude/context/qa.md, .claude/skills/qa-session, .claude/skills/qa-triage, docs/routines/qa-call-report.md`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/qa scripts/agents scripts/data docs/docs/builders/quality .claude/context/qa.md .claude/skills/qa-session .claude/skills/qa-triage docs/routines/qa-call-report.md` → `` (empty)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- A POST that read the index just before a rollover is caught after its shard write: the closed shard is restored to its pre-write text and the delta is re-applied to the open run (`retargeted: true`); the store test proves it with a put hook that slips a rollover between the check and the write. The restore itself is one conditional write into the closed run that returns it to its at-close content.
- The migration enumerates the allowlist, so a de-listed tester's legacy shard stays only on the legacy path; `qa:pull`'s fallback still reads it.
- `ensureRunIndex` adds one origin read per request; acceptable for a three-tester team.
