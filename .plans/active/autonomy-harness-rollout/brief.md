# Autonomy Harness Rollout

**Slug**: `autonomy-harness-rollout`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-04-18`
**Research Map**: `.plans/ideas/autonomous-harness-map-2026-04-18.md`

## Problem

Green Goods already has the substrate for agentic work, but the execution loop was not yet trustworthy.
The repo had a broken `plan-hub` validator, stale agent/eval docs, ungoverned skipped tests, brittle
baseline failures, and cleanup findings without a safe rule for distinguishing dead infrastructure
from unmigrated legacy UI. That made the autonomy rollout hard to resume and easy to drift.

## Desired Outcome

- The autonomy rollout lives in an active feature hub that agents and humans can resume without
  reconstructing context from chat history.
- Tier 0 unblockers are tracked as complete, partial, or blocked with explicit evidence.
- Loop A cleanup can continue on bounded surfaces without deleting legacy views that still contain
  behavior not present in the folded admin UI.
- Existing plan-hub lanes remain authoritative; this rollout does not invent a parallel schema.

## Scope Notes

- In scope:
  - Promote the autonomy research map into a live `.plans/active/` hub
  - Record Tier 0 minimum unblockers and current cleanup-loop status honestly
  - Keep `.plans/` and `status.json` aligned with the real harness and current blockers
  - Continue bounded cleanup only where the surface is verified as dead infrastructure
- Out of scope:
  - Design specialist rollout
  - Chromatic wiring
  - Telegram trace capture
  - Repo-wide cleanup sweep
  - New top-level plan-hub lanes

## Success Signal

The autonomy rollout can be resumed from the repo alone: the active hub validates, the next bounded
loop is obvious, and remaining blockers are explicit rather than hidden in chat context.
