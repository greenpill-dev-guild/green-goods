# Autonomy Harness Rollout Evaluation Plan

## Release Gates

1. Correctness: the active hub validates and reflects current repo truth
2. Usability: the next bounded loop is clear without rereading chat history
3. Regression safety: cleanup work only claims keep decisions when backed by honest validation
4. Control-surface fidelity: the hub, plan-hub docs, and memory guidance describe the same inner-loop
   and repo-truth rules

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Active hub exists with real `brief/spec/plan/eval/status/handoffs` content | `state_api` | `.plans/active/autonomy-harness-rollout/` |
| AC-2 | `status.json` matches current execution truth: `state_api` in progress, `contracts` n/a, QA blocked, UI intentionally blocked | `state_api` | `status.json` |
| AC-3 | The research map now points to the active hub instead of claiming the rollout is still only an idea | `state_api` | `.plans/ideas/autonomous-harness-map-2026-04-18.md` |
| AC-4 | Full-view deletions require parity review, not only route-unreachability | `qa_pass_1` | `plan.todo.md`, `spec.md` |
| AC-5 | The inner-loop policy is explicit: targeted `bun run test -- <file>` or `bun run test` are the fast iterative gates, and coverage remains scheduled or pre-merge evidence | `state_api` | `.plans/README.md`, `plan.todo.md` |
| AC-6 | The memory policy is explicit: `.plans/` is repo truth and any `.claude/agent-memory` pilot remains environment-local until freshness rules exist | `state_api` | `.plans/README.md`, `docs/docs/builders/agentic/context-engineering.mdx`, `plan.todo.md` |
| AC-7 | The next execution step is explicit after control-surface work completes | `qa_pass_2` | `plan.todo.md`, `handoffs/codex-state-api.md` |

## Test Strategy

- Unit: targeted `bun run test -- <file>` on touched shared / admin / client surfaces
- Integration: `node scripts/plan-hub.mjs validate`, `bash scripts/check-test-quality.sh`
- E2E / Playwright: not required for this plan move
- Manual checks:
  - confirm the active hub and `.plans/README.md` agree on validation posture and repo truth
  - confirm memory guidance does not elevate `.claude/agent-memory` above `.plans/`
  - compare unrouted legacy views against the live folded surface before deletion
  - if `packages/admin` build evidence is needed, explicitly unlock / authorize the local `varlock` / 1Password flow first

## QA Sequence

### Claude QA Pass 1

- Stay blocked until the state lane finishes the remaining Tier 0 partials
- Review dormant admin surfaces for parity before any future deletion
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/autonomy-harness-rollout`
- Re-run targeted validation and close the loop on remaining defects
- Treat env-gated builds and hanging tests as blockers to be recorded, not silently ignored
