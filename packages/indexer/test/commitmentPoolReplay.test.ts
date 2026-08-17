import assert from "node:assert/strict";

import {
  Addresses,
  CommitmentPoolingModule,
  CommitmentRegistry,
  createTestIndexer,
  processEvents,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_715_000;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(offset: number, logIndex = 0) {
  const blockNumber = START_BLOCK + offset;
  return {
    chainId: CHAIN_ID,
    block: { timestamp: blockNumber, number: blockNumber },
    srcAddress: undefined,
    transaction: { hash: hash(offset * 10 + logIndex + 1) },
    logIndex,
  };
}

function goldenLifecycleEvents() {
  return [
    CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 7n,
      garden: address(1),
      poolType: 0n,
      mockEventData: eventData(0),
    }),
    CommitmentPoolingModule.PoolCharterUpdated.createMockEvent({
      poolId: 7n,
      charterCID: "ipfs://golden-charter",
      mockEventData: eventData(1),
    }),
    CommitmentPoolingModule.PoolReady.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(2),
    }),
    CommitmentPoolingModule.PoolOpened.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(3),
    }),
    CommitmentPoolingModule.CycleSeeded.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      cycleType: 0n,
      startTime: 10n,
      endTime: 100n,
      metadataCID: "ipfs://golden-cycle",
      mockEventData: eventData(4),
    }),
    CommitmentPoolingModule.CycleOpened.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      gardenersBps: 6_000n,
      treasuryBps: 1_000n,
      operatorBps: 1_000n,
      evaluatorBps: 500n,
      communityBps: 500n,
      funderBps: 1_000n,
      equalParticipationBps: 2_000n,
      verifiedContributionBps: 8_000n,
      mockEventData: eventData(5),
    }),
    CommitmentPoolingModule.CommitmentSeriesCreated.createMockEvent({
      seriesId: 11n,
      poolId: 7n,
      holder: address(2),
      metadataCID: "ipfs://golden-series",
      mockEventData: eventData(6),
    }),
    CommitmentPoolingModule.CommitmentCreated.createMockEvent({
      commitmentId: 21n,
      poolId: 7n,
      cycleId: 9n,
      commitmentSeriesId: 11n,
      creationRequestKey: hash(801),
      creationPayloadHash: hash(802),
      creator: address(2),
      recordedBy: address(2),
      direction: 0n,
      commitmentType: 0n,
      claimType: 1n,
      claimMode: 1n,
      contributorPolicy: 1n,
      domains: [1n],
      requirementActionUIDs: [10n],
      requirementDomains: [1n],
      requirementRequiredCounts: [2n],
      unitLabel: "hours",
      targetUnits: 2n,
      requiresAssessment: true,
      dueDate: 100n,
      metadataCID: "ipfs://golden-commitment",
      needUID: hash(803),
      counterCommitmentId: 0n,
      declaredUnitValue: 25n,
      declaredValueBasis: "G$/hour",
      payerGarden: address(1),
      mockEventData: eventData(7),
    }),
    CommitmentRegistry.UnitsCommitted.createMockEvent({
      classId: 31n,
      poolId: 7n,
      account: address(2),
      cycleId: 9n,
      unitLabel: "hours",
      units: 2n,
      totalCommitted: 2n,
      mockEventData: eventData(8),
    }),
    CommitmentPoolingModule.ConsiderationDeclared.createMockEvent({
      commitmentId: 21n,
      rail: 1n,
      source: address(1),
      token: address(8),
      amount: 50n,
      mockEventData: eventData(9),
    }),
    CommitmentPoolingModule.ValueDeclared.createMockEvent({
      commitmentId: 21n,
      declaredUnitValue: 30n,
      declaredValueBasis: "G$/hour",
      mockEventData: eventData(10),
    }),
    CommitmentPoolingModule.ConfirmerRuleSet.createMockEvent({
      commitmentId: 21n,
      confirmers: [address(3)],
      threshold: 1n,
      protocolFallbackEnabled: false,
      mockEventData: eventData(11),
    }),
    CommitmentPoolingModule.ContributorAdded.createMockEvent({
      commitmentId: 21n,
      contributor: address(2),
      addedBy: address(2),
      mockEventData: eventData(12),
    }),
    CommitmentPoolingModule.ContributorRequirementAssigned.createMockEvent({
      commitmentId: 21n,
      contributor: address(2),
      requirementIndex: 0n,
      assigned: true,
      mockEventData: eventData(13),
    }),
    CommitmentPoolingModule.WorkLinked.createMockEvent({
      commitmentId: 21n,
      workUID: hash(804),
      contributor: address(2),
      requirementIndex: 0n,
      linker: address(2),
      operationKey: hash(805),
      mockEventData: eventData(14),
    }),
    CommitmentPoolingModule.ApprovedWorkCounted.createMockEvent({
      commitmentId: 21n,
      workUID: hash(804),
      contributor: address(2),
      approvalUID: hash(806),
      decisionSequence: 1n,
      requirementIndex: 0n,
      approvedWorkCount: 2n,
      approvedUnits: 2n,
      newlyApprovedUnits: 2n,
      mockEventData: eventData(15),
    }),
    CommitmentPoolingModule.EvidenceAttached.createMockEvent({
      commitmentId: 21n,
      cid: "ipfs://golden-evidence",
      attacher: address(2),
      creditedContributors: [address(2)],
      mockEventData: eventData(16),
    }),
    CommitmentPoolingModule.AssessmentAttached.createMockEvent({
      commitmentId: 21n,
      assessmentUID: hash(807),
      attacher: address(4),
      mockEventData: eventData(17),
    }),
    CommitmentPoolingModule.ContributorRosterFrozen.createMockEvent({
      commitmentId: 21n,
      contributorCount: 1n,
      mockEventData: eventData(18),
    }),
    CommitmentPoolingModule.ClaimRequested.createMockEvent({
      commitmentId: 21n,
      claimant: address(3),
      requestedBy: address(3),
      kind: 1n,
      gardenContext: address(4),
      requestedAt: 123n,
      mockEventData: eventData(19),
    }),
    CommitmentPoolingModule.CommitmentAccepted.createMockEvent({
      commitmentId: 21n,
      claimant: address(3),
      counterparty: address(3),
      kind: 1n,
      gardenContext: address(4),
      leadProvider: address(2),
      providerGarden: address(1),
      payerGarden: address(4),
      mockEventData: eventData(20),
    }),
    CommitmentPoolingModule.CommitmentReadyForConfirmation.createMockEvent({
      commitmentId: 21n,
      overridden: false,
      reason: "requirements-complete",
      mockEventData: eventData(21),
    }),
    CommitmentPoolingModule.ConfirmationRecorded.createMockEvent({
      commitmentId: 21n,
      confirmer: address(3),
      confirmationCount: 1n,
      threshold: 1n,
      mockEventData: eventData(22),
    }),
    CommitmentPoolingModule.CommitmentFulfilled.createMockEvent({
      commitmentId: 21n,
      confirmer: address(3),
      confirmationPath: 0n,
      reason: "confirmed",
      mockEventData: eventData(23),
    }),
    CommitmentRegistry.UnitsFulfilled.createMockEvent({
      classId: 31n,
      poolId: 7n,
      account: address(2),
      cycleId: 9n,
      unitLabel: "hours",
      units: 2n,
      totalFulfilled: 2n,
      mockEventData: eventData(24),
    }),
    CommitmentPoolingModule.CycleClosed.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      mockEventData: eventData(25),
    }),
    CommitmentPoolingModule.CycleComposted.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      mockEventData: eventData(26),
    }),
    CommitmentPoolingModule.PoolClosed.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(27),
    }),
    CommitmentPoolingModule.PoolComposted.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(28),
    }),
  ];
}

const POOLING_ENTITY_STORES = [
  "CommitmentPool",
  "CommitmentCycle",
  "CommitmentCycleCommitmentIndex",
  "CommitmentClass",
  "CommitmentUnitSummary",
  "CommitmentProviderExposure",
  "CommitmentSeries",
  "CommitmentSeriesCycleSummary",
  "Commitment",
  "CommitmentRequirement",
  "CommitmentContributor",
  "CommitmentContributorRequirementAssignment",
  "CommitmentWorkAttribution",
  "CommitmentEvidenceAttribution",
  "CommitmentClaimRequest",
  "CommitmentExchange",
  "PoolMemberHistory",
  "CommitmentFunding",
  "HypercertCommitmentContributorAllocation",
  "CommitmentContributorIndex",
  "CommitmentContributorRequirementIndex",
  "CommitmentEvidenceAttributionIndex",
  "CommitmentClaimRequestIndex",
  "NeedCommitmentIndex",
  "CommitmentCounterIndex",
  "CommitmentFundingIndex",
  "CommitmentEvent",
  "CommitmentPendingLifecycleProjection",
  "CommitmentPendingLifecycleProjectionIndex",
] as const;

async function poolingSnapshot(
  indexer: ReturnType<typeof createTestIndexer>
): Promise<Record<string, unknown[]>> {
  const snapshot: Record<string, unknown[]> = {};
  for (const entityStore of POOLING_ENTITY_STORES) {
    snapshot[entityStore] = (await indexer[entityStore].getAll()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );
  }
  return snapshot;
}

describe("Commitment Pooling golden lifecycle replay", () => {
  it("converges to the same complete read model in canonical and reverse delivery order", async () => {
    const events = goldenLifecycleEvents();
    const canonical = await processEvents(createTestIndexer(), events);
    const reversed = await processEvents(createTestIndexer(), [...events].reverse());

    const canonicalSnapshot = await poolingSnapshot(canonical);
    const reversedSnapshot = await poolingSnapshot(reversed);
    assert.deepEqual(reversedSnapshot, canonicalSnapshot);

    const pool = await canonical.CommitmentPool.get(`${CHAIN_ID}-7`);
    const cycle = await canonical.CommitmentCycle.get(`${CHAIN_ID}-9`);
    const series = await canonical.CommitmentSeries.get(`${CHAIN_ID}-11`);
    const commitment = await canonical.Commitment.get(`${CHAIN_ID}-21`);
    const claim = await canonical.CommitmentClaimRequest.get(
      `${CHAIN_ID}-21-${address(3).toLowerCase()}`
    );
    const summary = (await canonical.CommitmentUnitSummary.getAll()).find(
      (row) => row.scope === "POOL" && row.unitLabel === "hours"
    );

    assert.ok(pool);
    assert.ok(cycle);
    assert.ok(series);
    assert.ok(commitment);
    assert.ok(claim);
    assert.ok(summary);
    assert.equal(pool.state, "COMPOSTED");
    assert.equal(pool.liveCommitmentCount, 0n);
    assert.equal(pool.nonTerminalCycleCount, 0n);
    assert.equal(pool.openCommitmentCount, 0n);
    assert.equal(cycle.state, "COMPOSTED");
    assert.equal(series.fulfilledCount, 1n);
    assert.deepEqual(series.fulfilledCycleIds, [`${CHAIN_ID}-9`]);
    assert.equal(commitment.state, "FULFILLED");
    assert.equal(commitment.approvedUnits, 2n);
    assert.equal(commitment.evidenceCount, 1);
    assert.equal(commitment.assessmentUID, hash(807));
    assert.equal(claim.state, "ACCEPTED");
    assert.equal(summary.expectedUnits, 2n);
    assert.equal(summary.approvedUnits, 2n);
    assert.equal(summary.fulfilledUnits, 2n);
    assert.equal(summary.openUnits, 0n);
  });
});
