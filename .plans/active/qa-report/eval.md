# QA Session Report Generator Evaluation Plan

## Release Gates

1. Correctness: every bucket reconciles and only in-window entries count as the session's verdicts.
2. Parity: the generated "Results by priority" block is byte-identical to the parent template's line shape.
3. Privacy: the public variant carries no person label, note text, or address, on a fixture that contains all three.
4. Honesty: a missing baseline is stated, never faked; unknown or retired IDs in a baseline are reported, never dropped.
5. Adoption: the routine, both skills, and the template point at `qa:report`; no prompt asks for hand-counted rollups.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Window scoping | An entry one second outside the window is excluded; the default window is the slug day | `state_api` | Pending |
| AC-2 | Bucket reconciliation | `walked = pass + fail + blocked + na + noted` per priority, kind, and tab; kind totals equal the priority totals | `state_api` | Pending |
| AC-3 | Template parity | "Results by priority" lines equal the template line shape with zero segments dropped | `state_api` | Pending |
| AC-4 | Public privacy | Public render contains no person label, note text, or `0x` string; testers appear as a count | `state_api` | Pending |
| AC-5 | Delta | With `--previous`, Fail → Pass lands in `fixed` and Pass → Fail in `newlyFailing`; without it, the section names the missing baseline | `state_api` | Pending |
| AC-6 | Gaps | Never-walked is grouped by priority; stale reuses `findStaleCases` with the window end as `now` | `state_api` | Pending |
| AC-7 | CLI | Missing `qa-state.json` names `qa:pull`; `report.md` is written; `--public` adds `report.public.md`; bad flags are rejected before any write | `state_api` | Pending |
| AC-8 | Wiring | Routine, skills, template, and contract reference `qa:report`; guardrail and guidance-link checks green | `qa_pass_1` | Pending |
| AC-9 | First real report | The 2026-09-02 call's Linear parent results block equals the generated block | `qa_pass_2` | Pending |

## Test Strategy

- Unit: model, render, delta, gaps, and CLI parsing in `scripts/agents/qa-report.test.ts`,
  using the `makeCase` / `shard` fixture pattern from `qa-status.test.ts`.
- Integration: `bun run test:review-guardrails` for the prompt and skill edits; docs build for the page edit.
- E2E / Playwright: not applicable; no product UI changes.
- Manual checks: one dry run on a real pulled session.
- TDD proof: RED (Step 2) and GREEN (Step 3) commands and evidence recorded in the `state_api`
  handoff and summarized in `status.json` via `record-tdd`.

## QA Sequence

### Claude QA Pass 1

- Focus on privacy leaks in the private/public split, reconciliation edge cases (noted-only
  entries, `n/a`), and the wiring text matching the CLI's real flags.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Re-run the targeted suite, review the real 2026-09-02 report against the Linear parent, and
  close the loop on remaining defects.
