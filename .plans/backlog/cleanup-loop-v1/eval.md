# Cleanup Loop V1 Evaluation Plan

## Release Gates

1. Correctness: the new backlog hub validates on the current `plan-hub` schema and the new Claude
   prompt matches the current branch + lane contract
2. Usability: a human can hand the prompt to Claude later without Claude inventing missing queue,
   scope, or validation rules
3. Loop safety: the hub and the prompt encode the same keep / revert / bail / blocked contract and
   clearly exclude the shared tests + Storybook stream

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | `.plans/backlog/cleanup-loop-v1/` contains real brief/spec/plan/eval/status/metrics content plus lane handoffs | `state_api` | hub files |
| AC-2 | `status.json` keeps `ui` and `contracts` as `n/a`, `state_api` as implementation owner, and both QA lanes blocked in sequence | `state_api` | `status.json` |
| AC-3 | the hub defines one loop family only: `cleanup` | `state_api` | `metrics.md`, `spec.md` |
| AC-4 | the hub explicitly blocks route files, admin views, shared hooks/providers, Storybook/test-flow work, and `agent/contracts/indexer` surfaces | `state_api` | `brief.md`, `spec.md` |
| AC-5 | the hub includes a current first-run cleanup candidate ladder with a default order and no stale already-deleted surfaces | `state_api` | `spec.md` |
| AC-6 | `.plans/_automation/claude-loop-orchestrator.prompt.md` refuses to start when the hub is still backlog or the shared tests + Storybook stream is still the blocker | `state_api` | prompt file |
| AC-7 | the prompt delegates implementation to Codex on `codex/state-api/cleanup-loop-v1` and does not invent new scheduler or lane semantics | `state_api` | prompt file |
| AC-8 | the prompt requires one JSONL run record via `scripts/log-automation-run.mjs` and only allows Claude QA after Codex passes | `qa_pass_1` | prompt file |
| AC-9 | the keep / revert / bail / blocked rules are identical across the hub and the prompt | `qa_pass_2` | prompt + hub review |

## Test Strategy

- Unit: n/a
- Integration:
  - `node scripts/plan-hub.mjs validate`
- Manual:
  - dry-read the new prompt against the hub and confirm it can be followed without inventing
    missing decisions
  - verify the candidate ladder still names live surfaces on the current branch tip

## Dry-Run Walkthrough

1. Confirm the hub exists only under `.plans/backlog/cleanup-loop-v1/`
2. Read the Claude prompt and verify that it blocks immediately until the hub is promoted to
   `.plans/active/cleanup-loop-v1/`
3. Confirm the prompt also blocks if the shared tests + Storybook stream is still the active
   blocker
4. Confirm the prompt selects one cleanup surface only, delegates implementation to Codex on
   `codex/state-api/cleanup-loop-v1`, then hands QA back to Claude only after Codex passes
5. Confirm the prompt leaves `qa_pass_2` for later rather than auto-running the whole ladder

## QA Sequence

### Claude QA Pass 1

- Focus on scope integrity, run-log presence, and agreement between the prompt and hub contracts
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed
- Confirm the trigger branch exists: `claude/qa-pass-1/cleanup-loop-v1`
- Re-run the minimum regression checks:
  - `node scripts/ci-local.js --quick`
  - `node scripts/plan-hub.mjs validate`
- Confirm the run log exists for the cleanup metric and that the final state matches the declared
  outcome
