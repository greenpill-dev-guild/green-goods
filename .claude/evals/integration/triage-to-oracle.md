# Integration Eval: Triage → Oracle Chain

## Purpose

Verify that triage output for a P2 investigation-required issue produces a handoff brief that the oracle agent can consume to begin a successful investigation.

## Setup

1. Spawn `triage` agent with the issue below
2. Capture triage output
3. Validate triage output against handoff format (see expected.json)
4. Feed triage output as context to `oracle` agent
5. Validate oracle produces findings relevant to the issue

## Issue Input

```
Title: Garden statistics show incorrect member count after operator removal

Description: When an operator is removed from a garden via the admin dashboard, the
garden statistics (member count, active operator count) still show the old values.
Refreshing the page doesn't fix it. The indexer shows the correct values in GraphQL
playground, but the frontend displays stale data.

Observed in: admin dashboard, garden detail view
Expected: Member count updates immediately after removal
Actual: Member count stays at pre-removal value until cache TTL expires (~60s)
```

## Expected Chain Behavior

1. **Triage** should classify as P2/bug, identify `shared` + `admin` packages, and route to oracle for root cause investigation
2. **Triage handoff** should be ≤5 lines with severity, type, packages, and context
3. **Oracle** should identify query cache invalidation as the root cause (missing `invalidateQueries` after mutation)
4. **Oracle** should reference `queryKeys` factory and event-driven invalidation pattern
