# Design System Alignment Review Evaluation

## Acceptance Criteria

| ID | Criterion | Lane | Evidence |
|---|---|---|---|
| AC-1 | Review follows `.claude/skills/design/system-alignment-review.md` | `ui` | Handoff names the protocol and uses its section structure |
| AC-2 | Validators are run or explicitly blocked | `ui` | Command output snippets for all five validators |
| AC-3 | Confirmed drift has file:line evidence on both sides of the contradiction | `ui` | Findings include authoritative source and drifting source |
| AC-4 | Inferred risks and missing proof are not presented as bugs | `ui` | Separate sections in review output |
| AC-5 | No implementation edits happen during the review | `qa_pass_1` | Git diff limited to plan/handoff artifacts |

## Regression Checks

- `node scripts/plan-hub.mjs validate`
- The validator set listed in `spec.md`, if the review lane reaches implementation.

## Exit Rule

This hub can close after the review is delivered and any follow-up fix work is either explicitly rejected or split into a new implementation hub.
