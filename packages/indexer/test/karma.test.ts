import assert from "node:assert/strict";

import { getKarmaProjectAccessId, getKarmaSyncRecordId } from "../src/handlers/ids";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";
import {
  createTestIndexer,
  GardenAccount,
  GardenToken,
  HatsModule,
  indexedAddress,
  KarmaGAPModule,
  processEvents,
  WorkApprovalResolver,
} from "./v3";

const CHAIN_ID = CHAINS.arbitrum;
const PROJECT_UID = `0x${"11".repeat(32)}`;
const SOURCE_UID = `0x${"22".repeat(32)}`;
const RESULT_UID = `0x${"33".repeat(32)}`;

function seedGarden(mockDb: ReturnType<typeof createTestIndexer>, garden: string) {
  mockDb.Garden.set({
    id: garden,
    chainId: CHAIN_ID,
    tokenAddress: addr(1),
    tokenID: 1n,
    name: "Karma Garden",
    description: "",
    location: "",
    bannerImage: "",
    openJoining: false,
    initialized: true,
    gardeners: [],
    operators: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    createdAt: 1_000,
    gapProjectUID: undefined,
    karmaProjectState: "UNKNOWN",
    karmaProjectReason: undefined,
    karmaProjectUpdatedAt: undefined,
    karmaDetailsState: "UNKNOWN",
    karmaDetailsReason: undefined,
    karmaDetailsUpdatedAt: undefined,
    karmaMembershipState: "UNKNOWN",
    karmaMembershipReason: undefined,
    karmaMembershipUpdatedAt: undefined,
    karmaAccessState: "UNKNOWN",
    karmaAccessReason: undefined,
    karmaAccessUpdatedAt: undefined,
    karmaProjectUpdateState: "UNKNOWN",
    karmaProjectUpdateReason: undefined,
    karmaProjectUpdateUpdatedAt: undefined,
    karmaMembershipPendingAccounts: [],
    karmaMembershipFailedAccounts: [],
    karmaAccessPendingAccounts: [],
    karmaAccessFailedAccounts: [],
    karmaLastFailureReason: undefined,
    karmaLastSyncAt: undefined,
  });
  return mockDb;
}

describe("KarmaGAPModule event boundary", () => {
  it("is statically registered at the deployed Arbitrum proxy", () => {
    assert.equal(
      indexedAddress("KarmaGAPModule", CHAIN_ID).toLowerCase(),
      "0x0fc2be8d57595b16af0953cb2d711118f34563fe"
    );
    assert.throws(() => indexedAddress("KarmaGAPModule", CHAINS.sepolia));
  });

  it("projects GAPProjectCreated from the module and retains the compatibility UID", async () => {
    const garden = addr(10);
    const mockDb = seedGarden(createTestIndexer(), garden);
    const event = KarmaGAPModule.GAPProjectCreated.createMockEvent({
      projectUID: PROJECT_UID,
      garden,
      projectName: "Karma Garden",
      mockEventData: mockEvent(CHAIN_ID, 2_000),
    });

    const result = await KarmaGAPModule.GAPProjectCreated.processEvent({ event, mockDb });
    const projected = await result.Garden.get(garden);

    assert.ok(projected);
    assert.equal(projected.gapProjectUID, PROJECT_UID);
    assert.equal(projected.karmaProjectState, "SYNCED");
    assert.equal(projected.karmaProjectUpdatedAt, 2_000);
  });

  it("creates a placeholder Garden instead of dropping an early project event", async () => {
    const garden = addr(11);
    const mockDb = createTestIndexer();
    const event = KarmaGAPModule.GAPProjectCreated.createMockEvent({
      projectUID: PROJECT_UID,
      garden,
      projectName: "Early Garden",
      mockEventData: mockEvent(CHAIN_ID, 2_000),
    });

    const result = await KarmaGAPModule.GAPProjectCreated.processEvent({ event, mockDb });
    const projected = await result.Garden.get(garden);

    assert.ok(projected);
    assert.equal(projected.initialized, false);
    assert.equal(projected.gapProjectUID, PROJECT_UID);
  });

  it("retains an early project projection when GardenMinted arrives later", async () => {
    const garden = addr(12);
    const project = KarmaGAPModule.GAPProjectCreated.createMockEvent({
      projectUID: PROJECT_UID,
      garden,
      projectName: "Early Garden",
      mockEventData: mockEvent(CHAIN_ID, 2_000),
    });
    const minted = GardenToken.GardenMinted.createMockEvent({
      tokenId: 12n,
      account: garden,
      name: "Early Garden",
      description: "Mint completed",
      location: "Earth",
      bannerImage: "ipfs://garden",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 2_001),
    });

    const result = await processEvents(createTestIndexer(), [project, minted]);
    const projected = await result.Garden.get(garden);

    assert.ok(projected);
    assert.equal(projected.initialized, true);
    assert.equal(projected.gapProjectUID, PROJECT_UID);
    assert.equal(projected.karmaProjectState, "SYNCED");
  });
});

describe("KarmaGAPModule.KarmaSyncRecorded", () => {
  it("persists a chain-aware replay-safe record and updates only the matching aspect", async () => {
    const garden = addr(10);
    const account = addr(20);
    const hash = txHash(900);
    const mockDb = seedGarden(createTestIndexer(), garden);
    const event = KarmaGAPModule.KarmaSyncRecorded.createMockEvent({
      garden,
      projectUID: PROJECT_UID,
      account,
      operation: 1n,
      outcome: 2n,
      sourceUID: SOURCE_UID,
      resultUID: RESULT_UID,
      reason: "Details attestation failed",
      mockEventData: mockEvent(CHAIN_ID, 3_000, {
        txHash: hash,
        logIndex: 7,
        blockNumber: 433_713_900,
      }),
    });

    const result = await KarmaGAPModule.KarmaSyncRecorded.processEvent({ event, mockDb });
    const record = await result.KarmaSyncRecord.get(getKarmaSyncRecordId(CHAIN_ID, hash, 7));
    const projected = await result.Garden.get(garden);

    assert.ok(record);
    assert.equal(record.chainId, CHAIN_ID);
    assert.equal(record.garden, garden.toLowerCase());
    assert.equal(record.account, account.toLowerCase());
    assert.equal(record.operation, "DETAILS");
    assert.equal(record.outcome, "FAILED");
    assert.equal(record.sourceUID, SOURCE_UID);
    assert.equal(record.resultUID, RESULT_UID);
    assert.equal(record.txHash, hash);
    assert.equal(record.logIndex, 7);
    assert.equal(record.blockNumber, 433_713_900);

    assert.ok(projected);
    assert.equal(projected.karmaDetailsState, "FAILED");
    assert.equal(projected.karmaDetailsReason, "Details attestation failed");
    assert.equal(projected.karmaProjectState, "UNKNOWN");
    assert.equal(projected.karmaAccessState, "UNKNOWN");
  });

  it("keeps per-account membership and access outcomes independent", async () => {
    const garden = addr(10);
    const account = addr(20);
    let mockDb = seedGarden(createTestIndexer(), garden);
    const membership = KarmaGAPModule.KarmaSyncRecorded.createMockEvent({
      garden,
      projectUID: PROJECT_UID,
      account,
      operation: 2n,
      outcome: 1n,
      sourceUID: SOURCE_UID,
      resultUID: RESULT_UID,
      reason: "",
      mockEventData: mockEvent(CHAIN_ID, 3_000, { logIndex: 1 }),
    });
    const access = KarmaGAPModule.KarmaSyncRecorded.createMockEvent({
      garden,
      projectUID: PROJECT_UID,
      account,
      operation: 3n,
      outcome: 2n,
      sourceUID: SOURCE_UID,
      resultUID: RESULT_UID,
      reason: "ProjectResolver rejected admin sync",
      mockEventData: mockEvent(CHAIN_ID, 3_001, { logIndex: 2 }),
    });

    mockDb = await processEvents(mockDb, [membership, access]);
    const aggregate = await mockDb.KarmaProjectAccess.get(
      getKarmaProjectAccessId(CHAIN_ID, garden, account)
    );
    const projected = await mockDb.Garden.get(garden);

    assert.ok(aggregate);
    assert.equal(aggregate.membershipState, "SYNCED");
    assert.equal(aggregate.membershipOutcome, "SUCCEEDED");
    assert.equal(aggregate.accessState, "FAILED");
    assert.equal(aggregate.accessOutcome, "FAILED");
    assert.equal(aggregate.accessReason, "ProjectResolver rejected admin sync");

    assert.ok(projected);
    assert.equal(projected.karmaMembershipState, "SYNCED");
    assert.equal(projected.karmaAccessState, "FAILED");
    assert.deepEqual(projected.karmaMembershipFailedAccounts, []);
    assert.deepEqual(projected.karmaAccessFailedAccounts, [account.toLowerCase()]);
  });

  it("maps every locked operation and outcome ordinal", async () => {
    const expectedOperations = ["PROJECT", "DETAILS", "MEMBERSHIP", "ACCESS", "PROJECT_UPDATE"];
    const expectedOutcomes = ["NOOP", "SUCCEEDED", "FAILED"];

    for (let operation = 0; operation < expectedOperations.length; operation += 1) {
      for (let outcome = 0; outcome < expectedOutcomes.length; outcome += 1) {
        const garden = addr(10 + operation);
        const account = addr(20 + outcome);
        const hash = txHash(1_000 + operation * 10 + outcome);
        const mockDb = seedGarden(createTestIndexer(), garden);
        const event = KarmaGAPModule.KarmaSyncRecorded.createMockEvent({
          garden,
          projectUID: PROJECT_UID,
          account,
          operation: BigInt(operation),
          outcome: BigInt(outcome),
          sourceUID: SOURCE_UID,
          resultUID: RESULT_UID,
          reason: "",
          mockEventData: mockEvent(CHAIN_ID, 4_000, { txHash: hash, logIndex: outcome }),
        });

        const result = await KarmaGAPModule.KarmaSyncRecorded.processEvent({ event, mockDb });
        const record = await result.KarmaSyncRecord.get(
          getKarmaSyncRecordId(CHAIN_ID, hash, outcome)
        );

        assert.ok(record);
        assert.equal(record.operation, expectedOperations[operation]);
        assert.equal(record.outcome, expectedOutcomes[outcome]);
      }
    }
  });
});

describe("KarmaHookFailed fallback projections", () => {
  it("registers the WorkApprovalResolver observer at the deployed Arbitrum proxy", () => {
    assert.equal(
      indexedAddress("WorkApprovalResolver", CHAIN_ID).toLowerCase(),
      "0x166732ed81ab200a099215cf33f6a712309b69f7"
    );
    assert.throws(() => indexedAddress("WorkApprovalResolver", CHAINS.sepolia));
  });

  it("moves project, details, and project-update aspects to failed", async () => {
    const garden = addr(30);
    const account = addr(31);
    const projectFailure = GardenToken.KarmaHookFailed.createMockEvent({
      garden,
      account,
      operation: 0n,
      reason: "project hook reverted",
      mockEventData: mockEvent(CHAIN_ID, 5_000),
    });
    const detailsFailure = GardenAccount.KarmaHookFailed.createMockEvent({
      garden,
      account,
      operation: 1n,
      reason: "details hook reverted",
      mockEventData: mockEvent(CHAIN_ID, 5_001),
    });
    const updateFailure = WorkApprovalResolver.KarmaHookFailed.createMockEvent({
      garden,
      account,
      operation: 4n,
      reason: "project update hook reverted",
      mockEventData: mockEvent(CHAIN_ID, 5_002),
    });

    const result = await processEvents(seedGarden(createTestIndexer(), garden), [
      projectFailure,
      detailsFailure,
      updateFailure,
    ]);
    const projected = await result.Garden.get(garden);

    assert.ok(projected);
    assert.equal(projected.karmaProjectState, "FAILED");
    assert.equal(projected.karmaProjectReason, "project hook reverted");
    assert.equal(projected.karmaDetailsState, "FAILED");
    assert.equal(projected.karmaDetailsReason, "details hook reverted");
    assert.equal(projected.karmaProjectUpdateState, "FAILED");
    assert.equal(projected.karmaProjectUpdateReason, "project update hook reverted");
    assert.equal(projected.karmaLastFailureReason, "project update hook reverted");
  });

  it("marks both membership and access failed for an Access hook failure", async () => {
    const garden = addr(40);
    const account = addr(41);
    const mockDb = seedGarden(createTestIndexer(), garden);
    const failure = HatsModule.KarmaHookFailed.createMockEvent({
      garden,
      account,
      operation: 3n,
      reason: "role access hook reverted",
      mockEventData: mockEvent(CHAIN_ID, 6_000),
    });

    const result = await HatsModule.KarmaHookFailed.processEvent({ event: failure, mockDb });
    const projected = await result.Garden.get(garden);
    const aggregate = await result.KarmaProjectAccess.get(
      getKarmaProjectAccessId(CHAIN_ID, garden, account)
    );

    assert.ok(projected);
    assert.equal(projected.karmaMembershipState, "FAILED");
    assert.equal(projected.karmaAccessState, "FAILED");
    assert.deepEqual(projected.karmaMembershipPendingAccounts, []);
    assert.deepEqual(projected.karmaMembershipFailedAccounts, [account.toLowerCase()]);
    assert.deepEqual(projected.karmaAccessPendingAccounts, []);
    assert.deepEqual(projected.karmaAccessFailedAccounts, [account.toLowerCase()]);

    assert.ok(aggregate);
    assert.equal(aggregate.membershipState, "FAILED");
    assert.equal(aggregate.membershipOutcome, "FAILED");
    assert.equal(aggregate.accessState, "FAILED");
    assert.equal(aggregate.accessOutcome, "FAILED");
  });
});
