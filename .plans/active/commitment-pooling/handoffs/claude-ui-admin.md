# Commitment Pooling - Claude Admin UI Handoff

## Status

- Execution sub-lane: ui_admin
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui-admin/commitment-pooling
- Current state: two-phase — core admin waits for core state_api; settlement controls wait for settlement selectors
- Linear context: PRD-650/PRD-682 context under parent_only mode

## Inputs

- GREEN shared hooks/selectors and indexer query contract
- Corrected admin contract: CanvasLayout, /hub reference, and /community route
- uiux-spec.md, admin frames, settlement batch/oracle state contract
- acceptance-matrix.md for exact role/permission, copy/state, payout, and final-proof contracts
- Existing Admin wrappers, Storybook-backed shared primitives, and authenticated Brave access

## Outputs

- Garden pool console with one-open-Season plus concurrent-Campaign management, scoped seeding/aggregates, analog capture, gated claims, confirmations, disputes, assessment v3, allocation, and settlement controls.
- Cross-garden Pools mode inside admin /community; no new top-level Pools route.
- Immutable 1-24 member batch view, per-member retry/cancel, reported/checking/oracle result states, Safe setup/status, and disabled-member-delivery disclosure.
- Operator-visible reasons, blast-radius confirmation, accessible dialogs, and en/es/pt copy.
- Core seeding emits the full creation payload, enforces cycle/pool and DomainImpact shape, shows readiness charter/baseline/exposure-cap blockers, supports evidence/Work/Assessment v3 attachment, and exposes explicit Ready submission/authorized override.
- Hypercert allocation consumes the shared metadata composer and indexer `bundleKind`/`commitmentIds`/ascending-unique-`needUIDs` outputs.

## Acceptance

- All writes use shared mutation hooks; no view calls contracts directly.
- /community follows CanvasRouteFrame/CanvasRouteHeader and restrained command-surface grammar.
- Request rows expose indexed canonical claimant, authenticated `requestedBy`, `claimType`, `gardenContext`, requestedAt/state/reason/resolution fields and the accepted result exposes derived `providerGarden`. Decline changes only that row; acceptance consumes the matching contract-stored terms and supersedes every other pending indexed row; claimant re-request and direction-aware confirmation are visible.
- Pool pause requires a reason and disables only new commitments, claims, Ready submissions, and confirmations; evidence/linkage and safe recovery remain available. Register exposure caps are steward-gated and class quotas are not editable.
- Opening a second Season is blocked with the existing Season identified; multiple Campaigns remain independently operable and every aggregate/report names its cycle scope.
- A rejected batch cannot be edited or requeued wholesale; only failed members can be requeued/canceled.
- Reporting never marks settlement Verified. Oracle request, checking, infrastructure retry, invalid receipt, and stale-result behavior are legible.
- Safe view shows 2-of-3 recovery and separates owners from scoped executors.
- Loading, empty, offline, waiting, declined, failed, retry, reported, checking, and Verified states have accessible recovery.
- Authenticated Brave verifies operator-critical desktop and mobile composition.

## RED / GREEN

- RED: route, workspace-model, component, and mutation tests fail for /community placement, full seeding payload/cycle checks, readiness/cap/pause behavior, assessment/Ready/override flow, canonical request identity, Hypercert allocation, Season uniqueness plus concurrent Campaigns, batch bounds/recovery, oracle states, and Safe role separation.
- GREEN: the same tests pass; admin build passes; authenticated Brave proves the live operator flow.

## Exact Bun commands

The three named admin test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/admin test -- src/__tests__/views/CommunityPools.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/routing/community-pools-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/settlement-oracle-flow.test.tsx
- bun run --filter @green-goods/admin build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- A top-level Pools route, legacy DashboardLayout/Sidebar/Header, direct contract/RPC writes, in-app arbitrary Safe execution, manual receipt verification, garden-held member claims, rankings, credit, or client hero moments.

## Unblock evidence

- Core admin dispatch requires core state_api GREEN. Settlement batching/oracle/Safe controls remain blocked until settlement selectors are GREEN; core GREEN is not full settlement GREEN.
- /community placement and corrected admin wireframes are recorded.
- RED proof precedes implementation.
- GREEN includes targeted tests, build, and authenticated Brave proof for seeding, claims, dispute recovery, batching, reporting, oracle checking/result, failure, and retry.
