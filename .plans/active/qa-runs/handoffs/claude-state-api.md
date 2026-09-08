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
- `packages/qa/api/runs.ts` — GET lists runs; POST `{ action: "rollover", expectedOpenRun?, label, environment, builds?, catalog? }` closes and opens in one ETag-conditional write, 409 `stale` when the expected run is no longer open, 409 with the fresh index on contention, carries tester names into the new run.
- Review fixes (PR #805): `store.readText` reads the ETag from `result.blob.etag` (the pre-existing `result.etag` read had made every conditional write unconditional); a save whose run closed between the index check and the shard write is restored and re-applied to the open run (`retargeted: true`); `qa:report` merges converging predecessors, counts note-only entries as newly walked, keeps the run label out of the public variant, and refuses a later run as the baseline; `resolveCaller` returns one generic misconfiguration message.
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

- Tested implementation commit SHA: `0bd2c4cdbc5b688ca4398eba32e5d423392d570c`
- Run at (UTC): `2026-09-07T22:55:00Z`
- Exact command(s): `bun run test:agent-tools && bun run test:review-guardrails && bun run check:docs-generated && bun run check:qa-id-ledger && bun run check:guidance-links && node scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
- Result: `250 tests passed; guardrails 0 failures; 18 projections current; ledger 175 ids clean; 61 guidance files OK; node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts → format, lint, docs-authority, agent-guidance, qa-id-ledger, agent-tools-test (250 tests) passed; browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension (tabs_context probe failed), so rendered proof is recorded BLOCKED and belongs to the 2026-09-08 deployed smoke`
- Validated paths: `packages/qa, scripts/agents, scripts/data, docs/docs/builders/quality, .claude/context/qa.md, .claude/skills/qa-session, .claude/skills/qa-triage, docs/routines/qa-call-report.md`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/qa scripts/agents scripts/data docs/docs/builders/quality .claude/context/qa.md .claude/skills/qa-session .claude/skills/qa-triage docs/routines/qa-call-report.md` → `` (empty)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- A POST that read the index just before a rollover is caught after its shard write: the closed shard is restored to its pre-write text and the delta is re-applied to the open run (`retargeted: true`); the store test proves it with a put hook that slips a rollover between the check and the write. The restore itself is one conditional write into the closed run that returns it to its at-close content.
- The migration enumerates the allowlist, so a de-listed tester's legacy shard stays only on the legacy path; `qa:pull`'s fallback still reads it.
- `ensureRunIndex` adds one origin read per request; acceptable for a three-tester team.

## Second pass · PWA half (2026-09-07, `feature/qa-runs-pwa-split`)

- Branch stacked on `feature/qa-runs`; PR #806 targets `feature/qa-runs`, not `develop`, so the first PR's review stays intact and the two merge together.
- Catalog: 7 retirements with `replacedBy` (PWA-027, 029, 030, 031, 032, 033, 039) and 36 new ids (PWA-067…102); the successor table and the acts the grouped rows never named are in `catalog-feedback-2026-09-04.md § Second pass`. Ledger append; `test-cases.mdx` regenerated; no journey-referenced row changed, so the QA app locales are untouched. Active cases 185 (PWA 93); the QA app projection ships `replaces` for every successor, and PWA-081…093 also inherit PWA-IOS-009 through the existing PWA-032/033 chain.
- Read-only rows (feedback C20): PWA-097 garden header and Work tab, PWA-098 Insights, PWA-099 Gardeners, PWA-100 Pool tab, PWA-101 commitment detail, PWA-102 Commitments drawer; the steward bell on the garden page is PWA-094.
- Still post-Tuesday: admin C18 rows, public rows, the C19 area re-cut (the new rows already use the target area names), a desktop work-detail read row, "Offer It Again".

### Validation Receipt

- Tested implementation commit SHA: `bfd4a501606af90274ccb6ceecbbc5c7a0917a14`
- Run at (UTC): `2026-09-07T23:28Z`
- Exact command(s): `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts && bun run test:review-guardrails && bun run check:docs-generated && bun run check:guidance-links && node scripts/quality/check-qa-id-ledger.mjs --base feature/qa-runs && node scripts/harness/plan-hub.mjs validate qa-runs && node packages/qa/build.mjs`
- Result: `push gate: format, lint, docs-authority, agent-guidance, qa-id-ledger (211 ids), agent-tools-test (11 files, 250 tests) passed; browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension (tabs_context probe failed), so rendered proof of the new rows belongs to the 2026-09-08 deployed smoke; review guardrails 205 passed; 18 projections current; 61 guidance files OK; ledger clean against feature/qa-runs; 31 hubs valid; qa build 185 active cases, 66 successors carrying replaces`
- Validated paths: `scripts/data, docs/docs/builders/quality, .plans/active/qa-runs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts/data docs/docs/builders/quality .plans/active/qa-runs` → `` (empty before this receipt was written)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Third pass · admin, public website, docs (2026-09-07, `feature/qa-runs-catalog-third-pass`)

- Branch stacked on `feature/qa-runs-pwa-split`; PR #807 targets that branch. Merge order: third → second → `feature/qa-runs` → `develop`.
- Catalog: 24 retirements with `replacedBy` (ADM-009/010/020/021/022/023/024/025/027/028/029, PUB-014/017/020/021/022/023/024, DOCS-007/008/009/010/012/013), 101 new ids (ADM-048…108, PUB-035…055, DOCS-014…032), 4 in-place rewrites (ADM-019, PUB-001, PUB-010, PUB-031). Successor map and product findings in `catalog-feedback-2026-09-04.md § Third pass`. Journey-referenced rows untouched; locales unchanged. Active cases 262 (Admin 98, Public 45, Docs 26, PWA 93).
- Evidence pack: admin acts read from `packages/admin/src/routes/views.tsx` and the views it mounts; public acts from `packages/client/src/config/routes.tsx` and `views/Public/*`; labels from `packages/shared/src/i18n/en.json`; docs pages from `docs/sidebars.ts`.

### Validation Receipt

- Tested implementation commit SHA: `d585308d3c65ba172d6fe015be7c1bca759b146c`
- Run at (UTC): `2026-09-08T03:10Z`
- Exact command(s): `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts && bun run test:review-guardrails && bun run check:docs-generated && bun run check:guidance-links && node scripts/quality/check-qa-id-ledger.mjs --base feature/qa-runs-pwa-split && node scripts/harness/plan-hub.mjs validate qa-runs && node packages/qa/build.mjs`
- Result: `push gate: format, lint, docs-authority, agent-guidance, qa-id-ledger (312 ids), agent-tools-test (11 files, 250 tests) passed; browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension, so rendered proof belongs to the next deployed smoke; review guardrails # pass 205 # fail 0 ; 18 projections current; 61 guidance files OK; ledger clean against feature/qa-runs-pwa-split; 31 hubs valid; qa build 262 active cases with replaces on 149 successors; parse-level comparison with the parent: 183 rows unchanged, 28 changed (24 retired, 4 rewritten), 101 added, none missing`
- Validated paths: `scripts/data, docs/docs/builders/quality, .plans/active/qa-runs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts/data docs/docs/builders/quality .plans/active/qa-runs` → `` (empty before this receipt was written)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Fourth pass · C19 area re-cut (2026-09-07, `feature/qa-runs-area-recut`)

- Branch stacked on `feature/qa-runs-catalog-third-pass`; PR #808 targets that branch. Merge order: fourth → third → second → `feature/qa-runs` → `develop`.
- Catalog: every active row's `area` names where the walker sits (74 → 45 areas; 181 of 262 active rows re-labelled); the cases array is re-sorted tab → active first → walking-order area → desktop shell before installed devices → previous order; retired rows keep their historical area; no id or lifecycle change; journeys untouched. Taxonomy per tab in `catalog-feedback-2026-09-04.md § Fourth pass`.
- Reading the diff: it is a full reorder. Parse-level comparison with the parent (`git show feature/qa-runs-catalog-third-pass:scripts/data/qa-test-catalog.json` versus the working copy, keyed by id): 181 rows differ only in `area`, 131 byte-identical, none added or removed, `journeys` and the header equal.
- Consumers checked: the QA app groups areas by first appearance (`packages/qa/index.html` walk order), the workbook groups by area, the docs page prints the column, `qa-report` prints the area on issue lines, and `qa-app-client.test.ts` uses its own fixture areas. Nothing reads an area name by value.

### Validation Receipt

- Tested implementation commit SHA: `7ef9f108ec0dcccb8192511ce1134dc2fb778496`
- Run at (UTC): `2026-09-08T04:01Z`
- Exact command(s): `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts && bun run test:review-guardrails && bun run check:docs-generated && bun run check:guidance-links && node scripts/quality/check-qa-id-ledger.mjs --base feature/qa-runs-catalog-third-pass && node scripts/harness/plan-hub.mjs validate qa-runs && node packages/qa/build.mjs && bun --bun x vitest run --dir scripts/agents qa-app-build qa-workbook-build qa-report qa-status qa-state-pull qa-app-client`
- Result: `push gate: format, lint, validation-system-test, docs-authority, agent-guidance, qa-id-ledger (312 ids), agent-tools-test passed (exact receipts reused on the second run); browser-proof blocked: the authenticated Brave QA profile was unreachable through the Claude-in-Chrome extension, so rendered proof of the Area view belongs to the next deployed smoke; review guardrails 205 passed, 0 failed; 18 projections current; 61 guidance files OK; ledger clean against the third pass; 31 hubs valid; qa build 262 active cases with areas in walking order; 6 catalog test files, 147 tests passed`
- Validated paths: `scripts/data, docs/docs/builders/quality, .plans/active/qa-runs`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts/data docs/docs/builders/quality .plans/active/qa-runs` → `` (empty before this receipt was written)
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
