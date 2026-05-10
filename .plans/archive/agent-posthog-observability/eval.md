# Agent PostHog Observability Evaluation

| Acceptance Check | Lane | Evidence |
|---|---|---|
| Bug-intake guidance uses Claude Code PostHog + Linear connectors as the primary path | `state_api` | Routine diff |
| Bug-intake can include safe PostHog summaries in Linear bodies without replay links or identifiers | `state_api` | Routine diff and privacy grep |
| Recurring PostHog patterns over 50 sessions roll up into one Linear Issue | `state_api` | Routine diff |
| `/debug` can pull matching telemetry into private Claude Code context | `state_api` | Skill diff |
| Fallback script remains available for non-connector contexts | `state_api` | Existing script tests / dry-run evidence |

Validation: routine/skill privacy grep, connector dry-run or documented connector proof, targeted script tests if fallback script changes, `node scripts/harness/plan-hub.mjs validate`.
