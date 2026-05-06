# Agent Package Hardening Evaluation

| Acceptance Check | Lane | Evidence |
|---|---|---|
| Auth-implicating handlers have meaningful tests for approve, reject, submit, and join | `state_api` | Focused package tests and coverage summary |
| Submit/approve idempotency handles double delivery | `state_api` | RED/GREEN handler or service tests |
| User-facing errors stay generic while internal detail is logged structurally | `state_api` | Boundary tests |
| Public handler rate limits are inventoried and tier-aligned with `agent-messaging-channels` | `state_api` | Test matrix and handoff note |
| Crypto flow is documented without plaintext key leakage | `state_api` | Source review plus docs diff |

Validation: `cd packages/agent && bun run test && bun run typecheck && bun run lint`, then `node scripts/harness/plan-hub.mjs validate`.
