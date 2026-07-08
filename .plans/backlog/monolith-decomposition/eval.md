# Monolith Decomposition Evaluation Plan

## Release Gates

1. Correctness: no exported API, route path, or facade wrapper changes.
2. Regression safety: agent build and agent tests pass for active slices.
3. Scope control: parked admin Cookie Jar work remains out of scope until unparked.
4. Evidence quality: each activated slice records validation in the hub before closeout.
5. Human judgment: activation order is confirmed before implementation starts.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Agent DB facades | Existing callers keep the same imports and wrapper names | `state_api` | Future slice evidence |
| AC-2 | Agent API server | Route paths, middleware order, and funding validation stay stable | `state_api` | Future slice evidence |
| AC-3 | Admin Cookie Jar | Remains parked until the Seasons reframe is decided | `ui` | Backlog state |
| AC-4 | QA review | Diff is structure-only and easy to review | `qa_pass_1` | Future QA notes |
| AC-5 | Regression review | Package validation rerun after QA | `qa_pass_2` | Future QA notes |

## Test Strategy

- Unit: existing package tests for the touched slice.
- Integration: `bun run test:agent` for agent slices.
- E2E / Playwright: not required for structure-only agent slices unless behavior changes are discovered.
- Manual checks: self-review exported API and route path preservation.
- TDD proof: not required while this hub is backlog-only; required if an active slice changes behavior.

## QA Sequence

### Claude QA Pass 1

- Review decomposition boundaries and look for behavior drift.
- Confirm no parked/admin work was mixed into an agent slice.

### Codex QA Pass 2

- Re-run targeted validation and inspect the final diff before PR handoff.
