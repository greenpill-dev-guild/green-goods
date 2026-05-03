# Agent PostHog Observability Evaluation

| Acceptance Check | Lane | Evidence |
|---|---|---|
| Curated PostHog query commands return JSON for recent errors, detail, user sessions, recurring patterns, and bug matching | `state_api` | Dry-run or mocked command output |
| Identical queries use a 5-minute local cache | `state_api` | Focused script test or dry-run evidence |
| Bug-intake can include counts in issue bodies without public replay links | `state_api` | Routine diff and privacy check |
| `/debug` can pull matching telemetry into private agent context | `state_api` | Skill/routine handoff proof |

Validation: targeted script tests, privacy grep for replay-link placement, `node scripts/harness/plan-hub.mjs validate`.
