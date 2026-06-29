# Commitment Pooling Planning Index

Last updated: 2026-06-29

This folder is a reference export for the commitment-pooling research and planning surface. It is
not an implementation plan hub yet.

## Source of Truth

- Linear is the current research/product source of truth.
- `.plans/commitment-pooling` is the local traceability index and reference packet.
- Do not create `status.json`, `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, or `handoffs/`
  until the pool identity/control-plane and first capability are explicitly promoted from planning
  to implementation.
- When implementation starts, create a canonical plan hub and use `.plans` as execution truth.

## Linear Issues

- RESR-57: Commitment pooling - goal, pool model & key decisions
  - https://linear.app/greenpill-dev-guild/issue/RESR-57/commitment-pooling-goal-pool-model-and-key-decisions
- RESR-58: Commitment pooling - use cases & per-domain user scenarios
  - https://linear.app/greenpill-dev-guild/issue/RESR-58/commitment-pooling-use-cases-and-per-domain-user-scenarios
- PRD-649: Commitment pooling - pool identity + capability architecture
  - https://linear.app/greenpill-dev-guild/issue/PRD-649/commitment-pooling-pool-identity-capability-architecture
- PRD-650: Commitment pooling - proof capability on shared pool identity
  - https://linear.app/greenpill-dev-guild/issue/PRD-650/commitment-pooling-proof-capability-on-shared-pool-identity
  - No implementation child issues are active yet. Premature draft children PRD-652 through PRD-658
    were canceled and detached pending deeper implementation scoping.
- PRD-651: Commitment pooling - settlement capability on shared pool identity
  - https://linear.app/greenpill-dev-guild/issue/PRD-651/commitment-pooling-settlement-capability-on-shared-pool-identity
- PRD-473: Future G$ commitment-pool denomination strategy
  - https://linear.app/greenpill-dev-guild/issue/PRD-473/future-dollarg-as-commitment-pool-denomination-deferred-strategy
- PRD-475: First G$ garden allocation model
  - https://linear.app/greenpill-dev-guild/issue/PRD-475/define-first-gdollar-garden-allocation-model
- PRD-459: GoodDollar onboarding sync
  - https://linear.app/greenpill-dev-guild/issue/PRD-459/onboarding-sync-with-sam-mccarthy-gooddollar-partnership-kickoff

## Linear Documents

- Research Memo - Commitment Pooling for Green Goods
  - https://linear.app/greenpill-dev-guild/document/research-memo-commitment-pooling-for-green-goods-3864d8e05c4c
- Commitment Pooling - Use Cases & Domain Scenarios
  - https://linear.app/greenpill-dev-guild/document/commitment-pooling-use-cases-and-domain-scenarios-88ff9704a3bb
- Commitment Pooling - Pool Identity + Capability Architecture
  - https://linear.app/greenpill-dev-guild/document/commitment-pooling-pool-identity-capability-architecture-d6b7e5c22324
- Proof Capability - Attestations On Shared Pool Identity
  - https://linear.app/greenpill-dev-guild/document/proof-capability-attestations-on-shared-pool-identity-81cd1a8c93ff
- Settlement Capability - Vouchers On Shared Pool Identity
  - https://linear.app/greenpill-dev-guild/document/settlement-capability-vouchers-on-shared-pool-identity-a2b501afbb2c
- Commitment Pooling UX Brief - Cross-Surface Flows (discussion artifact, not scope lock)
  - https://linear.app/greenpill-dev-guild/document/commitment-pooling-ux-brief-cross-surface-flows-2a3072ce4d75
- Lifecycle And Aggregator Semantics
  - https://linear.app/greenpill-dev-guild/document/commitment-pooling-lifecycle-and-aggregator-semantics-bfdd633951d6
  - Local planning brief: `lifecycle-and-aggregator-semantics.md`

## Locked Decisions

- Green Goods should have one durable Garden Commitment Pool identity/control plane.
- V1 should use a `CommitmentPoolingModule` with a pool registry/control plane.
- The module owns default pool identity, cycle lifecycle, capability flags, and aggregate
  event/state semantics.
- A separately deployed aggregator is not required for V1; it remains an implementation detail only
  if later review proves it necessary without changing `poolId` or the UX.
- Proof and settlement are capabilities attached to the same `poolId`, not separate pool
  constructs.
- Do not build a disposable Model A pool that must be replaced later.
- The first proof capability uses the shared pool control plane for garden and pool stats.
- Resolvers validate attestations; the control-plane/aggregator emits indexable pool stats for
  Envio.
- Operators and owners have the highest permissions for pool operations.
- Existing gardens get pools through HoA/readiness/backfill; future gardens auto-provision once the
  module is live.
- Seasons/campaigns are cycles inside the default pool by default, with composting at cycle close.
- Commitments should support a one-to-many relationship with work submissions.
- Members can create offers/requests; operators/owners can seed campaign commitments and capture
  analog commitments.
- Commitments use per-commitment units.
- `ReadyForConfirmation` is requirements-based: approved work must satisfy required count/quantity;
  rejected work can be replaced or operator/owner-waived with reason.
- Fulfillment is counterparty-first, with operator/owner fallback and no self-confirmation.
- Public/editorial surfaces show aggregate stats and stories; detailed commitments, disputes, and
  participant-level data stay member/admin scoped.
- First HoA distribution includes commitment-pool readiness for every selected garden, but does not
  block on the commitment-pooling software being live.
- G$ on Arbitrum is partner-confirmed, but token address, custody, and transfer path are required
  before funds move.
- If G$ is not available on Arbitrum, readiness proceeds while the Green Goods pool/proof path
  remains Arbitrum-native and denomination-agnostic using DAI and attestations.
- Future operator-created pools are designed now and built later.
- Additional pools represent seasons or campaigns, not arbitrary domain fragmentation.
- Operators steward and configure pools; owners retain emergency, disable, and final policy control.
- Future voucher/redeem/exchange behavior is a settlement adapter/capability on the same pool UX.
- Future PWA writes must use queued jobs for commitment creation and fulfillment confirmation.
- UX uses mutual-aid language: offers, requests, promises kept, seasons. Avoid debt, owed, and
  leaderboard framing.

## Local Reference Files

- `research-memo.md` - earlier long-form research packet and architecture memo. It has a local
  errata header; Linear docs are current if details differ.
- `model-a-spec.md` - earlier proof-capability spec export. It has a local errata header; Linear
  docs now lock the shared pool identity/control-plane and aggregator direction if details differ.
- `linear-issues-staged.md` - historical staging notes from the initial Linear creation pass.
- `lifecycle-and-aggregator-semantics.md` - current local planning brief for state machines,
  commitment-to-work relationships, season/campaign composting, and aggregate stats.
