# Commitment Pooling - Codex Contracts Handoff

## Status

- Machine lane: contracts
- Execution sub-lane: contracts
- Owner: Codex
- Branch signal: codex/contracts/commitment-pooling
- Current state: follow status.json; this handoff does not self-dispatch
- Linear context: PRD-650 parent-only mirror; PRD-671/672 are historical labels

## Inputs

- contract-spec.md, especially sections 5-8
- acceptance-matrix.md for canonical identity, permissions, payout, and final state proof
- packages/contracts/AGENTS.md and the approved append-only schema policy
- Existing ActionRegistry, GardenToken, WorkApprovalResolver, UUPS, deploy.ts, and storage-layout patterns
- Current deployment artifacts for Sepolia and Arbitrum

## Outputs

- Assessment v3 and Community Testimony resolvers plus approved standalone schema-registration targets.
- CommitmentPoolingModule and non-transferable CommitmentRegister with exact structs, enums, errors, events, indexes, storage gaps, pause rules, and bounded loops.
- GardenToken and WorkApprovalResolver wiring, isolated deploy targets, append-only artifact persistence, and post-deploy/indexer update hooks.
- Contract tests and deployment-script tests that become the frozen ABI/event source for indexer and shared lanes.

## Acceptance

- Empty confirmer rules resolve to Offer recipient or Request creator; the unit provider is excluded from ordinary, named-group, and fallback confirmation.
- Pending claims store canonical claimant, authenticated requestedBy, immutable claim type, provider garden context, requested time, and active state. Runtime kind must equal the creation-time claim type. Acceptance consumes the canonical claimant-keyed terms; decline clears only that request; terminal pre-acceptance cancel/expiry are emitted for deterministic indexed supersession.
- Disputes store pre-dispute state and RestorePrevious restores it. An expired commitment can never resolve Fulfilled.
- A pool permits one open Season and concurrent Campaigns through bounded O(1) checks.
- Creating a commitment with a cycle requires that cycle to belong to the same pool and still accept commitments. Cycle-less commitments remain explicit.
- DomainImpact requires 1-4 registered domain/action pairs, at least one non-zero approved Work unit, a provider/provider-garden-valid Work link, and any declared assessment before non-override Ready. Approval-first and assessment-first ordering both reach Ready because `attachAssessment` re-evaluates the completed Work threshold. SupportService and OperatorCaptured require evidence plus any declared assessment; every non-override Ready path has its assessment gate.
- A pool cannot become Ready until its charter, at least one qualifying baseline, and a non-zero register exposure cap are present. `pausePool` requires a reason CID and blocks only the operational mutations enumerated in contract-spec §6.1.
- Provider is stored once at acceptance (`Offer -> creator`, `Request -> counterparty`) and is the only unit account, exposure subject, reward recipient, and self-confirmation exclusion. Individual DomainImpact Work equals provider; Garden claims use a gardener/operator of providerGarden; UID 0 remains valid through the concrete ActionRegistry ABI.
- Pre-acceptance cancel/expiry never releases units; every accepted-state exit has exact release or fulfillment accounting.
- Pre-acceptance cancellation is available to the creator or steward; after acceptance only the steward may cancel. Work links are added by the accepted provider/counterparty or steward, never by an unrelated creator. Register class quota is immutable and exposure-cap changes go through the module's steward-gated forwarder.
- Existing schema definitions and artifact keys remain byte-identical; approved additions use unique keys and standalone registration.
- Exact creation/transition events support deterministic Envio handlers without RPC backfill.
- `recordRewardPaid(commitmentId, payoutRef)` derives and emits stored source/provider recipient/token/amount; callers cannot override earned-reward facts.
- AssessmentV3 and CommunityTestimony config ABIs, setters, events, errors, initializer/UUPS rules, and storage gaps match contract-spec §6.4.3 exactly.
- Generated layout proves CommitmentPoolingModule has 23 named slots plus a 27-slot gap (50 total); CommitmentRegister retains its separately specified 6+44 layout.

## RED / GREEN

- RED: add focused tests in test/unit/CommitmentPooling.t.sol and test/unit/CommitmentRegister.t.sol; run them before implementation and record the expected behavioral failures.
- GREEN: run the same files after the minimum implementation, then storage, script, and full contract checks.

## Exact Bun commands

`CommitmentPooling.t.sol`, `CommitmentRegister.t.sol`, `AssessmentV3Resolver.t.sol`, and `CommunityTestimonyResolver.t.sol` do not exist yet; each is an intentional to-be-created RED-first deliverable. `WorkApprovalResolver.t.sol` and `StorageLayout.t.sol` are existing regression surfaces.

- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentPooling.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/CommitmentRegister.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/AssessmentV3Resolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/CommunityTestimonyResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/unit/WorkApprovalResolver.t.sol
- bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol
- bun run --filter @green-goods/contracts test:script
- bun run --filter @green-goods/contracts build:full
- bun run --filter @green-goods/contracts lint:check
- bun run --filter @green-goods/contracts test

Run these deployment commands from packages/contracts; they remain dry-run only until separately authorized. The `commitment-schemas` / `commitment-pooling` deploy and upgrade targets and `backfill-pools.ts` do not exist yet — they are deliverables of this lane (contract-spec §6.4.4, §7); create them before running:

- bun script/deploy.ts commitment-schemas --network sepolia --dry-run --pure-simulation
- bun script/deploy.ts commitment-pooling --network sepolia --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network sepolia --dry-run --pure-simulation
- bun script/deploy.ts commitment-schemas --network arbitrum --dry-run --pure-simulation
- bun script/deploy.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
- bun script/upgrade.ts commitment-pooling --network arbitrum --dry-run --pure-simulation
- bun ../../.plans/active/commitment-pooling/backfill-pools.ts --network arbitrum --dry-run

## Out of scope

- SettlementModule implementation, Celo execution, bridged G$, transferable vouchers, CreditRegister, raw Celo indexing, Sarafu integration, UI, and any broadcast.
- Editing existing production schema definitions or using bulk --update-schemas.

## Unblock evidence

- status.json marks the contracts lane ready and the user dispatches it.
- Corrected handoff and exact contract interface/event tables are present.
- Standalone schema-registration and isolated deployment targets have dry-run acceptance defined.
- RED proof is recorded before implementation; GREEN cannot be claimed without the same test passing plus storage/deploy evidence.
