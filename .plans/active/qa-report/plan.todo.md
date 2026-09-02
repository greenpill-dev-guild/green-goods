# QA Session Report Generator Plan

**Feature Slug**: `qa-report`
**Status**: ACTIVE
**Created**: 2026-09-02
**Last Updated**: 2026-09-02

## Decision Log

See [spec.md](./spec.md) § Decision Log — decisions 1–4 locked with Afo on 2026-09-01, 5–10
derived from the code and open to challenge before Step 2.

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Results by priority and by kind from the join, never hand-counted | Steps 2–4 | ✅ |
| Session-window scoping with the slug-day default | Steps 2–3 | ✅ |
| Fail/blocked list with attributed notes (private) | Steps 3–4 | ✅ |
| Coverage gaps: never-walked by priority, stale | Step 5 | ✅ |
| Delta against a previous snapshot | Step 5 | ✅ |
| Per-tester coverage, private variant only | Steps 3–4 | ✅ |
| `--public` projection with privacy proof | Step 4 | ✅ |
| CLI + `qa:report` script | Step 6 | ✅ |
| Routine, skills, templates, and contract embed the generated sections | Step 7 | ⏳ |
| Docs name the generator; real example after the first call | Step 8 | ⏳ |
| First real report for the 2026-09-02 call | Step 9 | ⏳ |

## CLAUDE.md Compliance

- [ ] No UI strings, no i18n surface (CLI + markdown only)
- [ ] Privacy boundary from `.claude/context/qa.md` honoured in both variants
- [ ] Implementation Quality Contract applied; no speculative abstractions or mixed abstraction levels
- [ ] Guidance edits pass `check-guidance-links` and the skill behavior contract tests

## Impact Analysis

### Files to Modify
- `scripts/agents/qa-workbook-build.ts` — `kind` on `CatalogCase`; `kinds` and `statuses` on `Catalog`
- `scripts/agents/qa-status.test.ts` — fixture gains `kind`
- `package.json` — `qa:report` script
- `.claude/skills/qa-triage/linear-templates.md`, `.claude/skills/qa-triage/SKILL.md`,
  `.claude/skills/qa-session/SKILL.md`, `docs/routines/qa-call-report.md`, `.claude/context/qa.md`
- `docs/docs/builders/quality/product-experience-qa.mdx`

### Files to Create
- `scripts/agents/qa-report.ts`
- `scripts/agents/qa-report.test.ts`

## Test Strategy

- **Unit tests** (vitest, `scripts/agents`): model building with the `makeCase` / `shard`
  fixture pattern from `qa-status.test.ts` — window inclusion/exclusion, bucket reconciliation,
  kind and priority grouping, standing vs session verdicts, delta with and without a baseline,
  stale reuse; render tests asserting the template line shape byte-for-byte and the public
  privacy invariant on a fixture that contains a person label, a note, and a `0x` string; CLI
  `parseArgs` tests for every flag and every rejection.
- **Integration tests**: `bun run test:review-guardrails` for the guidance edits;
  `bun run check:docs-generated` and the docs build for the page edit.
- **E2E tests**: not applicable — no product UI changes.
- **Manual check**: a dry run on a real pulled session (needs `BLOB_READ_WRITE_TOKEN` for the
  pull only) producing the 2026-09-02 call's first real report.

## Implementation Steps

### Step 1: Type the catalog's kind and lifecycle
**Files**: `scripts/agents/qa-workbook-build.ts`, `scripts/agents/qa-status.test.ts`
**Details**: Add `kind: string` to `CatalogCase` and `kinds`/`statuses` to `Catalog`; extend
`validateCatalog` only if it enumerates fields; give the test fixture a `kind`.
**Verify**: `bun --bun x vitest run scripts/agents` stays green.

### Step 2: RED — model tests
**Files**: `scripts/agents/qa-report.test.ts`
**Details**: Tests for `buildReportModel`: an entry one second outside the window is excluded;
the default window is the slug day; every bucket reconciles; kind buckets sum to the priority
total; a case touched only outside the window lands in `standing`; `delta` is `null` without a
baseline.
**Verify**: the suite fails on a missing module — record the RED command and evidence.

### Step 3: GREEN — model
**Files**: `scripts/agents/qa-report.ts`
**Details**: `buildReportModel(cases, entries, options)` as a pure function reusing
`rollupVerdict`, `notesFor`, and `summarize`-style bucket logic from `qa-state.ts`; window
parsing; per-tester touched/decided counts.
**Verify**: Step 2 tests pass — record the GREEN command and evidence.

### Step 4: Render both variants
**Files**: `scripts/agents/qa-report.ts`, `scripts/agents/qa-report.test.ts`
**Details**: `renderReport(model, catalog, { variant })`; the "Results by priority" lines match
`linear-templates.md` with zero segments dropped; the public variant collapses testers to a
count and omits notes.
**Verify**: byte-equality test against the template line; privacy negative test.

### Step 5: Gaps and delta
**Files**: `scripts/agents/qa-report.ts`, `scripts/agents/qa-report.test.ts`
**Details**: never-walked grouped by priority; `findStaleCases` from `qa-status.ts` with the
window end as `now`; `--previous` baseline diff over standing verdicts with the unknown/retired
trailer.
**Verify**: fixture with a baseline where one case flips Fail → Pass and one Pass → Fail.

### Step 6: CLI and package script
**Files**: `scripts/agents/qa-report.ts`, `package.json`, `scripts/agents/qa-report.test.ts`
**Details**: `parseArgs` in the `qa-status` style (unknown flag and missing value rejections),
`main()` reading `<out>/qa-state.json`, writing `report.md` and optionally `report.public.md`,
`import.meta.main` guard, error messages free of note content.
**Verify**: `bun run qa:report --slug fixture --out <tmp>` on a checked-in fixture writes both
files; `parseArgs` tests green.

### Step 7: Wire the routine, skills, template, and contract
**Files**: `.claude/skills/qa-triage/linear-templates.md`, `docs/routines/qa-call-report.md`,
`.claude/skills/qa-triage/SKILL.md`, `.claude/skills/qa-session/SKILL.md`, `.claude/context/qa.md`
**Details**: per [spec.md](./spec.md) § Wiring — the results blocks are pasted from `qa:report`;
Phase 4 of `qa-session` runs it after `qa:pull` and files a Linear parent only with slices.
**Verify**: `bun run test:review-guardrails` green; `node scripts/quality/check-guidance-links.mjs` OK.

### Step 8: Docs
**Files**: `docs/docs/builders/quality/product-experience-qa.mdx`
**Details**: one clause in § After the call naming `qa:report`; after Step 9, replace the
template block with the real `--public` report.
**Verify**: docs build green.

### Step 9: First real report
**Files**: none in the repo (private `tmp/qa-session/2026-09-02/`)
**Details**: pull the 2026-09-02 call, run `qa:report` with the call window and Vercel SHAs, and
paste the results blocks into the Linear parent; confirm no hand-counted numbers remain.
**Verify**: the parent's results block equals the generated one.

## Validation

- [ ] `bun --bun x vitest run scripts/agents` (or `bun run test:agent-tools`)
- [ ] `bun run test:review-guardrails`
- [ ] `bun run check:docs-generated` and `cd docs && bun run build` when Step 8 lands
- [ ] `bun run validation:plan -- --intent push` before the push gate

### Fresh Evidence Receipt
- **Tested implementation commit SHA**: pending
- **Run at (UTC)**: pending
- **Command**: pending
- **Result**: pending
- **Validated paths**: `scripts/agents/qa-report.ts`, `scripts/agents/qa-report.test.ts`, `scripts/agents/qa-workbook-build.ts`, `package.json`
- **Worktree identity command and result**: pending
