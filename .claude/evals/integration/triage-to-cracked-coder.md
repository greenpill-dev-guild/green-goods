# Integration Eval: Triage → Cracked-Coder Chain

## Purpose

Verify that triage output for a P3 implementation task produces a handoff brief that the cracked-coder agent can consume to begin a successful TDD implementation cycle.

## Setup

1. Spawn `triage` agent with the issue below
2. Capture triage output
3. Validate triage output against handoff format (see expected.json)
4. Feed triage output as context to `cracked-coder` agent
5. Validate cracked-coder creates the hook with tests passing

## Issue Input

```
Title: Add useGardenOperators hook to shared package

Description: We need a hook that returns the list of operators for a given garden.
The data is available from the indexer's Garden entity (operators field). The hook
should use queryKeys factory, support cancellation, and handle the case where the
garden doesn't exist yet (return empty array). This will be consumed by the admin
dashboard's garden detail view.
```

## Expected Chain Behavior

1. **Triage** should classify as P3/feature, identify `shared` package, and route to cracked-coder with the `add-shared-hook` spec
2. **Triage handoff** should be ≤5 lines with severity, type, packages, and context
3. **Cracked-coder** should follow TDD: write failing test first, then implement
4. **Cracked-coder** should create hook in `packages/shared/src/hooks/garden/`, use `queryKeys.garden.*`, export from barrel
5. **Cracked-coder output** should include test results and build verification
