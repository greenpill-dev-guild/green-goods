import assert from "assert";
import {
  Addresses,
  CommitmentPoolingModule,
  createTestIndexer,
  HypercertMinter,
  processEvents,
  serveJson,
} from "./v3";

const CHAIN_ID = 42161;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function addr(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString().padStart(40, "0")}`;
}

function txHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function mockEvent(
  chainId: number,
  timestamp: number,
  opts: { srcAddress?: string; txHash?: string; logIndex?: number; blockNumber?: number } = {}
) {
  return {
    chainId,
    block: { timestamp, number: opts.blockNumber ?? 0 },
    srcAddress: opts.srcAddress ?? addr(99),
    transaction: { hash: opts.txHash ?? txHash(timestamp) },
    logIndex: opts.logIndex ?? 0,
  };
}

// ============================================================================
// TRANSFER SINGLE (MINTS)
// ============================================================================

describe("HypercertMinter.TransferSingle — mints", () => {
  it("creates new hypercert on first mint (from zero address)", async () => {
    const mockDb = createTestIndexer();
    const tx = txHash(100);

    const event = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
    });

    const result = await HypercertMinter.TransferSingle.processEvent({ event, mockDb });
    const hc = await result.Hypercert.get(`${CHAIN_ID}-42`);

    assert.ok(hc);
    assert.equal(hc.tokenId, 42n);
    assert.equal(hc.totalUnits, 1000n);
    assert.equal(hc.mintedBy, addr(1));
    assert.equal(hc.txHash, tx);
    assert.equal(hc.mintedAt, 5000);
    assert.equal(hc.status, "ACTIVE");
    assert.equal(hc.claimedUnits, 0n);
  });

  it("ignores non-mint transfers (from != zero address)", async () => {
    const mockDb = createTestIndexer();

    const event = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: addr(2), // Non-zero: this is a transfer, not a mint
      to: addr(3),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: txHash(100), logIndex: 1 }),
    });

    const result = await HypercertMinter.TransferSingle.processEvent({ event, mockDb });
    const hc = await result.Hypercert.get(`${CHAIN_ID}-42`);

    assert.equal(hc, undefined);
  });

  it("updates existing hypercert with mint details when mintedBy is empty", async () => {
    // Simulate ClaimStored event arriving first (creates hypercert without mintedBy)
    const metadataServer = await serveJson({});

    try {
      let mockDb = createTestIndexer();
      const tx1 = txHash(100);
      const tx2 = txHash(200);

      // ClaimStored first
      const claimStored = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 42n,
        uri: metadataServer.url,
        totalUnits: 1000n,
        mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: tx1, logIndex: 1 }),
      });
      mockDb = await HypercertMinter.ClaimStored.processEvent({ event: claimStored, mockDb });

      // TransferSingle mint
      const transferEvent = HypercertMinter.TransferSingle.createMockEvent({
        operator: addr(1),
        from: ZERO_ADDRESS,
        to: addr(2),
        id: 42n,
        value: 1000n,
        mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx2, logIndex: 1 }),
      });
      mockDb = await HypercertMinter.TransferSingle.processEvent({ event: transferEvent, mockDb });

      const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
      assert.ok(hc);
      assert.equal(hc.mintedBy, addr(1));
      assert.equal(hc.txHash, tx2);
      assert.equal(hc.totalUnits, 1000n);
    } finally {
      await metadataServer.close();
    }
  });

  it("is idempotent: skips same txHash replay", async () => {
    let mockDb = createTestIndexer();
    const tx = txHash(100);

    const event = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
    });

    mockDb = await HypercertMinter.TransferSingle.processEvent({ event, mockDb });

    // Process same event again
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event, mockDb });

    const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
    assert.ok(hc);
    // Should still have original values (not double-counted)
    assert.equal(hc.totalUnits, 1000n);
  });
});

// ============================================================================
// TRANSFER SINGLE (SUBSEQUENT CLAIMS)
// ============================================================================

describe("HypercertMinter.TransferSingle — claims", () => {
  it("treats subsequent mints as claims and updates claimedUnits", async () => {
    let mockDb = createTestIndexer();
    const tx1 = txHash(100);
    const tx2 = txHash(200);

    // First mint
    const mint = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: mint, mockDb });

    // Subsequent mint (claim)
    const claim = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(3),
      id: 42n,
      value: 300n,
      mockEventData: mockEvent(CHAIN_ID, 6000, { txHash: tx2, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: claim, mockDb });

    const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
    assert.ok(hc);
    assert.equal(hc.claimedUnits, 300n);

    // Verify HypercertClaim entity
    const claimEntity = await mockDb.HypercertClaim.get(`${CHAIN_ID}-42-${addr(3)}`);
    assert.ok(claimEntity);
    assert.equal(claimEntity.claimant, addr(3));
    assert.equal(claimEntity.units, 300n);
  });

  it("transitions status to CLAIMED when fully claimed", async () => {
    let mockDb = createTestIndexer();
    const tx1 = txHash(100);
    const tx2 = txHash(200);

    // Mint with 1000 units
    const mint = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: mint, mockDb });

    // Claim all 1000 units
    const claim = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(3),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 6000, { txHash: tx2, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: claim, mockDb });

    const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
    assert.ok(hc);
    assert.equal(hc.status, "CLAIMED");
    assert.equal(hc.claimedUnits, 1000n);
  });

  it("stays ACTIVE when partially claimed", async () => {
    let mockDb = createTestIndexer();
    const tx1 = txHash(100);
    const tx2 = txHash(200);

    const mint = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: mint, mockDb });

    const claim = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(3),
      id: 42n,
      value: 500n,
      mockEventData: mockEvent(CHAIN_ID, 6000, { txHash: tx2, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: claim, mockDb });

    const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
    assert.ok(hc);
    assert.equal(hc.status, "ACTIVE");
    assert.equal(hc.claimedUnits, 500n);
  });

  it("claim is idempotent: skips duplicate claim IDs", async () => {
    let mockDb = createTestIndexer();
    const tx1 = txHash(100);
    const tx2 = txHash(200);

    const mint = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(2),
      id: 42n,
      value: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: mint, mockDb });

    // First claim
    const claim1 = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(3),
      id: 42n,
      value: 300n,
      mockEventData: mockEvent(CHAIN_ID, 6000, { txHash: tx2, logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: claim1, mockDb });

    // Same claim again (same claimant)
    const claim2 = HypercertMinter.TransferSingle.createMockEvent({
      operator: addr(1),
      from: ZERO_ADDRESS,
      to: addr(3),
      id: 42n,
      value: 300n,
      mockEventData: mockEvent(CHAIN_ID, 7000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await HypercertMinter.TransferSingle.processEvent({ event: claim2, mockDb });

    const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
    assert.ok(hc);
    // Should only count the first claim
    assert.equal(hc.claimedUnits, 300n);
  });
});

// ============================================================================
// CLAIM STORED
// ============================================================================

describe("HypercertMinter.ClaimStored", () => {
  it("creates new hypercert with metadata from URI", async () => {
    const metadataServer = await serveJson({
      name: "Test Hypercert",
      description: "A test",
      image: "ipfs://bafk-image",
      hidden_properties: {
        gardenId: "0xgarden-address",
        attestationRefs: [{ uid: "0xatt-1" }, { uid: "0xatt-2" }],
      },
    });

    try {
      const mockDb = createTestIndexer();
      const tx = txHash(100);

      const event = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 42n,
        uri: metadataServer.url,
        totalUnits: 1000n,
        mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
      });

      const result = await HypercertMinter.ClaimStored.processEvent({ event, mockDb });
      const hc = await result.Hypercert.get(`${CHAIN_ID}-42`);

      assert.ok(hc);
      assert.equal(hc.metadataUri, metadataServer.url);
      assert.equal(hc.totalUnits, 1000n);
      assert.equal(hc.garden, "0xgarden-address");
      assert.equal(hc.attestationCount, 2);
      assert.deepEqual(hc.attestationUIDs, ["0xatt-1", "0xatt-2"]);
      assert.equal(hc.bundleKind, "WORK_LEGACY");
      assert.deepEqual(hc.commitmentIds, []);
    } finally {
      await metadataServer.close();
    }
  });

  it("indexes commitment bundles and certificate-scoped contributor units", async () => {
    const metadataServer = await serveJson({
      hidden_properties: {
        gardenId: addr(1),
        bundleKind: "COMMITMENT",
        commitmentIds: [11, "11"],
        needUIDs: [txHash(50), txHash(50)],
      },
    });
    try {
      let mockDb = createTestIndexer();
      const start = 433_713_812;
      const data = (offset: number, logIndex = 0) =>
        mockEvent(CHAIN_ID, start + offset, {
          blockNumber: start + offset,
          txHash: txHash(500 + offset),
          logIndex,
        });
      const events = [
        CommitmentPoolingModule.PoolRegistered.createMockEvent({
          poolId: 7n,
          garden: addr(1),
          poolType: 0n,
          mockEventData: data(0),
        }),
        CommitmentPoolingModule.CycleSeeded.createMockEvent({
          cycleId: 9n,
          poolId: 7n,
          cycleType: 0n,
          startTime: 1n,
          endTime: 2n,
          metadataCID: "ipfs://cycle",
          mockEventData: data(1),
        }),
        CommitmentPoolingModule.CycleOpened.createMockEvent({
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
          mockEventData: data(2),
        }),
        CommitmentPoolingModule.CommitmentCreated.createMockEvent({
          commitmentId: 11n,
          poolId: 7n,
          cycleId: 9n,
          commitmentSeriesId: 0n,
          creationRequestKey: txHash(1),
          creationPayloadHash: txHash(2),
          creator: addr(2),
          recordedBy: addr(2),
          direction: 0n,
          commitmentType: 0n,
          claimType: 1n,
          claimMode: 1n,
          contributorPolicy: 1n,
          domains: [1n],
          requirementActionUIDs: [10n],
          requirementDomains: [1n],
          requirementRequiredCounts: [1n],
          unitLabel: "hours",
          targetUnits: 1n,
          requiresAssessment: false,
          dueDate: 0n,
          metadataCID: "ipfs://commitment",
          needUID: txHash(50),
          counterCommitmentId: 0n,
          declaredUnitValue: 0n,
          declaredValueBasis: "",
          payerGarden: addr(1),
          mockEventData: data(3),
        }),
        CommitmentPoolingModule.CommitmentAccepted.createMockEvent({
          commitmentId: 11n,
          claimant: addr(3),
          counterparty: addr(3),
          kind: 1n,
          gardenContext: addr(3),
          leadProvider: addr(2),
          providerGarden: addr(1),
          payerGarden: addr(3),
          mockEventData: data(4),
        }),
        CommitmentPoolingModule.ContributorAdded.createMockEvent({
          commitmentId: 11n,
          contributor: addr(2),
          addedBy: addr(2),
          mockEventData: data(5),
        }),
        CommitmentPoolingModule.EvidenceAttached.createMockEvent({
          commitmentId: 11n,
          cid: "ipfs://evidence",
          attacher: addr(2),
          creditedContributors: [addr(2)],
          mockEventData: data(6),
        }),
        CommitmentPoolingModule.ContributorRosterFrozen.createMockEvent({
          commitmentId: 11n,
          contributorCount: 1n,
          mockEventData: data(7),
        }),
        CommitmentPoolingModule.CommitmentFulfilled.createMockEvent({
          commitmentId: 11n,
          confirmer: addr(3),
          confirmationPath: 0n,
          reason: "",
          mockEventData: data(8),
        }),
      ];
      mockDb = await processEvents(mockDb, events);
      const claimStored = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 42n,
        uri: metadataServer.url,
        totalUnits: 1000n,
        mockEventData: mockEvent(CHAIN_ID, start + 9, {
          blockNumber: start + 9,
          txHash: txHash(600),
          logIndex: 0,
        }),
      });
      mockDb = await HypercertMinter.ClaimStored.processEvent({ event: claimStored, mockDb });
      const hypercert = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
      const allocation = await mockDb.HypercertCommitmentContributorAllocation.get(
        `${CHAIN_ID}-42-11-${addr(2).toLowerCase()}`
      );
      assert.ok(hypercert);
      assert.ok(allocation);
      assert.equal(hypercert.bundleKind, "COMMITMENT");
      assert.deepEqual(hypercert.commitmentIds, [11n]);
      assert.deepEqual(hypercert.commitmentEntityIds, [`${CHAIN_ID}-11`]);
      assert.deepEqual(hypercert.needUIDs, [txHash(50)]);
      assert.equal(allocation.recognitionWeightBps, 10_000);
      assert.equal(allocation.commitmentGardenersClassUnits, 600n);
      assert.equal(allocation.recognitionUnits, 600n);
    } finally {
      await metadataServer.close();
    }
  });

  it("handles metadata fetch failure gracefully", async () => {
    const closedServer = await serveJson({});
    const unreachableUrl = closedServer.url;
    await closedServer.close();
    const mockDb = createTestIndexer();

    const event = HypercertMinter.ClaimStored.createMockEvent({
      claimID: 42n,
      uri: unreachableUrl,
      totalUnits: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: txHash(100), logIndex: 1 }),
    });

    const result = await HypercertMinter.ClaimStored.processEvent({ event, mockDb });
    const hc = await result.Hypercert.get(`${CHAIN_ID}-42`);

    assert.ok(hc);
    assert.equal(hc.metadataUri, unreachableUrl);
    assert.equal(hc.totalUnits, 1000n);
    // Metadata fields should be defaults since fetch failed
    assert.equal(hc.garden, "");
    assert.equal(hc.attestationCount, 0);
  });

  it("updates existing hypercert when TransferSingle arrives first", async () => {
    const metadataServer = await serveJson({
      hidden_properties: { gardenId: "0xgarden" },
    });

    try {
      let mockDb = createTestIndexer();
      const tx1 = txHash(100);
      const tx2 = txHash(200);

      // TransferSingle first
      const mint = HypercertMinter.TransferSingle.createMockEvent({
        operator: addr(1),
        from: ZERO_ADDRESS,
        to: addr(2),
        id: 42n,
        value: 1000n,
        mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
      });
      mockDb = await HypercertMinter.TransferSingle.processEvent({ event: mint, mockDb });

      // ClaimStored second
      const claimStored = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 42n,
        uri: metadataServer.url,
        totalUnits: 1000n,
        mockEventData: mockEvent(CHAIN_ID, 5001, { txHash: tx2, logIndex: 1 }),
      });
      mockDb = await HypercertMinter.ClaimStored.processEvent({ event: claimStored, mockDb });

      const hc = await mockDb.Hypercert.get(`${CHAIN_ID}-42`);
      assert.ok(hc);
      assert.equal(hc.mintedBy, addr(1));
      assert.equal(hc.metadataUri, metadataServer.url);
      assert.equal(hc.garden, "0xgarden");
    } finally {
      await metadataServer.close();
    }
  });

  it("handles non-OK HTTP response gracefully", async () => {
    const metadataServer = await serveJson({ error: "not found" }, 404);

    try {
      const mockDb = createTestIndexer();

      const event = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 42n,
        uri: metadataServer.url,
        totalUnits: 500n,
        mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: txHash(100), logIndex: 1 }),
      });

      const result = await HypercertMinter.ClaimStored.processEvent({ event, mockDb });
      const hc = await result.Hypercert.get(`${CHAIN_ID}-42`);

      assert.ok(hc);
      assert.equal(hc.metadataUri, metadataServer.url);
      assert.equal(hc.totalUnits, 500n);
      assert.equal(hc.garden, "");
    } finally {
      await metadataServer.close();
    }
  });
});
