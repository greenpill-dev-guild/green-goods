# QA Session Report Generator

**Slug**: `qa-report`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-09-02T02:56:50.292Z`

## Problem

One QA session currently produces three partial reports with three shapes. `qa-session` writes a
private receipt at close, `qa:pull` writes raw `results.csv` and `qa-state.json`, and only team
calls get the Linear `QA session <date>` parent — assembled by prompt-driven hand-joins, because
neither `qa:pull` nor `qa:status` knows the catalog's priority or kind. The shapes drifted far
enough that the public QA guide carried a mock report whose headings exist nowhere, and solo or
paired sessions never reach Linear at all.

## Desired Outcome

- One deterministic report core generated from the pulled session state joined to the catalog:
  results by priority and by kind, the fail/blocked list, coverage gaps, a delta against a previous
  snapshot, and per-tester coverage.
- Every session writes `tmp/qa-session/<slug>/report.md`; the Linear parent is filed for team
  calls and for sessions that produced fix slices.
- `qa-session` close, `/qa-triage --call`, and the `qa-call-report` routine embed the generated
  sections instead of counting by hand.
- A `--public` projection (IDs, counts, tester count only) exists for exactly two uses: the docs
  page's real example and the Discord lede.

## Scope Notes

- In scope: `scripts/agents/qa-report.ts` with tests, the `qa:report` package script, the
  `kind` field on `CatalogCase`, and the wiring in `linear-templates.md`, `qa-call-report.md`,
  the `qa-triage` and `qa-session` skills, `.claude/context/qa.md`, and one sentence on the
  Product Experience QA page.
- Out of scope: any change to the QA app or its Blob store, reading the store from the generator
  (it reads a pulled `qa-state.json`), Linear or Discord writes from the script, Sheet writes, and
  reconstructing verdict history the store never kept.

## Success Signal

`bun run qa:report --slug <date> --window <start>..<end>` on a pulled session reproduces the parent
template's "Results by priority" block from the join alone, and the 2026-09-02 call's Linear parent
is written from generated sections with zero hand-counted numbers.
