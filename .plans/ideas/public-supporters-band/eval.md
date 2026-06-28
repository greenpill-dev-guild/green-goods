# Public Supporters / Partnerships Section Evaluation Plan

## Release Gates

1. Correctness:
2. Usability:
3. Regression safety:
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

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
- Confirm the trigger branch exists: `claude/qa-pass-1/public-supporters-band`
- Re-run targeted validation and close the loop on remaining defects
