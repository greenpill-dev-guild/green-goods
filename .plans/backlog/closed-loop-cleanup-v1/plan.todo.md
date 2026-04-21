# Closed Loop Cleanup V1 Plan

**Feature Slug**: `closed-loop-cleanup-v1`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-20`
**Last Updated**: `2026-04-20`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Keep the hub in `.plans/backlog/` until the shared tests + Storybook stream is done | Prevents two agents from colliding on the same validation surface |
| 2 | Cleanup is the only loop family in v1 | It is the lowest-ambiguity autonomy win already grounded in `.plans/clean/` |
| 3 | Reuse the existing five plan-hub lanes | Avoids schema churn while proving the loop contract |
| 4 | Claude orchestrates and QA-checks; Codex implements `state_api` | Matches the current repo split and keeps implementation ownership clear |
| 5 | One cleanup surface per run, or bail | Prevents scope creep and preserves honest keep / revert outcomes |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Create a backlog hub with real brief/spec/plan/eval/status/metrics content | `state_api` | Step 1 | ✅ |
| Encode one cleanup loop with explicit metric, time budget, and outcomes | `state_api` | Step 2 | ✅ |
| Keep the shared tests / Storybook stream out of scope | `state_api` | Step 3 | ✅ |
| Add a one-shot Claude orchestration prompt for later human use | `state_api` | Step 4 | ✅ |
| Preserve the existing lane and run-log contract | `state_api` | Step 5 | ✅ |
| Require Claude QA only after Codex passes | `qa_pass_1` | Step 6 | ⏳ |
| Keep Codex `qa_pass_2` as a later follow-on verification lane | `qa_pass_2` | Step 7 | ⏳ |

## Implementation Steps

### Step 1: Create the backlog hub

- [x] Add `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and `metrics.md`
- [x] Add lane handoff files for the existing plan-hub schema

### Step 2: Lock the cleanup loop contract

- [x] Define the single `cleanup` loop family
- [x] Define `keep`, `revert`, `bail`, and `blocked`
- [x] Reuse `scripts/log-automation-run.mjs`

### Step 3: Freeze the scope

- [x] Declare the allowed cleanup surface classes
- [x] Declare the out-of-scope surfaces
- [x] Add a current candidate ladder grounded in the branch tip

### Step 4: Add the Claude orchestration prompt

- [x] Write a human-triggered prompt under `.plans/_automation/`
- [x] Require active-hub promotion before any implementation work starts
- [x] Require Codex CLI to own the `state_api` lane

### Step 5: Preserve existing contracts

- [x] Keep the five canonical lanes
- [x] Keep the current branch naming
- [x] Keep the current JSONL run-log schema
- [x] Do not add a scheduler in v1

### Step 6: Claude QA pass 1 (future)

- [ ] Verify the declared cleanup surface stayed in bounds
- [ ] Verify the run log exists and uses the cleanup metric
- [ ] Verify the shared tests / Storybook stream was not absorbed into the run

### Step 7: Codex QA pass 2 (future)

- [ ] Confirm the Claude QA branch trigger exists
- [ ] Re-run the regression checks listed in `eval.md`
- [ ] Confirm the loop outcome and handoffs are consistent

## Lane Checklists

### UI (`claude/ui/closed-loop-cleanup-v1`)

- [x] Mark this lane `n/a`
- [ ] Re-open only if a later cleanup candidate unexpectedly requires UI-only verification

### State / API (`codex/state-api/closed-loop-cleanup-v1`)

- [ ] Promote the hub from backlog to active only after the external blocker is gone
- [ ] Declare exactly one cleanup candidate before editing
- [ ] Keep edits inside the declared surface only
- [ ] Run targeted package validation and `node scripts/ci-local.js --quick`
- [ ] Emit one run log
- [ ] Mark the lane `passed` or `blocked`

### Contracts (`codex/contracts/closed-loop-cleanup-v1`)

- [x] Mark this lane `n/a`
- [ ] Re-open only if the cleanup scope ever includes a contracts-adjacent shim, which v1 forbids

### QA Pass 1 (`claude/qa-pass-1/closed-loop-cleanup-v1`)

- [ ] Start only after `state_api` passes
- [ ] Verify declared scope vs changed files
- [ ] Verify keep / revert / bail behavior was followed exactly
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/closed-loop-cleanup-v1`)

- [ ] Start only after `qa_pass_1` passes
- [ ] Confirm the trigger branch exists: `claude/qa-pass-1/closed-loop-cleanup-v1`
- [ ] Re-run the regression checks from `eval.md`
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [x] `node scripts/plan-hub.mjs validate`
- [x] human dry-read of `.plans/_automation/claude-loop-orchestrator.prompt.md`
- [ ] future live run must also pass:
  - [ ] targeted package tests for the declared cleanup surface
  - [ ] `node scripts/ci-local.js --quick`
  - [ ] `node scripts/plan-hub.mjs validate` if plan files change during the run
