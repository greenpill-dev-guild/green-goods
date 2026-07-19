# TypeScript 7-only upgrade Evaluation Plan

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

## Release Gates

1. Correctness: all `tsc` invocations resolve 7.0.2 and accept migrated tsconfigs.
2. Usability: editor-facing docs typecheck and no TypeScript 6 package is installed.
3. Regression safety: static i18n message detection retains the existing test proof.
4. Regression safety: docs confidence-band labels retain their `Y1`, `Y2`, … display values.
5. Evidence quality: research evidence and open assumptions are recorded before implementation.
6. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Compiler version | package-local `tsc --version` reports 7.0.2 | `state_api` | command output |
| AC-2 | TS config compatibility | package typecheck/build commands pass | `state_api` | command output |
| AC-3 | Locale message extraction | focused locale coverage test passes | `state_api` | test output |
| AC-4 | Cross-package safety | repo quick gate passes | `qa_pass_2` | command output |
| AC-5 | Docs chart labels | confidence-band numeric years display as `Y1`, `Y2`, … | `state_api` | focused test output |

## Test Strategy

- Unit: focused shared locale coverage test and docs confidence-band label mapping test.
- Integration: package-local typecheck/builds and GraphQL type generation where configured.
- E2E / Playwright: the docs chart has no interaction flow; before PR publication, capture authenticated Brave rendered proof that the labels remain legible in the built docs route.
- Manual checks: confirm no resolved TypeScript 6 package in the lockfile.
- TDD proof: the confidence-band test failed with the historical object-spread order (numeric year overwrote the label), then passed after assigning the formatted year last.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/typescript-7-upgrade`
- Re-run targeted validation and close the loop on remaining defects
