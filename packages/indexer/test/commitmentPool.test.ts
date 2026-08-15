import assert from "node:assert/strict";

import {
  Addresses,
  CommitmentRegistry,
  CommitmentPoolingModule,
  createTestIndexer,
  processEvents,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_713_812;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(blockNumber: number, logIndex: number, transactionIndex = logIndex) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp: blockNumber, number: blockNumber },
    srcAddress: address(90),
    transaction: { hash: hash(transactionIndex) },
    logIndex,
  };
}

function commitmentCreated(
  commitmentId: bigint,
  blockNumber: number,
  options: {
    readonly poolId?: bigint;
    readonly cycleId?: bigint;
    readonly direction?: bigint;
    readonly unitLabel?: string;
    readonly payerGarden?: string;
  } = {}
) {
  return CommitmentPoolingModule.CommitmentCreated.createMockEvent({
    commitmentId,
    poolId: options.poolId ?? 7n,
    cycleId: options.cycleId ?? 9n,
    commitmentSeriesId: 0n,
    creationRequestKey: hash(Number(commitmentId) + 100),
    creationPayloadHash: hash(Number(commitmentId) + 200),
    creator: address(2),
    recordedBy: address(2),
    direction: options.direction ?? 0n,
    commitmentType: 0n,
    claimType: 1n,
    claimMode: 1n,
    contributorPolicy: 1n,
    domains: [1n],
    requirementActionUIDs: [10n],
    requirementDomains: [1n],
    requirementRequiredCounts: [2n],
    unitLabel: options.unitLabel ?? "hours",
    targetUnits: 2n,
    requiresAssessment: false,
    dueDate: 0n,
    metadataCID: "ipfs://commitment",
    needUID: hash(50),
    counterCommitmentId: 0n,
    declaredUnitValue: 0n,
    declaredValueBasis: "",
    payerGarden: options.payerGarden ?? address(1),
    mockEventData: eventData(blockNumber, 0, blockNumber - START_BLOCK + 100),
  });
}

describe("Commitment Pooling read model", () => {
  it("preserves the bare Garden id and lets the newest pool lifecycle position win", async () => {
    const garden = address(1).toUpperCase().replace("0X", "0x");
    let db = createTestIndexer();
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 7n,
      garden,
      poolType: 0n,
      mockEventData: eventData(START_BLOCK, 0, 1),
    });
    const paused = CommitmentPoolingModule.PoolPaused.createMockEvent({
      poolId: 7n,
      reasonCID: "ipfs://pause",
      mockEventData: eventData(START_BLOCK + 2, 2, 2),
    });
    const staleOpen = CommitmentPoolingModule.PoolOpened.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 1, 1, 3),
    });

    db = await processEvents(db, [registered, paused, staleOpen]);
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);

    assert.ok(pool);
    assert.equal(pool.gardenId, garden.toLowerCase());
    assert.equal(pool.state, "PAUSED");
    assert.equal(pool.pauseReasonCID, "ipfs://pause");
  });

  it("copies both creation recovery fields from CommitmentCreated without an RPC read", async () => {
    let db = createTestIndexer();
    const creationRequestKey = hash(41);
    const creationPayloadHash = hash(42);
    const created = CommitmentPoolingModule.CommitmentCreated.createMockEvent({
      commitmentId: 11n,
      poolId: 7n,
      cycleId: 0n,
      commitmentSeriesId: 0n,
      creationRequestKey,
      creationPayloadHash,
      creator: address(2),
      recordedBy: address(2),
      direction: 0n,
      commitmentType: 0n,
      claimType: 1n,
      claimMode: 0n,
      contributorPolicy: 0n,
      domains: [1n],
      requirementActionUIDs: [10n],
      requirementDomains: [1n],
      requirementRequiredCounts: [2n],
      unitLabel: "hours",
      targetUnits: 2n,
      requiresAssessment: false,
      dueDate: 0n,
      metadataCID: "ipfs://commitment",
      needUID: hash(0),
      counterCommitmentId: 0n,
      declaredUnitValue: 0n,
      declaredValueBasis: "",
      payerGarden: address(1),
      mockEventData: eventData(START_BLOCK + 3, 0, 4),
    });

    db = await CommitmentPoolingModule.CommitmentCreated.processEvent({
      event: created,
      mockDb: db,
    });
    const commitment = await db.Commitment.get(`${CHAIN_ID}-11`);
    assert.ok(commitment);
    assert.equal(commitment.creationRequestKey, creationRequestKey);
    assert.equal(commitment.creationPayloadHash, creationPayloadHash);
    assert.equal(commitment.creationSeen, true);
  });

  it("fills a reverse-delivered cycle snapshot and closes only after both pool guards reach zero", async () => {
    let db = createTestIndexer();
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 7n,
      garden: address(1),
      poolType: 0n,
      mockEventData: eventData(START_BLOCK, 0, 10),
    });
    const opened = CommitmentPoolingModule.CycleOpened.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      gardenersBps: 6000n,
      treasuryBps: 1000n,
      operatorBps: 1000n,
      evaluatorBps: 500n,
      communityBps: 500n,
      funderBps: 1000n,
      equalParticipationBps: 2000n,
      verifiedContributionBps: 8000n,
      mockEventData: eventData(START_BLOCK + 3, 0, 11),
    });
    const seeded = CommitmentPoolingModule.CycleSeeded.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      cycleType: 0n,
      startTime: 1n,
      endTime: 2n,
      metadataCID: "ipfs://cycle",
      mockEventData: eventData(START_BLOCK + 2, 0, 12),
    });
    const blockedClose = CommitmentPoolingModule.PoolClosed.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 4, 0, 13),
    });

    db = await processEvents(db, [registered, opened, seeded, blockedClose]);
    let pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const cycle = await db.CommitmentCycle.get(`${CHAIN_ID}-9`);
    assert.ok(pool);
    assert.ok(cycle);
    assert.equal(cycle.state, "OPEN");
    assert.equal(cycle.gardenersBps, 6000);
    assert.equal(pool.nonTerminalCycleCount, 1n);
    assert.equal(pool.openSeasonCycleId, 9n);
    assert.notEqual(pool.state, "CLOSED");

    const composted = CommitmentPoolingModule.CycleComposted.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 5, 0, 14),
    });
    const close = CommitmentPoolingModule.PoolClosed.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 6, 0, 15),
    });
    db = await processEvents(db, [composted, close]);
    pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    assert.ok(pool);
    assert.equal(pool.nonTerminalCycleCount, 0n);
    assert.equal(pool.openSeasonCycleId, undefined);
    assert.equal(pool.state, "CLOSED");
  });

  it("drains lifecycle events after creation and reconciles late acceptance, claims, and member history once", async () => {
    let db = createTestIndexer();
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 7n,
      garden: address(1),
      poolType: 0n,
      mockEventData: eventData(START_BLOCK, 0, 20),
    });
    const seeded = CommitmentPoolingModule.CycleSeeded.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      cycleType: 0n,
      startTime: 1n,
      endTime: 2n,
      metadataCID: "ipfs://cycle",
      mockEventData: eventData(START_BLOCK + 1, 0, 21),
    });
    const accepted = CommitmentPoolingModule.CommitmentAccepted.createMockEvent({
      commitmentId: 11n,
      claimant: address(3),
      counterparty: address(3),
      kind: 1n,
      gardenContext: address(4),
      leadProvider: address(2),
      providerGarden: address(1),
      payerGarden: address(4),
      mockEventData: eventData(START_BLOCK + 5, 0, 22),
    });
    const fulfilled = CommitmentPoolingModule.CommitmentFulfilled.createMockEvent({
      commitmentId: 11n,
      confirmer: address(3),
      confirmationPath: 0n,
      reason: "",
      mockEventData: eventData(START_BLOCK + 8, 0, 23),
    });
    db = await processEvents(db, [registered, seeded, fulfilled, accepted]);
    let commitment = await db.Commitment.get(`${CHAIN_ID}-11`);
    assert.ok(commitment);
    assert.equal(commitment.creationSeen, false);
    assert.equal(commitment.lifecycleBlockNumber, undefined);

    db = createTestIndexer();
    const contributor = CommitmentPoolingModule.ContributorAdded.createMockEvent({
      commitmentId: 11n,
      contributor: address(2),
      addedBy: address(2),
      mockEventData: eventData(START_BLOCK + 4, 0, 24),
    });
    const frozen = CommitmentPoolingModule.ContributorRosterFrozen.createMockEvent({
      commitmentId: 11n,
      contributorCount: 1n,
      mockEventData: eventData(START_BLOCK + 6, 0, 25),
    });
    const lateClaim = CommitmentPoolingModule.ClaimRequested.createMockEvent({
      commitmentId: 11n,
      claimant: address(3),
      requestedBy: address(3),
      kind: 1n,
      gardenContext: address(4),
      requestedAt: 123n,
      mockEventData: eventData(START_BLOCK + 3, 0, 26),
    });
    db = await processEvents(db, [
      registered,
      seeded,
      fulfilled,
      accepted,
      commitmentCreated(11n, START_BLOCK + 2),
      contributor,
      frozen,
      lateClaim,
    ]);

    commitment = await db.Commitment.get(`${CHAIN_ID}-11`);
    const claim = await db.CommitmentClaimRequest.get(`${CHAIN_ID}-11-${address(3).toLowerCase()}`);
    const leadHistory = await db.PoolMemberHistory.get(`${CHAIN_ID}-7-${address(2).toLowerCase()}`);
    const receiverHistory = await db.PoolMemberHistory.get(
      `${CHAIN_ID}-7-${address(3).toLowerCase()}`
    );
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    assert.ok(commitment);
    assert.ok(claim);
    assert.ok(leadHistory);
    assert.ok(receiverHistory);
    assert.ok(pool);
    assert.equal(commitment.state, "FULFILLED");
    assert.equal(commitment.acceptanceSeen, true);
    assert.deepEqual(commitment.fulfilledContributorHistoryAccounts, []);
    assert.equal(commitment.fulfilledReceiverHistoryAccount, address(3).toLowerCase());
    assert.equal(claim.state, "ACCEPTED");
    assert.equal(leadHistory.leadAccepted, 1);
    assert.equal(leadHistory.leadFulfilled, 1);
    assert.equal(receiverHistory.receivedFulfilled, 1);
    assert.equal(pool.liveCommitmentCount, 0n);
    assert.equal(pool.commitmentsFulfilled, 1n);
    assert.equal(pool.commitmentsDue, 1n);
  });

  it("keeps exact-label unit rows and provider exposure as replay-safe signed register deltas", async () => {
    let db = createTestIndexer();
    const released = CommitmentRegistry.UnitsReleased.createMockEvent({
      classId: 11n,
      poolId: 7n,
      account: address(2),
      cycleId: 9n,
      unitLabel: "hours",
      units: 2n,
      totalCommitted: 0n,
      mockEventData: eventData(START_BLOCK + 2, 0, 30),
    });
    const committed = CommitmentRegistry.UnitsCommitted.createMockEvent({
      classId: 11n,
      poolId: 7n,
      account: address(2),
      cycleId: 9n,
      unitLabel: "hours",
      units: 2n,
      totalCommitted: 2n,
      mockEventData: eventData(START_BLOCK + 1, 0, 31),
    });
    const distinctLabel = CommitmentRegistry.UnitsCommitted.createMockEvent({
      classId: 12n,
      poolId: 7n,
      account: address(2),
      cycleId: 0n,
      unitLabel: "Hours",
      units: 3n,
      totalCommitted: 3n,
      mockEventData: eventData(START_BLOCK + 3, 0, 32),
    });
    db = await processEvents(db, [released, released, committed, committed, distinctLabel]);

    const summaries = await db.CommitmentUnitSummary.getAll();
    const poolHours = summaries.find((row) => row.scope === "POOL" && row.unitLabel === "hours");
    const cycleHours = summaries.find((row) => row.scope === "CYCLE" && row.unitLabel === "hours");
    const capitalHours = summaries.find((row) => row.unitLabel === "Hours");
    const exposure = await db.CommitmentProviderExposure.get(
      `${CHAIN_ID}-7-${address(2).toLowerCase()}`
    );
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    assert.ok(poolHours);
    assert.ok(cycleHours);
    assert.ok(capitalHours);
    assert.ok(exposure);
    assert.ok(pool);
    assert.equal(poolHours.openUnits, 0n);
    assert.equal(cycleHours.expectedUnits, 0n);
    assert.equal(capitalHours.openUnits, 3n);
    assert.notEqual(poolHours.unitLabelHash, capitalHours.unitLabelHash);
    assert.equal(exposure.openCommitmentCount, 1n);
    assert.equal(pool.openCommitmentCount, 1n);
  });

  it("reconciles independent work decisions and credits evidence only once per contributor", async () => {
    let db = createTestIndexer();
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 7n,
      garden: address(1),
      poolType: 0n,
      mockEventData: eventData(START_BLOCK, 0, 40),
    });
    db = await processEvents(db, [registered, commitmentCreated(21n, START_BLOCK + 1)]);
    const contributor = CommitmentPoolingModule.ContributorAdded.createMockEvent({
      commitmentId: 21n,
      contributor: address(2),
      addedBy: address(2),
      mockEventData: eventData(START_BLOCK + 2, 0, 41),
    });
    const linked = CommitmentPoolingModule.WorkLinked.createMockEvent({
      commitmentId: 21n,
      workUID: hash(70),
      contributor: address(2),
      requirementIndex: 0n,
      linker: address(2),
      operationKey: hash(71),
      mockEventData: eventData(START_BLOCK + 3, 0, 42),
    });
    const counted = CommitmentPoolingModule.ApprovedWorkCounted.createMockEvent({
      commitmentId: 21n,
      workUID: hash(70),
      contributor: address(2),
      approvalUID: hash(72),
      decisionSequence: 1n,
      requirementIndex: 0n,
      approvedWorkCount: 1n,
      approvedUnits: 1n,
      newlyApprovedUnits: 1n,
      mockEventData: eventData(START_BLOCK + 4, 0, 43),
    });
    const evidenceA = CommitmentPoolingModule.EvidenceAttached.createMockEvent({
      commitmentId: 21n,
      cid: "ipfs://one",
      attacher: address(2),
      creditedContributors: [address(2)],
      mockEventData: eventData(START_BLOCK + 5, 0, 44),
    });
    const evidenceB = CommitmentPoolingModule.EvidenceAttached.createMockEvent({
      commitmentId: 21n,
      cid: "ipfs://two",
      attacher: address(2),
      creditedContributors: [address(2)],
      mockEventData: eventData(START_BLOCK + 6, 0, 45),
    });
    const frozen = CommitmentPoolingModule.ContributorRosterFrozen.createMockEvent({
      commitmentId: 21n,
      contributorCount: 1n,
      mockEventData: eventData(START_BLOCK + 7, 0, 46),
    });
    const opened = CommitmentPoolingModule.CycleOpened.createMockEvent({
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
      mockEventData: eventData(START_BLOCK + 8, 0, 47),
    });
    db = await processEvents(db, [
      contributor,
      linked,
      counted,
      evidenceA,
      evidenceB,
      frozen,
      opened,
    ]);

    const row = await db.CommitmentContributor.get(`${CHAIN_ID}-21-${address(2).toLowerCase()}`);
    const requirement = await db.CommitmentRequirement.get(`${CHAIN_ID}-21-0`);
    const summaries = await db.CommitmentUnitSummary.getAll();
    const approvedPool = summaries.find(
      (summary) => summary.scope === "POOL" && summary.unitLabel === "hours"
    );
    assert.ok(row);
    assert.ok(requirement);
    assert.ok(approvedPool);
    assert.equal(row.approvedWorkCredits, 1);
    assert.equal(row.evidenceCredits, 1);
    assert.equal(row.uncountedLinkedWorkCount, 0);
    assert.equal(row.recognitionWeightBps, 10_000);
    assert.equal(requirement.approvedCount, 1);
    assert.equal(approvedPool.approvedUnits, 1n);
  });
});
