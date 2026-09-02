# QA Session Report Generator - State/API Handoff

## Lane

- Owner: Claude
- Branch: set when work begins using `<type>/<work-description>`
- Status: pending implementation

## Scope

- Implement `scripts/agents/qa-report.ts` (pure model + renderer + thin CLI) and
  `scripts/agents/qa-report.test.ts` per `spec.md`; type `kind` on `CatalogCase`; add the
  `qa:report` package script; wire the routine, both QA skills, the parent template, and the QA
  contract per `spec.md` § Wiring.
- No QA app, Blob, Linear, Discord, or Sheet changes.

## TDD Proof

- RED (2026-09-02T03:12:16Z): `bun --bun x vitest run scripts/agents/qa-report.test.ts` →
  `Test Files 1 failed` — `Cannot find module './qa-report'`; the seven Step 2 specs (window
  parsing and inclusivity, bucket reconciliation across priority/kind/tab, standing state, attributed
  issues, per-tester counts) were unrun because the module did not exist.
- GREEN (2026-09-02T03:13:56Z): same command → `Tests 7 passed (7)`;
  `bun --bun x vitest run --dir scripts/agents` → `Test Files 11 passed (11)`, `Tests 165 passed (165)`.
- Proof limit: none recorded

## Batch 1 (Steps 1–3) — what changed

- `qa-workbook-build.ts`: `kind` on `CatalogCase`, `CatalogKind` + `kinds` on `Catalog`. The
  `statuses` typing planned in Step 1 is deferred: `feature/qa-report` is based on `develop`, and the
  lifecycle fields live on the unmerged `chore/qa-lifecycle-polish`; the generator needs only `kind`
  and `priority`.
- `qa-report.ts`: `parseWindow`, `buildReportModel` (session-window scoping, buckets by priority,
  kind, and tab, issues with session notes, never-walked and stale gaps, standing fail/blocked,
  per-tester touched/decided). `delta` is typed `null` until Step 5 adds the `--previous` baseline.
- Test fixtures in `qa-status`, `qa-state`, and `qa-workbook-build` gained `kind`.

## What remains

- Step 4 renderers (private/public) with template byte-parity and the privacy negative test.
- Step 5 delta + gap tests; Step 6 CLI and `qa:report` script; Steps 7–9 wiring, docs, first real run.

## Validation

- `bun --bun x vitest run --dir scripts/agents` green at the GREEN timestamp above (see receipt at
  lane close; this is batch evidence, not the terminal receipt).

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
