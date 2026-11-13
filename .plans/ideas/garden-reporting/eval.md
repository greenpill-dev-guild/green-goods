# Garden Reporting in the Steward Cockpit Evaluation Plan

## Release Gates

1. Correctness: a month's days add up to exactly the works submitted that month, in the garden's
   own zone, and every report counts the same records.
2. Usability: a steward finds each answer in the tab they already use, and a day, week or band
   opens the records behind its number.
3. Regression safety: the Hub's review flow, the Garden Health card and the Activity Feed behave as
   they ship.
4. Evidence quality: research evidence and open assumptions are recorded before implementation.
5. Human judgment: protected surfaces and maintainer-call decisions are called out before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Month-range read | Returns the month's works and a total; a partial read says what it did not read | `state_api` | |
| AC-2 | Calendar | Day counts sum to the month; zero, before-records, not-loaded and future days differ; a day opens its records and focus returns to it | `ui` | |
| AC-3 | Review Health | Verdict matches `summarizeReviewQueue`; bands sum to the waiting count | `ui` | |
| AC-4 | QA review | The walkthrough's story holds against the shipped tabs | `qa_pass_1` | |
| AC-5 | Regression review | Hub review, Garden Health and the Activity Feed unchanged | `qa_pass_2` | |

## Test Strategy

- Unit: aggregation, date bucketing and review-health rules. The prototype's
  `aggregate.test.ts` covers them for sample data and moves with the slice.
- Integration: the month-range read against fixtures for a full and a partial read.
- E2E / Playwright: the day dialog and its focus return; band chips filter the queue.
- Manual checks: rendered proof at 390, 768 and 1280 in light and dark, labeled per AGENTS.md.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in `status.json`.

## QA Sequence

### Claude QA Pass 1

- Focus on UX issues, missing requirements, and test gaps
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Re-run targeted validation and close the loop on remaining defects
