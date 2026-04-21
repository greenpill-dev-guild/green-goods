# Closed Loop Cleanup V1

**Slug**: `closed-loop-cleanup-v1`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-20`
**Source Research**: `.plans/active/autonomy-harness-rollout/` + `.plans/clean/`
**Blocked By**: shared tests + Storybook hardening stream

## Problem

Green Goods now has the repo-truth pieces for autonomous improvement: a plan hub, lane contracts,
 a metric surface, and a JSONL automation run log helper. What it still does not have is a
 bounded, queueable feature hub for the first real keep/revert loop. The cleanup work is the best
 first candidate because the repo already has research-backed dead-surface findings, but that loop
 must stay separate from the shared tests and Storybook hardening stream that another agent is
 already handling.

## Desired Outcome

- A backlog hub exists for the first real repo-backed autonomy loop, scoped to cleanup-first only.
- The first live run is bounded to one safe cleanup surface per run and uses the existing
  `state_api` -> `qa_pass_1` -> `qa_pass_2` lane contract.
- Claude can orchestrate the run later with Codex CLI as the implementation worker and Claude as
  QA, without inventing queue rules or validation steps.
- The hub stays dormant until the shared tests / Storybook stream is out of the way.
- No product runtime, API, schema, or scheduler changes are required in v1.

## Scope Notes

- In scope:
  - a new backlog feature hub for `closed-loop-cleanup-v1`
  - one cleanup loop family with explicit keep / revert / bail / blocked outcomes
  - a current shortlist of safe cleanup candidates
  - a one-shot Claude orchestration prompt for later human-triggered use
- Out of scope:
  - shared test-flow or Storybook hardening
  - route files, admin views, and navigation structure
  - `packages/shared/src/hooks/**` and `packages/shared/src/providers/**`
  - `packages/agent`, `packages/contracts`, and `packages/indexer`
  - any new scheduler, queue schema, or plan-hub lane names

## Success Signal

Once promoted later, the hub can drive one cleanup run end to end with no scope ambiguity: one
declared surface, one Codex implementation pass, one JSONL run record, and one Claude QA pass
without absorbing the shared tests / Storybook workstream.
