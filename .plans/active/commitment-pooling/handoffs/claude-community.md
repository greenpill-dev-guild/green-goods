# Commitment Pooling - Claude Community Handoff

## Status

- Execution sub-lane: community
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/community/commitment-pooling
- Current state: September follow-up; blocked on August substrate and the Community hub gates
- Linear context: PRD-682; no child creation under parent_only mode

## Inputs

- Canonical .plans/active/community-interface hub
- GREEN Commitment Pooling contract/indexer/shared substrate
- GREEN shared-foundation extraction for generic runtime, auth/passkey, offline status, install/update, error, and shell primitives
- For the optional membership-queue slice only: a locked RESR-64 join-request persistence decision. The non-membership Community core does not wait for it.

## Outputs

- Independent packages/community PWA at community.greengoods.app, local port 3010.
- Needs/Create/Profile shell with its own routes, navigation, manifest, service-worker scope, telemetry identity, and application copy.
- View, signal, testimony, and confirm-when-named integration with Commitment Pooling.
- Complete offline/waiting/recovery states and en/es/pt copy.

## Acceptance

- Community consumes shared generic primitives without importing client routes, manifest, service worker, telemetry identity, or app copy.
- Need, NeedSignal, and Testimony jobs are offline-safe; waiting_for_hat consumes no retries.
- The v1 surface has no direct commitment claim flow.
- Confirmation follows the same direction-aware/provider-exclusion contract as client.
- Membership queue behavior does not ship until RESR-64 records controller, auth, retention/deletion, offline/recovery, abuse, cost, and operator handoff. View, signal, testimony, and named confirmation core remains independently dispatchable after its August substrate gates.
- Browser, installed-PWA, accessibility, and real-device behavior meet the Community hub acceptance.

## RED / GREEN

- RED: package shell, route, offline job, waiting-for-membership, confirmation, and recovery tests fail before implementation.
- GREEN: the same tests pass; package build passes; authenticated Brave and real-device PWA proof pass.

## Exact Bun commands

These targets become runnable only after the package is explicitly scaffolded by its own lane:

- bun run --filter @green-goods/community test
- bun run --filter @green-goods/community build
- bun run lint:vocab
- bun run agentic:check

## Out of scope

- Scaffolding before explicit dispatch, folding Community into packages/client, copying client-private shell code, public on-chain join requests, Linear-as-queue, implicit localStorage, direct commitment claims, rankings, escrow, or contract changes.

## Unblock evidence

- August contracts/indexer/shared substrate is GREEN.
- Shared-foundation handoff is GREEN.
- Community status.json marks the PWA lane ready.
- RESR-64 decision is recorded for any membership-queue slice.
- RED proof precedes implementation; GREEN includes package tests/build plus authenticated Brave and real-device evidence.
