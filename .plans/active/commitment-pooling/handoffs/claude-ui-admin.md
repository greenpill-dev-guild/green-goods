# Commitment Pooling - Claude Admin UI Handoff

## Status

- Execution sub-lane: ui_admin
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui-admin/commitment-pooling
- Current state: prototype/journey review may continue; feature implementation waits for core
  state_api, verified non-value deployment/indexer output, and completion of the scoped existing
  admin-console fixes and polish led by PRD-737; settlement controls wait for settlement selectors
- Linear context: PRD-725 (admin UI lane) under parent PRD-650; PRD-682 is Community context

## Inputs

- GREEN shared hooks/selectors and indexer query contract
- Corrected admin contract: CanvasLayout, /hub reference, and /community route
- uiux-spec.md, admin frames, settlement batch/CCIP command-ack state contract
- acceptance-matrix.md for exact role/permission, copy/state, payout, and final-proof contracts
- Existing Admin wrappers, Storybook-backed shared primitives, and authenticated Brave access

## Outputs

- Garden pool console with one-open-Season plus concurrent-Campaign management, scoped seeding/state counts/exact-label summaries, analog capture, gated claims, confirmations, disputes, assessment v3, allocation, and settlement controls.
- Protocol-pool plus current-garden Pools mode inside admin `/community`; no new top-level Pools
  route. Alphabetical all-garden oversight and batch/CCIP operations live only in the
  capability-gated Operations workspace, whose nav and route use
  `showOperations = isDeployer || canQueueFunding || canOperateSettlement` from shared selectors.
  Route visibility confers no write authority: the seed/top-up form requires `canQueueFunding`
  (protocol steward or `SettlementModule` owner), deployer alone cannot submit it, and an
  unauthorized viewer sees the funding-unavailable state rather than a reverting control.
- Immutable batch-membership view with the measured configured 0–24 limit and hard ceiling of 24, whole-batch cancellation while Queued, per-member retry/cancel only after authenticated failure, command/execution/acknowledgment states, native ETH/CELO fee floors and low-balance state, active/previous peer expiry, Safe/Roles/cap health, and disabled-member-delivery disclosure.
- Operator-visible reasons, blast-radius confirmation, accessible dialogs, and en/es/pt copy.
- Core seeding emits the full creation payload, including the explicit reward rail. `None` clears
  reward fields, `ArbitrumExternal` explains the later record-only payout action, and
  `CeloSettlement` requires provider-garden Safe/canonical-G$ readiness without exposing
  `recordRewardPaid`. It also enforces cycle/pool and repeatable DomainImpact requirements, shows
  the app-preflight Baseline alongside the onchain charter/provider-open-commitment-cap blockers,
  supports evidence/Work/Assessment v3 attachment, and exposes explicit Ready
  submission/authorized override.
- DomainImpact creation uses 1–`MAX_REQUIREMENTS` ordered `{ actionUID, requiredCount }` rows,
  derives domain tags through ActionRegistry, permits actions in the same domain, and renders
  `approvedCount / requiredCount` plus canonical per-commitment `approvedUnits`. The UI starts
  with four rows and adds more; it never presents four as the product maximum.
- Pool/cycle overview rows use state counts and `openCommitmentCount`; exact-label unit groups remain separate and case-sensitive, and `promiseKeptRate` is the only cross-commitment percentage.
- Cycle seeding carries no allocation or recognition policy. The open-cycle step accepts the six
  allocation percentages plus equal/verified recognition percentages, converts both groups to
  basis points, requires each group to total exactly 10,000, and submits both snapshots atomically
  through `openCycle(cycleId, allocation, recognitionPolicy)`.
- Hypercert allocation consumes the shared metadata composer and indexer `bundleKind`/`commitmentIds`/ascending-unique-`needUIDs` outputs.
- `W10@accepted` uses one locked action row: “Send for confirmation” is available only when required evidence is complete; “Cancel promise” opens the reason-required `W10@cancel` steward dialog; “Mark ready” opens the authorized reason-required `W10@mark-ready-override` flow and is visually distinct from ordinary evidence completion. The row never implies that acceptance alone made the commitment Ready.
- `W10@attach-assessment` is the only assessment-attachment placement. It filters to eligible Assessment v3 records for the commitment’s accepted `providerGarden`, records the selected assessment before Ready submission, and exposes an empty/ineligible state instead of attaching an unrelated garden’s assessment.

## Acceptance

- All writes use shared mutation hooks; no view calls contracts directly.
- `/community/pools` follows CanvasRouteFrame/CanvasRouteHeader and restrained command-surface grammar, and never exposes another garden's pool.
- Request rows expose indexed canonical claimant, authenticated `requestedBy`, `claimType`, `gardenContext`, requestedAt/state/reason/resolution fields and the accepted result exposes derived `providerGarden`. Decline changes only that row; acceptance consumes the matching contract-stored terms and supersedes every other pending indexed row; claimant re-request and direction-aware confirmation are visible.
- Pool pause requires a reason and disables only new commitments, claims, Ready submissions, and confirmations; evidence/linkage and safe recovery remain available. Provider open-commitment caps are steward-gated and class quotas are not editable.
- In `W10@accepted`, steward cancellation and the authorized Ready override both require a captured reason; confirmation remains unavailable until the normal evidence gate or the explicit override has produced Ready. The three actions retain separate permissions, labels, and audit outcomes.
- `W10@attach-assessment` accepts only the eligible Assessment v3 set scoped to the accepted `providerGarden`; no assessment from another provider or garden can be selected, and a required-but-empty set blocks normal Ready submission with a recovery explanation.
- Opening a second Season is blocked with the existing Season identified; multiple Campaigns remain independently operable and every count or exact-label summary names its cycle scope.
- A Queued batch exposes one blast-radius-confirmed whole-batch cancel action and never a per-member cancel. A rejected batch cannot be edited or requeued wholesale; only Failed members can be requeued or terminally cancelled. The UI preserves the failed attempt/failure code and distinguishes that closeout from an atomic Queued pre-send batch withdrawal or an unbatched Queued cancellation.
- Dispatch or Celo execution never marks settlement Confirmed. Same-key command retry, stored acknowledgment retry, authenticated failure/new-attempt, derived delivery delay, CCIP manual-execution guidance, command/destination/acknowledgment IDs with Explorer links, and ignored stale/duplicate acknowledgment behavior are legible.
- Safe view shows 2-of-3 recovery and separates owners from scoped executors.
- Account setup never claims to deploy a Safe: it explains the Release-gated Safe/Roles prerequisites and registers only an already-deployed, live-verified route.
- Loading, empty, offline, waiting, declined, failed, retry, queued, dispatched, executed/acknowledgment-pending, delayed, and Confirmed states have accessible recovery.
- Authenticated Brave verifies operator-critical desktop and mobile composition.

## RED / GREEN

- RED: route, workspace-model, component, and mutation tests fail for /community placement, full seeding payload/cycle checks, readiness/cap/pause behavior, assessment/Ready/override flow, canonical request identity, Hypercert allocation, Season uniqueness plus concurrent Campaigns, batch bounds/recovery, atomic Queued-batch cancellation with no partial-member control, CCIP command/ack states, fee health, and Safe role separation.
- GREEN: the same tests pass; admin build passes; authenticated Brave proves the live operator flow.

## Exact Bun commands

The three named admin test files do not exist yet; they are intentional to-be-created RED-first deliverables of this lane.

- bun run --filter @green-goods/admin test -- src/__tests__/views/CommunityPools.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/routing/community-pools-route.test.tsx
- bun run --filter @green-goods/admin test -- src/__tests__/settlement-ccip-flow.test.tsx
- bun run --filter @green-goods/admin build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- A top-level Pools route, legacy DashboardLayout/Sidebar/Header, direct contract/RPC writes, in-app arbitrary Safe execution, manual settlement confirmation, garden-held member claims, rankings, credit, or client hero moments.

## Unblock evidence

- Core admin dispatch requires core state_api GREEN, verified non-value deployment and live
  indexer read-back, and completion of the scoped existing-admin fixes/polish. Settlement
  batching/CCIP/Safe controls remain blocked until settlement selectors are GREEN; core GREEN is
  not full settlement GREEN.
- /community placement and corrected admin wireframes are recorded.
- RED proof precedes implementation.
- GREEN includes targeted tests, build, and authenticated Brave proof for seeding, claims, dispute recovery, batching, command dispatch, execution/acknowledgment status, failure, fee/delivery delay, and each distinct retry action.

## Binding architecture amendment — 2026-07-28

- Seeding and detail surfaces expose the accountable lead, contributor policy/roster, repeatable requirements, and roster freeze.
- Ready and direct dispute-fulfillment controls expose the non-zero verified-contributor gate and
  either the opened cycle policy or immutable cycle-less 20/80 default. A direct Fulfilled
  dispute result shows the roster as frozen before recognition or payment becomes available.
- Recognition review shows the canonical equal-commitment then policy-defined gardener formula.
  The payment editor starts from those weights, makes garden retention explicit, and requires a
  reason only when a steward changes the contributor weights.
- Hypercert commitment-bundle selection includes only fulfilled commitments from the selected
  non-zero cycle. Cycle-less rows remain visible for recognition/payment history but are disabled
  with “No cycle allocation · not certificate eligible”; they never reach allowlist or metadata
  construction.
- Settlement separates Save draft, Finalize payout plan, and per-contributor Prepare payout.
  Finalization creates no child; preparation is visibly idempotent and creates one Queued child
  from a frozen non-zero row. Any non-zero retained amount is a divergence and requires visible
  non-empty reason input even when contributor payment weights still mirror recognition. The
  surface shows recognition/payment hashes, amount-derived weights, reasoned divergence,
  all-retained zero-child completion, and Draft / Pending / Partial / Complete / Failed without
  rewriting fulfillment. Recovery acts on the failed child and never clears the stable parent
  pointer.
- Protocol Safe to garden Safe value appears only as Funding / ProtocolToGarden created through
  `queueFunding`; the admin queue never labels or routes it as a garden-beneficiary commitment
  reward.
- Payout-plan draft actions render only when the provider-garden settlement account is Active;
  external-record and Celo allocation actions remain mutually exclusive by reward rail.
- W10 filters dispute-resolution outcomes against the connected steward. When that steward is an
  active contributor, Fulfilled is hidden or disabled with a `SelfConfirmation` explanation; only
  an eligible non-contributor steward may submit the separately policy/credit-gated outcome.
- W26 requires every commitment terminal and `liveCommitmentCount == 0`, calls `closeCycle` first,
  and only then exposes share review and certificate minting from the locked Reconciled bundle.
  The count comes from `CommitmentCycle.liveCommitmentCount`, not accepted-only exposure.
  The shared composer independently requires exact on-chain Reconciled state for both W26 and
  `/hub/certify/create`; route entry cannot bypass close. `compostCycle` is the final post-mint
  action; mint-before-close is never offered.
- Use the W10/W11/W21/W22/W26 states and SB-33 in the hi-fi artifact as the accepted surface contract.
