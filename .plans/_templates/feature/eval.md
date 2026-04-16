# {{FEATURE_TITLE}} Evaluation Plan

## Release Gates

1. Correctness:
2. Usability:
3. Regression safety:

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | | `ui` | |
| AC-2 | | `state_api` | |
| AC-3 | | `contracts` | |
| AC-4 | | `qa_pass_1` | |
| AC-5 | | `qa_pass_2` | |

## Test Strategy

- Unit:
- Integration:
- E2E / Playwright:
- Manual checks:

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/{{FEATURE_SLUG}}`
- Re-run targeted validation and close the loop on remaining defects
