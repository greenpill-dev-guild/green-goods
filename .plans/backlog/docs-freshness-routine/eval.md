# Docs Freshness Routine Evaluation

## Acceptance Criteria

| ID | Criterion | Lane | Evidence |
|---|---|---|---|
| AC-1 | Each run selects one docs freshness family | `state_api` | Handoff names selected family and changed files stay in scope |
| AC-2 | Generated screenshots/social cards come from real surfaces | `state_api` | Script log or capture command summary |
| AC-3 | Docs audit/build gate passes for touched surface | `state_api` | Command output summary |
| AC-4 | No docs navigation redesign or translation work is folded in | `qa_pass_1` | Diff review |
| AC-5 | Plan state remains valid | `qa_pass_2` | `node scripts/plan-hub.mjs validate` |

## Exit Rule

This hub can stay as a recurring backlog routine. Close it only if docs freshness gets its own scheduled automation or the work families are split into separate implementation hubs.
