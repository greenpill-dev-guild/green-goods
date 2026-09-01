# CI-First Validation Balance Evaluation Plan

## Release Gates

1. Correctness: push plans select focused local evidence and stop honestly on missing focus or time.
2. Usability: plan output explains the deadline and the exact next action when focus is missing.
3. Regression safety: critical overrides and broad affected-package CI workflows remain mandatory.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Routine local push | Focused Shared utility plan is ready and at most 90 seconds | `state_api` | Covered by selector regression test |
| AC-2 | Missing focus | Over-budget routine source plan returns `needs-focus` and runs nothing | `state_api` | Covered by selector and runner regression tests |
| AC-3 | Deadline and receipts | Runtime expiry is nonzero and exact completed passes remain reusable | `state_api` | Covered by runner regression tests |
| AC-4 | CI path routing | Shared utility skips Design/Ontology; owning paths still trigger them | `qa_pass_1` | Covered by routing and ontology parity tests; final QA pending |
| AC-5 | Critical safety | Critical checks ignore budgets, filters, and receipt shortcuts | `qa_pass_2` | Covered by selector regression tests; final Ship Gate pending |
| AC-6 | Measured performance | Three warm routine push probes complete within 90 seconds | `qa_pass_2` | Pending |

## Test Strategy

- Unit: selector budgets/statuses, runner deadline/receipt behavior, compatibility and criticality.
- Integration: Husky delegates to push intent; workflow path classifiers match selector policy.
- E2E / Playwright: not applicable; no product UI changes.
- Manual checks: inspect rendered plans and three measured warm push runs.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-run targeted validation and close the loop on remaining defects
