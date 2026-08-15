import assert from "node:assert/strict";

import { handleAccepted, handleClaimEvent } from "../src/handlers/commitment-pool-claims";
import { handleLifecycle } from "../src/handlers/commitment-pool-lifecycle";
import { sortedUnique } from "../src/handlers/commitment-pool-projections";
import {
  eventType,
  type PoolingContext,
  type RuntimeEvent,
} from "../src/handlers/commitment-pool-runtime";
import { handleWorkEvent } from "../src/handlers/commitment-pool-work";
import {
  Addresses,
  CommitmentPoolingModule,
  CommitmentRegistry,
  createTestIndexer,
  processEvents,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_714_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(blockNumber: number, logIndex = 0) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp: blockNumber, number: blockNumber },
    srcAddress: address(90),
    transaction: { hash: hash(blockNumber * 10 + logIndex) },
    logIndex,
  };
}

function poolRegistered(blockNumber: number) {
  return CommitmentPoolingModule.PoolRegistered.createMockEvent({
    poolId: 7n,
    garden: address(1),
    poolType: 0n,
    mockEventData: eventData(blockNumber),
  });
}

function cycleSeeded(blockNumber: number) {
  return CommitmentPoolingModule.CycleSeeded.createMockEvent({
    cycleId: 9n,
    poolId: 7n,
    cycleType: 0n,
    startTime: 1n,
    endTime: 2n,
    metadataCID: "ipfs://cycle",
    mockEventData: eventData(blockNumber),
  });
}

function commitmentCreated(
  commitmentId: bigint,
  blockNumber: number,
  direction = 0n,
  payerGarden = address(1)
) {
  return CommitmentPoolingModule.CommitmentCreated.createMockEvent({
    commitmentId,
    poolId: 7n,
    cycleId: 9n,
    commitmentSeriesId: 0n,
    creationRequestKey: hash(Number(commitmentId) + 100),
    creationPayloadHash: hash(Number(commitmentId) + 200),
    creator: address(2),
    recordedBy: address(2),
    direction,
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
    requiresAssessment: false,
    dueDate: 0n,
    metadataCID: "ipfs://commitment",
    needUID: hash(50),
    counterCommitmentId: 0n,
    declaredUnitValue: 0n,
    declaredValueBasis: "",
    payerGarden,
    mockEventData: eventData(blockNumber),
  });
}

function accepted(commitmentId: bigint, blockNumber: number) {
  return CommitmentPoolingModule.CommitmentAccepted.createMockEvent({
    commitmentId,
    claimant: address(3),
    counterparty: address(3),
    kind: 1n,
    gardenContext: address(4),
    leadProvider: address(2),
    providerGarden: address(1),
    payerGarden: address(4),
    mockEventData: eventData(blockNumber),
  });
}

function runtimeEvent(event: Record<string, unknown>, eventName: string): RuntimeEvent {
  return {
    ...event,
    contractName: "CommitmentPoolingModule",
    eventName,
  } as unknown as RuntimeEvent;
}

describe("Commitment Pooling review regressions", () => {
  it("uses deterministic code-unit ordering and exact audit enum normalization", () => {
    assert.deepEqual(sortedUnique(["a", "B", "_", "-"]), ["-", "B", "_", "a"]);
    assert.equal(eventType("ModuleSchemaUIDUpdated"), "MODULE_SCHEMA_UID_UPDATED");
  });

  it("reconciles child identity, registry materialization, and a blocked pool close", async () => {
    let db = createTestIndexer();
    const classRegistered = CommitmentRegistry.ClassRegistered.createMockEvent({
      classId: 41n,
      poolId: 7n,
      cycleId: 9n,
      unitLabel: "hours",
      quota: 10n,
      mockEventData: eventData(START_BLOCK + 3),
    });
    const close = CommitmentPoolingModule.PoolClosed.createMockEvent({
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 5),
    });
    const cancelled = CommitmentPoolingModule.CommitmentCancelled.createMockEvent({
      commitmentId: 31n,
      canceller: address(2),
      reasonCID: "ipfs://cancel",
      mockEventData: eventData(START_BLOCK + 6),
    });
    const composted = CommitmentPoolingModule.CycleComposted.createMockEvent({
      cycleId: 9n,
      poolId: 7n,
      mockEventData: eventData(START_BLOCK + 7),
    });
    db = await processEvents(db, [
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(31n, START_BLOCK + 2, 0n, ZERO_ADDRESS),
      classRegistered,
      poolRegistered(START_BLOCK),
      close,
      cancelled,
      composted,
    ]);

    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const cycle = await db.CommitmentCycle.get(`${CHAIN_ID}-9`);
    const commitment = await db.Commitment.get(`${CHAIN_ID}-31`);
    const need = await db.NeedCommitmentIndex.get(`${CHAIN_ID}-${hash(50)}`);
    const summaries = await db.CommitmentUnitSummary.getAll();
    assert.ok(pool);
    assert.ok(cycle);
    assert.ok(commitment);
    assert.equal(pool.state, "CLOSED");
    assert.equal(pool.pendingCloseBlockNumber, undefined);
    assert.deepEqual(pool.childCycleEntityIds, [`${CHAIN_ID}-9`]);
    assert.deepEqual(pool.childCommitmentEntityIds, [`${CHAIN_ID}-31`]);
    assert.equal(cycle.gardenId, address(1).toLowerCase());
    assert.equal(commitment.gardenId, address(1).toLowerCase());
    assert.equal(commitment.payerGarden, undefined);
    assert.deepEqual(need?.cycleEntityIds, [`${CHAIN_ID}-9`]);
    assert.ok(summaries.some((row) => row.scope === "POOL" && row.unitLabel === "hours"));
    assert.ok(summaries.some((row) => row.scope === "CYCLE" && row.unitLabel === "hours"));
  });

  it("keeps late claim, confirmation, and lifecycle projections monotonic", async () => {
    let db = await processEvents(createTestIndexer(), [
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(32n, START_BLOCK + 2, 1n),
      CommitmentPoolingModule.ClaimRequested.createMockEvent({
        commitmentId: 32n,
        claimant: address(3),
        requestedBy: address(3),
        kind: 1n,
        gardenContext: address(4),
        requestedAt: 123n,
        mockEventData: eventData(START_BLOCK + 3),
      }),
      CommitmentPoolingModule.CommitmentFulfilled.createMockEvent({
        commitmentId: 32n,
        confirmer: address(3),
        confirmationPath: 0n,
        reason: "",
        mockEventData: eventData(START_BLOCK + 8),
      }),
      CommitmentPoolingModule.CommitmentReadyForConfirmation.createMockEvent({
        commitmentId: 32n,
        overridden: false,
        reason: "",
        mockEventData: eventData(START_BLOCK + 7),
      }),
    ]);
    await handleAccepted(
      runtimeEvent(accepted(32n, START_BLOCK + 6), "CommitmentAccepted"),
      db as unknown as PoolingContext
    );
    await handleClaimEvent(
      runtimeEvent(
        CommitmentPoolingModule.ClaimDeclined.createMockEvent({
          commitmentId: 32n,
          claimant: address(3),
          reasonCID: "ipfs://late-decline",
          mockEventData: eventData(START_BLOCK + 5),
        }),
        "ClaimDeclined"
      ),
      db as unknown as PoolingContext
    );
    db = await processEvents(db, [
      CommitmentPoolingModule.ConfirmerRuleSet.createMockEvent({
        commitmentId: 32n,
        confirmers: [address(4), address(5), address(6)],
        threshold: 3n,
        protocolFallbackEnabled: false,
        mockEventData: eventData(START_BLOCK + 10, 1),
      }),
      CommitmentPoolingModule.ConfirmationRecorded.createMockEvent({
        commitmentId: 32n,
        confirmer: address(4),
        confirmationCount: 2n,
        threshold: 2n,
        mockEventData: eventData(START_BLOCK + 10),
      }),
      CommitmentPoolingModule.ConfirmationRecorded.createMockEvent({
        commitmentId: 32n,
        confirmer: address(5),
        confirmationCount: 1n,
        threshold: 2n,
        mockEventData: eventData(START_BLOCK + 9),
      }),
      CommitmentPoolingModule.CommitmentDisputed.createMockEvent({
        commitmentId: 32n,
        raiser: address(4),
        previousState: 5n,
        reasonCID: "ipfs://dispute",
        mockEventData: eventData(START_BLOCK + 11),
      }),
      CommitmentPoolingModule.DisputeResolved.createMockEvent({
        commitmentId: 32n,
        resolution: 0n,
        finalState: 5n,
        reasonCID: "ipfs://resolved",
        mockEventData: eventData(START_BLOCK + 12),
      }),
    ]);

    const commitment = await db.Commitment.get(`${CHAIN_ID}-32`);
    const claim = await db.CommitmentClaimRequest.get(`${CHAIN_ID}-32-${address(3).toLowerCase()}`);
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const cycle = await db.CommitmentCycle.get(`${CHAIN_ID}-9`);
    assert.ok(commitment);
    assert.equal(commitment.state, "FULFILLED");
    assert.equal(commitment.confirmationCount, 2);
    assert.equal(commitment.confirmationThreshold, 3);
    assert.equal(claim?.state, "ACCEPTED");
    for (const aggregate of [pool, cycle]) {
      assert.equal(aggregate?.commitmentsAccepted, 1n);
      assert.equal(aggregate?.commitmentsReadyForConfirmation, 1n);
      assert.equal(aggregate?.commitmentsFulfilled, 1n);
      assert.equal(aggregate?.commitmentsDisputed, 1n);
    }
  });

  it("keeps a newer confirmer rule when an older buffered confirmation drains", async () => {
    let db = createTestIndexer();
    db = await processEvents(db, [
      CommitmentPoolingModule.ConfirmationRecorded.createMockEvent({
        commitmentId: 35n,
        confirmer: address(7),
        confirmationCount: 1n,
        threshold: 1n,
        mockEventData: eventData(START_BLOCK + 5),
      }),
      CommitmentPoolingModule.ConfirmerRuleSet.createMockEvent({
        commitmentId: 35n,
        confirmers: [address(4), address(5), address(6)],
        threshold: 3n,
        protocolFallbackEnabled: false,
        mockEventData: eventData(START_BLOCK + 6),
      }),
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(35n, START_BLOCK + 2),
    ]);

    const commitment = await db.Commitment.get(`${CHAIN_ID}-35`);
    assert.equal(commitment?.confirmationCount, 1);
    assert.equal(commitment?.confirmationThreshold, 3);
    assert.deepEqual(
      commitment?.confirmers,
      sortedUnique([address(4), address(5), address(6)].map((value) => value.toLowerCase()))
    );
  });

  it("preserves newer claim payloads and terminal claim sweeps under reverse delivery", async () => {
    let db = await processEvents(createTestIndexer(), [
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(36n, START_BLOCK + 2, 1n),
    ]);
    const olderRequest = CommitmentPoolingModule.ClaimRequested.createMockEvent({
      commitmentId: 36n,
      claimant: address(3),
      requestedBy: address(3),
      kind: 1n,
      gardenContext: address(4),
      requestedAt: 100n,
      mockEventData: eventData(START_BLOCK + 3),
    });
    const decline = CommitmentPoolingModule.ClaimDeclined.createMockEvent({
      commitmentId: 36n,
      claimant: address(3),
      reasonCID: "ipfs://declined",
      mockEventData: eventData(START_BLOCK + 4),
    });
    const newerRequest = CommitmentPoolingModule.ClaimRequested.createMockEvent({
      commitmentId: 36n,
      claimant: address(3),
      requestedBy: address(5),
      kind: 0n,
      gardenContext: address(6),
      requestedAt: 200n,
      mockEventData: eventData(START_BLOCK + 5),
    });
    db = await CommitmentPoolingModule.ClaimDeclined.processEvent({ event: decline, mockDb: db });
    db = await CommitmentPoolingModule.ClaimRequested.processEvent({
      event: newerRequest,
      mockDb: db,
    });
    await handleClaimEvent(
      runtimeEvent(olderRequest, "ClaimRequested"),
      db as unknown as PoolingContext
    );
    let claim = await db.CommitmentClaimRequest.get(`${CHAIN_ID}-36-${address(3).toLowerCase()}`);
    assert.equal(claim?.state, "PENDING");
    assert.equal(claim?.requestedBy, address(5).toLowerCase());
    assert.equal(claim?.claimType, "GARDEN");
    assert.equal(claim?.gardenContext, address(6).toLowerCase());
    assert.equal(claim?.requestedAt, 200);

    const disputed = CommitmentPoolingModule.CommitmentDisputed.createMockEvent({
      commitmentId: 36n,
      raiser: address(4),
      previousState: 2n,
      reasonCID: "ipfs://dispute",
      mockEventData: eventData(START_BLOCK + 7),
    });
    const expired = CommitmentPoolingModule.CommitmentExpired.createMockEvent({
      commitmentId: 36n,
      mockEventData: eventData(START_BLOCK + 6),
    });
    const lateRequest = CommitmentPoolingModule.ClaimRequested.createMockEvent({
      commitmentId: 36n,
      claimant: address(8),
      requestedBy: address(8),
      kind: 1n,
      gardenContext: address(9),
      requestedAt: 150n,
      mockEventData: eventData(START_BLOCK + 5, 1),
    });
    db = await CommitmentPoolingModule.CommitmentDisputed.processEvent({
      event: disputed,
      mockDb: db,
    });
    await handleLifecycle(
      runtimeEvent(expired, "CommitmentExpired"),
      db as unknown as PoolingContext
    );
    await handleClaimEvent(
      runtimeEvent(lateRequest, "ClaimRequested"),
      db as unknown as PoolingContext
    );
    claim = await db.CommitmentClaimRequest.get(`${CHAIN_ID}-36-${address(3).toLowerCase()}`);
    const lateClaim = await db.CommitmentClaimRequest.get(
      `${CHAIN_ID}-36-${address(8).toLowerCase()}`
    );
    assert.equal((await db.Commitment.get(`${CHAIN_ID}-36`))?.state, "DISPUTED");
    assert.equal(claim?.state, "SUPERSEDED");
    assert.equal(claim?.resolutionCode, "COMMITMENT_EXPIRED");
    assert.equal(lateClaim?.state, "SUPERSEDED");
    assert.equal(lateClaim?.resolutionCode, "COMMITMENT_EXPIRED");
  });

  it("applies every signed unit delta and refreshes ownership on a winning relink", async () => {
    let db = await processEvents(createTestIndexer(), [
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(37n, START_BLOCK + 2),
      commitmentCreated(38n, START_BLOCK + 3),
    ]);
    const workUID = hash(80);
    const reversed = CommitmentPoolingModule.ApprovedWorkReversed.createMockEvent({
      commitmentId: 37n,
      workUID,
      contributor: address(4),
      decisionUID: hash(81),
      decisionSequence: 2n,
      requirementIndex: 0n,
      approvedWorkCount: 0n,
      approvedUnits: 0n,
      removedApprovedUnits: 1n,
      mockEventData: eventData(START_BLOCK + 6),
    });
    const counted = CommitmentPoolingModule.ApprovedWorkCounted.createMockEvent({
      commitmentId: 37n,
      workUID,
      contributor: address(4),
      approvalUID: hash(82),
      decisionSequence: 1n,
      requirementIndex: 0n,
      approvedWorkCount: 1n,
      approvedUnits: 1n,
      newlyApprovedUnits: 1n,
      mockEventData: eventData(START_BLOCK + 5),
    });
    db = await CommitmentPoolingModule.ApprovedWorkReversed.processEvent({
      event: reversed,
      mockDb: db,
    });
    await handleWorkEvent(
      runtimeEvent(counted, "ApprovedWorkCounted"),
      db as unknown as PoolingContext
    );
    const summary = (await db.CommitmentUnitSummary.getAll()).find(
      (row) => row.scope === "POOL" && row.unitLabel === "hours"
    );
    assert.equal(summary?.approvedUnits, 0n);

    const linkedToFirst = CommitmentPoolingModule.WorkLinked.createMockEvent({
      commitmentId: 37n,
      workUID,
      contributor: address(4),
      requirementIndex: 0n,
      linker: address(4),
      operationKey: hash(83),
      mockEventData: eventData(START_BLOCK + 7),
    });
    const unlinkedFromFirst = CommitmentPoolingModule.WorkUnlinked.createMockEvent({
      commitmentId: 37n,
      workUID,
      unlinker: address(4),
      mockEventData: eventData(START_BLOCK + 8),
    });
    const linkedToSecond = CommitmentPoolingModule.WorkLinked.createMockEvent({
      commitmentId: 38n,
      workUID,
      contributor: address(5),
      requirementIndex: 0n,
      linker: address(5),
      operationKey: hash(84),
      mockEventData: eventData(START_BLOCK + 9),
    });
    db = await processEvents(db, [linkedToFirst, unlinkedFromFirst, linkedToSecond]);
    const attribution = await db.CommitmentWorkAttribution.get(`${CHAIN_ID}-${workUID}`);
    assert.equal(attribution?.commitmentId, 38n);
    assert.equal(attribution?.commitmentEntityId, `${CHAIN_ID}-38`);
    assert.equal(attribution?.contributor, address(5).toLowerCase());
    assert.equal(attribution?.linked, true);
  });

  it("merges pre-creation work facts and preserves newer unlink and removal state", async () => {
    let db = createTestIndexer();
    const counted = (workUID: string, blockNumber: number, snapshot: bigint) =>
      CommitmentPoolingModule.ApprovedWorkCounted.createMockEvent({
        commitmentId: 33n,
        workUID,
        contributor: address(Number(snapshot) + 3),
        approvalUID: hash(blockNumber + 100),
        decisionSequence: 1n,
        requirementIndex: 0n,
        approvedWorkCount: snapshot,
        approvedUnits: snapshot,
        newlyApprovedUnits: 1n,
        mockEventData: eventData(blockNumber),
      });
    db = await processEvents(db, [
      counted(hash(71), START_BLOCK + 5, 2n),
      counted(hash(72), START_BLOCK + 4, 1n),
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(33n, START_BLOCK + 2),
      CommitmentPoolingModule.WorkUnlinked.createMockEvent({
        commitmentId: 33n,
        workUID: hash(73),
        unlinker: address(6),
        mockEventData: eventData(START_BLOCK + 9),
      }),
      CommitmentPoolingModule.WorkLinked.createMockEvent({
        commitmentId: 33n,
        workUID: hash(73),
        contributor: address(6),
        requirementIndex: 0n,
        linker: address(6),
        operationKey: hash(74),
        mockEventData: eventData(START_BLOCK + 8),
      }),
      CommitmentPoolingModule.ContributorRemoved.createMockEvent({
        commitmentId: 33n,
        contributor: address(7),
        removedBy: address(2),
        mockEventData: eventData(START_BLOCK + 11),
      }),
      CommitmentPoolingModule.ContributorAdded.createMockEvent({
        commitmentId: 33n,
        contributor: address(7),
        addedBy: address(2),
        mockEventData: eventData(START_BLOCK + 10),
      }),
      CommitmentPoolingModule.ContributorRequirementAssigned.createMockEvent({
        commitmentId: 33n,
        contributor: address(7),
        requirementIndex: 10n,
        assigned: true,
        mockEventData: eventData(START_BLOCK + 12),
      }),
      CommitmentPoolingModule.ContributorRequirementAssigned.createMockEvent({
        commitmentId: 33n,
        contributor: address(7),
        requirementIndex: 2n,
        assigned: true,
        mockEventData: eventData(START_BLOCK + 13),
      }),
      CommitmentPoolingModule.EvidenceAttached.createMockEvent({
        commitmentId: 33n,
        cid: "0x6162",
        attacher: address(6),
        creditedContributors: [address(6)],
        mockEventData: eventData(START_BLOCK + 14),
      }),
      CommitmentPoolingModule.EvidenceAttached.createMockEvent({
        commitmentId: 33n,
        cid: "ab",
        attacher: address(6),
        creditedContributors: [address(6)],
        mockEventData: eventData(START_BLOCK + 15),
      }),
    ]);
    db = await processEvents(db, [
      CommitmentRegistry.ClassRegistered.createMockEvent({
        classId: 90n,
        poolId: 7n,
        cycleId: 0n,
        unitLabel: "0x6162",
        quota: 1n,
        mockEventData: eventData(START_BLOCK + 16),
      }),
      CommitmentRegistry.ClassRegistered.createMockEvent({
        classId: 91n,
        poolId: 7n,
        cycleId: 0n,
        unitLabel: "ab",
        quota: 1n,
        mockEventData: eventData(START_BLOCK + 17),
      }),
    ]);

    const commitment = await db.Commitment.get(`${CHAIN_ID}-33`);
    const requirement = await db.CommitmentRequirement.get(`${CHAIN_ID}-33-0`);
    const work = await db.CommitmentWorkAttribution.get(`${CHAIN_ID}-${hash(73)}`);
    const contributor = await db.CommitmentContributor.get(
      `${CHAIN_ID}-33-${address(7).toLowerCase()}`
    );
    const assignmentIndex = await db.CommitmentContributorRequirementIndex.get(`${CHAIN_ID}-33`);
    const evidence = await db.CommitmentEvidenceAttribution.getAll();
    const classes = await db.CommitmentClass.getAll();
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const approvedSummary = (await db.CommitmentUnitSummary.getAll()).find(
      (row) => row.scope === "POOL" && row.unitLabel === "hours"
    );
    assert.ok(commitment);
    assert.equal(commitment.approvedUnits, 2n);
    assert.equal(requirement?.creationSeen, true);
    assert.equal(requirement?.approvedCount, 2);
    assert.equal(requirement?.requiredCount, 2);
    assert.equal(pool?.workApprovedCount, 2n);
    assert.equal(approvedSummary?.approvedUnits, 2n);
    assert.equal(work?.linkSeen, true);
    assert.equal(work?.linked, false);
    assert.equal(work?.contributor, address(6).toLowerCase());
    assert.equal(contributor?.additionSeen, true);
    assert.equal(contributor?.active, false);
    assert.deepEqual(contributor?.requirementIndexes, [2, 10]);
    assert.deepEqual(
      assignmentIndex?.assignmentEntityIds.map((id) => Number(id.split("-").at(-1))),
      [2, 10]
    );
    assert.equal(evidence.length, 2);
    assert.notEqual(
      classes.find((row) => row.unitLabel === "0x6162")?.unitLabelHash,
      classes.find((row) => row.unitLabel === "ab")?.unitLabelHash
    );
  });

  it("reverses transient fulfilled-member history when the frozen roster converges", async () => {
    let db = await processEvents(createTestIndexer(), [
      poolRegistered(START_BLOCK),
      cycleSeeded(START_BLOCK + 1),
      commitmentCreated(34n, START_BLOCK + 2),
      accepted(34n, START_BLOCK + 3),
      CommitmentPoolingModule.CommitmentFulfilled.createMockEvent({
        commitmentId: 34n,
        confirmer: address(3),
        confirmationPath: 0n,
        reason: "",
        mockEventData: eventData(START_BLOCK + 6),
      }),
      CommitmentPoolingModule.ContributorRosterFrozen.createMockEvent({
        commitmentId: 34n,
        contributorCount: 1n,
        mockEventData: eventData(START_BLOCK + 5),
      }),
      CommitmentPoolingModule.ContributorAdded.createMockEvent({
        commitmentId: 34n,
        contributor: address(5),
        addedBy: address(2),
        mockEventData: eventData(START_BLOCK + 7),
      }),
      CommitmentPoolingModule.ContributorRemoved.createMockEvent({
        commitmentId: 34n,
        contributor: address(5),
        removedBy: address(2),
        mockEventData: eventData(START_BLOCK + 9),
      }),
      CommitmentPoolingModule.ContributorAdded.createMockEvent({
        commitmentId: 34n,
        contributor: address(4),
        addedBy: address(2),
        mockEventData: eventData(START_BLOCK + 8),
      }),
    ]);

    const commitment = await db.Commitment.get(`${CHAIN_ID}-34`);
    const transient = await db.PoolMemberHistory.get(`${CHAIN_ID}-7-${address(5).toLowerCase()}`);
    const final = await db.PoolMemberHistory.get(`${CHAIN_ID}-7-${address(4).toLowerCase()}`);
    const receiver = await db.PoolMemberHistory.get(`${CHAIN_ID}-7-${address(3).toLowerCase()}`);
    assert.deepEqual(commitment?.fulfilledContributorHistoryAccounts, [address(4).toLowerCase()]);
    assert.equal(transient?.contributorFulfilled, 0);
    assert.equal(final?.contributorFulfilled, 1);
    assert.equal(receiver?.receivedFulfilled, 1);
  });
});
