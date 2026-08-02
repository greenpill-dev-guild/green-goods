# Commitment Pooling ERD simplification proposals

**Date:** 2026-08-01  
**Status:** review proposal, with one pure-redundancy removal applied inline  
**Canonical schemas:** `../contract-spec.md` §8.2 and `../settlement-spec.md` §6

## Purpose and audit rules

This audit separates presentation simplification from schema simplification. D7, D7b, and the
claims/count/lineage ERD now show entity names, keys, discriminators, and relationships. The
GraphQL blocks remain the field-level source of truth.

The audit treats these constraints as load-bearing:

- handlers derive pooling state from module/registry events and settlement state from the named
  module/executor events only;
- indexer `getWhere` may return an empty result, so bounded lookup-companion entities and their ID
  arrays remain necessary;
- cross-commitment aggregation is count-safe, while unit totals stay grouped by exact UTF-8 label;
- `chainId-*` composite identities and explicit relationship IDs stay available without parsing;
- raw ID plus entity-ID pairs may look repetitive but can serve contract-facing lookup and GraphQL
  relation consumers separately.

## Proposal register

| ID | Proposal | Disposition now | Reason |
|---|---|---|---|
| P1 | Merge `openSeasonCycleId` + `openSeasonCycleEntityId` into one relation representation | Propose only | Confirm raw-ID consumers and generated relation behavior first |
| P2 | Merge `openCampaignIds` + `openCampaignEntityIds` | Propose only | Preserve bounded campaign lookup until shared queries prove one representation is enough |
| P3 | Drop `Commitment.contributorEntityIds` in favor of `CommitmentContributorIndex` | Propose only | Likely duplicate, but current surface query cost and replay behavior require proof |
| P4 | Drop `Commitment.workUIDs` in favor of `CommitmentWorkAttribution` | Propose only | The direct array may still serve detail queries without a scan |
| P5 | Drop `Commitment.evidenceCIDs` and derive `evidenceCount` from attribution rows | Propose only | Direct detail/count reads may justify both fields |
| P6 | Drop `CommitmentExchange.acceptedAtomically` | **Applied** | Entity existence already means the marker event occurred, with no query or interpretation cost |
| P7 | Merge `SettlementConfiguration.feeReserveLow` into a selector derived from `nativeFeeBalance` + `feeReserveMinimum` | Propose only | The indexed readiness flag may avoid inconsistent client-side arithmetic and simplify alerts |
| P8 | Merge payout-plan child status counts into a generated summary | Propose only | Current counters avoid child scans and are useful on queue/list surfaces |
| P9 | Move contributor-payout edit audit fields into a versioned edit entity | Propose only | A new entity would increase handler and query complexity; current fields are bounded |
| P10 | Merge duplicated Safe/Roles fields between `SettlementAccount` and `SettlementGardenRoute` | Propose only | The rows live on different event chains and must remain replayable independently |

Ten schema proposals were considered. Only P6 met the inline-removal rule. The other nine stay
proposals for Afo/Claude review.

## Core pooling schema audit

This is a proposal-impact register, not an exhaustive field inventory. Every property touched by
P1–P10 appears exactly once as Keep, Merge proposal, Drop proposal, or Applied drop. Any canonical
GraphQL property omitted from these summary rows remains **Keep by default**; omission authorizes
no schema removal or merge. `contract-spec.md` §8.2 and `settlement-spec.md` §6 remain the complete
field inventories.

| Entity | Keep | Merge proposal | Drop proposal / applied | Query or invariant served |
|---|---|---|---|---|
| `CommitmentPool` | `id`, `chainId`, `poolId`, `garden`, `gardenId`, `poolType`, `state`, `charterCID`, `pauseReasonCID`, `providerOpenCommitmentCap`, `commitmentsOffered`, `commitmentsRequested`, `commitmentsAccepted`, `commitmentsReadyForConfirmation`, `commitmentsFulfilled`, `commitmentsCancelled`, `commitmentsExpired`, `commitmentsDisputed`, `workLinkedCount`, `workApprovedCount`, `openCommitmentCount`, `commitmentsDue`, `createdAt`, `updatedAt` | P1: `openSeasonCycleId`, `openSeasonCycleEntityId`; P2: `openCampaignIds`, `openCampaignEntityIds` | — | Pool home, readiness, counts, exact current-cycle relations, promise-kept denominator |
| `CommitmentCycle` | `id`, `chainId`, `cycleId`, `poolId`, `poolEntityId`, `garden`, `gardenId`, `cycleType`, `state`, `startTime`, `endTime`, `metadataCID`, `gardenersBps`, `treasuryBps`, `operatorBps`, `evaluatorBps`, `communityBps`, `funderBps`, `equalParticipationBps`, `verifiedContributionBps`, `liveCommitmentCount`, `commitmentsAccepted`, `commitmentsReadyForConfirmation`, `commitmentsFulfilled`, `commitmentsCancelled`, `commitmentsExpired`, `commitmentsDisputed`, `commitmentsDue`, `openCommitmentCount`, `createdAt`, `updatedAt` | — | — | Cycle-close O(1) gate, six-class snapshot, recognition policy, cycle summaries |
| `CommitmentUnitSummary` | `id`, `chainId`, `scope`, `scopeId`, `poolId`, `poolEntityId`, `cycleId`, `cycleEntityId`, `unitLabel`, `unitLabelHash`, `expectedUnits`, `approvedUnits`, `fulfilledUnits`, `openUnits`, `updatedAt` | — | — | Exact-label identity and pool/cycle operational groups with no cross-label arithmetic |
| `CommitmentProviderExposure` | `id`, `chainId`, `poolId`, `poolEntityId`, `provider`, `openCommitmentCount`, `updatedAt` | — | — | Direct provider-cap read without enumerating commitments |
| `Commitment` | `id`, `chainId`, `commitmentId`, `poolId`, `poolEntityId`, `cycleId`, `cycleEntityId`, `garden`, `gardenId`, `creator`, `recordedBy`, `counterparty`, `leadProvider`, `providerGarden`, `providerGardenId`, `counterpartyKind`, `direction`, `commitmentType`, `state`, `claimType`, `claimMode`, `contributorPolicy`, `domains`, `requirementCount`, `contributorCount`, `contributorsFrozen`, `unitLabel`, `targetUnits`, `approvedUnits`, `confirmationThreshold`, `confirmationCount`, `confirmers`, `requiresAssessment`, `assessmentUID`, `needUID`, `counterCommitmentId`, `counterCommitmentEntityId`, `declaredUnitValue`, `declaredValueBasis`, `declaredValueUpdateBlockNumber`, `declaredValueUpdateLogIndex`, `metadataCID`, `dueDate`, `rewardRail`, `rewardSource`, `rewardRecipient`, `rewardToken`, `rewardAmount`, `rewardPaid`, `rewardPayoutRef`, `rewardRecordedBy`, `readyOverridden`, `fulfilledByFallback`, `preDisputeState`, `lifecycleBlockNumber`, `lifecycleLogIndex`, `disputeReasonCID`, `cancelReasonCID`, `createdAt`, `updatedAt` | — | P3: `contributorEntityIds`; P4: `workUIDs`; P5: `evidenceCIDs`, `evidenceCount` | Detail, permission, cursor-ordered lifecycle, exchange, deterministic declared-value replay, reward, dispute, and lineage reads |
| `CommitmentRequirement` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `requirementIndex`, `domain`, `actionUID`, `requiredCount`, `approvedCount`, `createdAt`, `updatedAt` | — | — | Repeatable action progress with stable row binding |
| `CommitmentContributor` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `contributor`, `active`, `isLead`, `approvedWorkCredits`, `evidenceCredits`, `uncountedLinkedWorkCount`, `requirementIndexes`, `recognitionWeightBps`, `addedBy`, `addedAt`, `removedBy`, `removedAt`, `updatedAt` | — | — | Roster policy, exit gates, credit, recognition, audit |
| `HypercertCommitmentContributorAllocation` | `id`, `chainId`, `hypercertId`, `hypercertEntityId`, `commitmentId`, `commitmentEntityId`, `contributor`, `contributorEntityId`, `recognitionWeightBps`, `commitmentGardenersClassUnits`, `recognitionUnits`, `createdAt`, `updatedAt` | — | — | Certificate-scoped units without overwriting stable commitment weights |
| `CommitmentWorkAttribution` | `id`, `chainId`, `workUID`, `commitmentId`, `commitmentEntityId`, `contributor`, `contributorEntityId`, `requirementIndex`, `linked`, `creditActive`, `latestDecisionSequence`, `latestDecisionUID`, `linkedBy`, `linkedAt`, `unlinkedBy`, `unlinkedAt`, `updatedAt` | — | — | Out-of-order Work decision convergence and reversible pre-freeze credit |
| `CommitmentContributorIndex` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `contributorEntityIds`, `updatedAt` | — | — | Empty-`getWhere` safe bounded roster lookup |
| `CommitmentEvidenceAttribution` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `cid`, `contributor`, `contributorEntityId`, `attacher`, `confirmed`, `createdAt`, `updatedAt` | — | — | Exact-CID provenance and one-credit attribution |
| `CommitmentEvidenceAttributionIndex` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `attributionEntityIds`, `updatedAt` | — | — | Bounded fulfillment confirmation without a database scan |
| `CommitmentClaimRequest` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `claimant`, `requestedBy`, `claimType`, `gardenContext`, `gardenContextId`, `state`, `reasonCID`, `resolutionCode`, `requestedAt`, `resolvedAt`, `updatedAt` | — | — | One accountable-lead request, explicit decline/supersession reason, identity audit |
| `CommitmentClaimRequestIndex` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `requestIds`, `updatedAt` | — | — | Bounded sibling supersession with empty-`getWhere` protection |
| `CommitmentEvent` | `id`, `chainId`, `poolId`, `poolEntityId`, `cycleId`, `cycleEntityId`, `commitmentId`, `commitmentEntityId`, `eventType`, `actor`, `configurationKey`, `previousValue`, `newValue`, `units`, `data`, `txHash`, `timestamp` | — | — | Event timeline, pool-less audit, explicit actor-only rule, explorer link |
| `NeedCommitmentIndex` | `id`, `chainId`, `needUID`, `commitmentEntityIds`, `fulfilledCommitmentEntityIds`, `cycleEntityIds`, `hypercertEntityIds`, `updatedAt` | — | — | Direct Need → promise → cycle/certificate lineage without EAS scanning |
| `CommitmentCounterIndex` | `id`, `chainId`, `commitmentId`, `commitmentEntityId`, `referencingCommitmentEntityIds`, `updatedAt` | — | — | Reverse one-way exchange-reference lookup |
| `CommitmentExchange` | `id`, `chainId`, `poolId`, `poolEntityId`, `commitmentIdA`, `commitmentEntityIdA`, `commitmentIdB`, `commitmentEntityIdB`, `acceptorA`, `acceptorB`, `txHash`, `acceptedAt` | — | **P6 applied:** `acceptedAtomically` removed | Marker existence already proves atomic bilateral acceptance; pair feed and status join ordinary commitments |
| `PoolMemberHistory` | `id`, `chainId`, `poolId`, `poolEntityId`, `account`, `leadAccepted`, `leadFulfilled`, `leadCancelled`, `leadExpired`, `contributorFulfilled`, `receivedFulfilled`, `confirmationsGiven`, `disputesRaised`, `updatedAt` | — | — | Counts-only steward/self memory, never protocol-consumed standing or a score |

## Settlement schema audit

The same proposal-impact rule applies here: only fields needed to evaluate P7–P10 and their
invariants are enumerated. Every unlisted canonical settlement property is Keep by default.

| Entity | Keep | Merge proposal | Drop proposal / applied | Query or invariant served |
|---|---|---|---|---|
| `SettlementConfiguration` | `id`, `chainId`, `role`, `gardenerDeliveryEnabled`, `protocolGarden`, `gDollarToken`, `hatsModule`, `commitmentPoolingModule`, `localContract`, `localRouter`, `localChainSelector`, `remoteChainSelector`, `remoteEvmChainId`, `activePeer`, `previousPeer`, `previousPeerExpiresAt`, `protocolVersion`, `dispatcher`, `batchSizeLimit`, `maxTransferAmount`, `maxBatchAmount`, `maxFeeBps`, `maxFeeAmount`, `periodDuration`, `maxPeriodAmount`, `feeReserveMinimum`, `nativeFeeBalance`, `peerConfigured`, `paused`, `updatedAt` | P7: `feeReserveLow` | — | Chain-role route readiness, peer rotation, exact EVM/CCIP identity, fee and delivery gates |
| `SettlementAccount` | `id`, `chainId`, `garden`, `gardenId`, `accountChainId`, `account`, `active`, `recoveryConfigHash`, `recoveryThreshold`, `recoveryOwners`, `rolesModifier`, `roleKey`, `allowanceKey`, `permissionsConfigHash`, `updatedAt` | — | — | Source-chain garden registration, Safe recovery and permission integrity |
| `SettlementGardenRoute` | `id`, `chainId`, `sourceChainId`, `garden`, `gardenId`, `settlementAccountId`, `safe`, `active`, `configuredAt`, `updatedAt` | P10: `rolesModifier`, `roleKey`, `allowanceKey`, `permissionsConfigHash` | — | Executor-chain replay and source-garden relation, independent of selector inference |
| `Disbursement` | `id`, `chainId`, `executorGarden`, `payoutPlanId`, `kind`, `recipient`, `state`, `attempt`, `celoExecutionTx`, `cancelledFromState`, `createdAt` | — | — | Gardener receipt, queue grouping, origin-aware cancellation, execution link |
| `CommitmentPayoutPlan` | `id`, `chainId`, `payoutPlanId`, `commitmentId`, `commitmentEntityId`, `providerGarden`, `providerGardenId`, `source`, `token`, `declaredAmount`, `gardenRetainedAmount`, `contributorPayoutTotal`, `recognitionContributorCount`, `payableContributorCount`, `recognitionSnapshotHash`, `paymentSnapshotHash`, `paymentSnapshotVersion`, `latestEditReasonCID`, `finalized`, `status`, `disbursementEntityIds`, `createdBy`, `createdAt`, `finalizedAt`, `updatedAt` | P8: `preparedPayoutCount`, `confirmedPayoutCount`, `failedPayoutCount`, `cancelledPayoutCount` | — | Conservation, immutable snapshots, stable parent, queue/list status without scans |
| `ContributorPayout` | `id`, `chainId`, `payoutPlanId`, `payoutPlanEntityId`, `commitmentId`, `commitmentEntityId`, `contributor`, `contributorEntityId`, `recipient`, `recognitionWeightBps`, `paymentWeightBps`, `amount`, `disbursementId`, `disbursementEntityId`, `createdAt`, `updatedAt` | P9: `paymentSnapshotVersion`, `latestEditReasonCID`, `editedBy` | — | Recognition/payment comparison, canonical recipient, immutable child link |
| `SettlementBatch` | `id`, `chainId`, `source`, `disbursementIds`, `state`, `dispatchedAt`, `reasonCID`, `createdAt` | — | — | Immutable bounded batch composition and whole-batch cancellation |
| `SettlementMessage` | `id`, `chainId`, `direction`, `isBatch`, `subjectId`, `attempt`, `destinationPeer`, `destinationGasLimit`, `protocolVersion`, `commandPayloadHash`, `sourceChainId`, `status`, `createdAt` | — | — | Command/ack binding, destination snapshot, attempt history, inverted replay |
| `SettlementExecution` | `id`, `chainId`, `sourceChainId`, `executionKey`, `commandMessageId`, `acknowledgmentReceiver`, `protocolVersion`, `executorGarden`, `executorGardenId`, `isBatch`, `settlementId`, `attempt`, `status`, `failureCode`, `txHash`, `acknowledgmentMessageId`, `acknowledgmentSent`, `acknowledgmentDeferralCode`, `createdAt`, `updatedAt` | — | — | Idempotent Celo result, authenticated acknowledgment, deferral recovery, explorer proof |

## Inline synchronization record

P6 is the only applied schema change. It is synchronized across `contract-spec.md` §8.2 handler
rules and D7/D7b presentation: the `CommitmentExchange` row itself is the atomic marker. The
acceptance matrix asserts entity existence without a redundant boolean, and the indexer/state-API
handoffs carry the same marker rule. All other field-level changes remain proposals and authorize
no indexer or shared-query implementation.
