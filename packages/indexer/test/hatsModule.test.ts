import assert from "assert";
import { getKarmaProjectAccessId } from "../src/handlers/ids";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";
import { seedGarden } from "./helpers/garden";
import { assertRoleArrays } from "./helpers/projections";
import { createTestIndexer, HatsModule, processEvents } from "./v3";

const CHAIN_ID = CHAINS.arbitrum;

describe("Garden role event history", () => {
  it("records a role grant with normalized identity and its chain position", async () => {
    const garden = "0xaBcDEF0000000000000000000000000000000001";
    const account = "0xaBcDEF0000000000000000000000000000000002";
    const hash = txHash(901);
    const mockDb = seedGarden(createTestIndexer(), garden);
    const event = HatsModule.RoleGranted.createMockEvent({
      garden,
      account,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 2_000, {
        txHash: hash,
        logIndex: 7,
        blockNumber: 433_713_900,
      }),
    });

    const result = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const record = await result.GardenRoleEvent.get(`${CHAIN_ID}-${hash}-7`);
    assert.deepEqual(record, {
      id: `${CHAIN_ID}-${hash}-7`,
      chainId: CHAIN_ID,
      garden: garden.toLowerCase(),
      account: account.toLowerCase(),
      role: 2,
      action: "GRANTED",
      timestamp: 2_000,
      blockNumber: 433_713_900n,
      logIndex: 7,
      txHash: hash,
    });
  });

  it("retains a revoke even when the garden aggregate has not arrived", async () => {
    const garden = addr(10);
    const hash = txHash(902);
    const event = HatsModule.RoleRevoked.createMockEvent({
      garden,
      account: addr(20),
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3_000, { txHash: hash, logIndex: 4 }),
    });

    const result = await HatsModule.RoleRevoked.processEvent({
      event,
      mockDb: createTestIndexer(),
    });
    const record = await result.GardenRoleEvent.get(`${CHAIN_ID}-${hash}-4`);
    assert.ok(record);
    assert.equal(record.action, "REVOKED");
    assert.equal(record.timestamp, 3_000);
    assert.equal(record.garden, garden.toLowerCase());
    assert.equal(record.account, addr(20).toLowerCase());
    assert.equal(await result.Garden.get(garden), undefined);
  });

  it("preserves each role change within one transaction and separates chains", async () => {
    const hash = txHash(903);
    const events = [
      { chainId: CHAIN_ID, role: 0n, logIndex: 1 },
      { chainId: CHAIN_ID, role: 2n, logIndex: 2 },
      { chainId: CHAINS.sepolia, role: 0n, logIndex: 1 },
    ].map(({ chainId, role, logIndex }) =>
      HatsModule.RoleGranted.createMockEvent({
        garden: addr(10),
        account: addr(20),
        role,
        mockEventData: mockEvent(chainId, 2_000, { txHash: hash, logIndex }),
      })
    );

    const result = await processEvents(createTestIndexer(), events);
    for (const { chainId, logIndex } of events) {
      assert.ok(await result.GardenRoleEvent.get(`${chainId}-${hash}-${logIndex}`));
    }
    assert.equal((await result.GardenRoleEvent.get(`${CHAIN_ID}-${hash}-2`))?.role, 2);
  });

  it("keeps grant and revoke facts independently of delivery order and replay", async () => {
    const garden = addr(10);
    const grantHash = txHash(904);
    const revokeHash = txHash(905);
    const grant = HatsModule.RoleGranted.createMockEvent({
      garden,
      account: addr(20),
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2_000, { txHash: grantHash, logIndex: 1 }),
    });
    const revoke = HatsModule.RoleRevoked.createMockEvent({
      garden,
      account: addr(20),
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3_000, { txHash: revokeHash, logIndex: 1 }),
    });
    let result = await processEvents(createTestIndexer(), [revoke, grant]);
    const firstGrant = await result.GardenRoleEvent.get(`${CHAIN_ID}-${grantHash}-1`);
    const firstRevoke = await result.GardenRoleEvent.get(`${CHAIN_ID}-${revokeHash}-1`);
    assert.ok(firstGrant);
    assert.ok(firstRevoke);
    assert.equal(firstGrant.timestamp, 2_000);
    assert.equal(firstRevoke.timestamp, 3_000);

    result = await HatsModule.RoleGranted.processEvent({ event: grant, mockDb: result });
    const replay = await result.GardenRoleEvent.get(`${CHAIN_ID}-${grantHash}-1`);
    assert.ok(replay);
    assert.equal(replay.id, firstGrant.id);
    assert.equal(replay.timestamp, firstGrant.timestamp);
    assert.equal(
      (await result.GardenRoleEvent.get(`${CHAIN_ID}-${revokeHash}-1`))?.action,
      "REVOKED"
    );
    assert.equal((await result.GardenRoleEvent.getAll()).length, 2);
  });
});

// ============================================================================
// ROLE GRANT — ALL 6 ROLE TYPES
// ============================================================================

describe("HatsModule.RoleGranted", () => {
  it("grants Gardener role (role=0)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n, // Gardener
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assertRoleArrays(garden, {
      gardeners: [account.toLowerCase()],
      operators: [],
    });
  });

  it("grants Evaluator role (role=1)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 1n, // Evaluator
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.evaluators.includes(account.toLowerCase()));
  });

  it("grants Steward role and marks its Karma access reconciliation pending (role=2)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n, // Steward
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.operators.includes(account.toLowerCase()));
    assert.equal(garden.karmaMembershipState, "PENDING");
    assert.equal(garden.karmaAccessState, "PENDING");
    assert.deepEqual(garden.karmaMembershipPendingAccounts, [account.toLowerCase()]);
    assert.deepEqual(garden.karmaAccessPendingAccounts, [account.toLowerCase()]);

    const access = await mockDb.KarmaProjectAccess.get(
      getKarmaProjectAccessId(CHAIN_ID, addr(10), account)
    );
    assert.ok(access);
    assert.equal(access.membershipState, "PENDING");
    assert.equal(access.accessState, "PENDING");
  });

  it("grants Owner role (role=3)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 3n, // Owner
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.owners.includes(account.toLowerCase()));
    assert.deepEqual(garden.karmaAccessPendingAccounts, [account.toLowerCase()]);
  });

  it("grants Funder role (role=4)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 4n, // Funder
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.funders.includes(account.toLowerCase()));
  });

  it("grants Community role (role=5)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 5n, // Community
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.communities.includes(account.toLowerCase()));
  });

  it("does not add duplicate addresses to role arrays", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    // Grant same role again
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });

    mockDb = await processEvents(mockDb, [event1, event2]);
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.equal(garden.operators.length, 1);
  });

  it("creates default garden when garden not found", async () => {
    let mockDb = createTestIndexer();
    const gardenAddress = addr(10);
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: gardenAddress,
      account,
      role: 2n, // Steward
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.initialized, false);
    assert.ok(garden.operators.includes(account.toLowerCase()));
  });

  it("ignores unknown role numbers (no change)", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 99n, // Unknown role
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = await mockDb.Garden.get(addr(10));

    assert.ok(garden);
    assert.deepEqual(garden.gardeners, []);
    assert.deepEqual(garden.operators, []);
    assert.deepEqual(garden.evaluators, []);
    assert.deepEqual(garden.owners, []);
    assert.deepEqual(garden.funders, []);
    assert.deepEqual(garden.communities, []);
    assert.deepEqual(await mockDb.GardenRoleEvent.getAll(), []);
  });
});

// ============================================================================
// GARDENER ENTITY CREATION
// ============================================================================

describe("HatsModule.RoleGranted — Gardener entity", () => {
  it("creates a new Gardener entity on first garden join", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n, // Gardener
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const gardener = await mockDb.Gardener.get(gardenerId);

    assert.ok(gardener);
    assert.equal(gardener.chainId, CHAIN_ID);
    assert.equal(gardener.firstGarden, addr(10));
    assert.deepEqual(gardener.gardens, [addr(10)]);
    assert.equal(gardener.createdAt, 2000);
    assert.equal(gardener.owner, undefined);
    assert.equal(gardener.ensName, undefined);
  });

  it("adds second garden to existing Gardener", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    mockDb = seedGarden(mockDb, addr(11));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    // Grant gardener role for first garden
    const event1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    // Grant gardener role for second garden
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(11),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [event1, event2]);

    const gardener = await mockDb.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 2);
    assert.ok(gardener.gardens.includes(addr(10)));
    assert.ok(gardener.gardens.includes(addr(11)));
    assert.equal(gardener.firstGarden, addr(10));
  });

  it("does not duplicate garden in Gardener.gardens", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    // Grant again to same garden
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [event1, event2]);

    const gardener = await mockDb.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 1);
  });

  it("does not create Gardener entity for non-gardener roles", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n, // Steward (not Gardener)
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });

    const gardener = await mockDb.Gardener.get(gardenerId);
    assert.equal(gardener, undefined);
  });
});

// ============================================================================
// ROLE REVOKE
// ============================================================================

describe("HatsModule.RoleRevoked", () => {
  it("revokes Gardener role", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    // Grant first
    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    // Revoke
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grantEvent, revokeEvent]);

    const garden = await mockDb.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.gardeners.includes(account.toLowerCase()), false);
  });

  it("revokes Evaluator role", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 1n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 1n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grantEvent, revokeEvent]);

    const garden = await mockDb.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.evaluators.length, 0);
  });

  it("revokes Owner role", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 3n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 3n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grantEvent, revokeEvent]);

    const garden = await mockDb.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.owners.length, 0);
    assert.equal(garden.karmaMembershipState, "PENDING");
    assert.equal(garden.karmaAccessState, "PENDING");

    const access = await mockDb.KarmaProjectAccess.get(
      getKarmaProjectAccessId(CHAIN_ID, addr(10), account)
    );
    assert.ok(access);
    assert.equal(access.membershipState, "PENDING");
    assert.equal(access.accessState, "PENDING");
  });

  it("revokes Funder role", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 4n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 4n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grantEvent, revokeEvent]);

    const garden = await mockDb.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.funders.length, 0);
  });

  it("revokes Community role", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 5n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 5n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grantEvent, revokeEvent]);

    const garden = await mockDb.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.communities.length, 0);
  });

  it("does nothing when garden not found", async () => {
    let mockDb = createTestIndexer();

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account: addr(20),
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });

    // Should not throw
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });
    const garden = await mockDb.Garden.get(addr(10));
    assert.equal(garden, undefined);
  });

  it("removes garden from Gardener.gardens on gardener role revoke", async () => {
    let mockDb = seedGarden(createTestIndexer(), addr(10));
    mockDb = seedGarden(mockDb, addr(11));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    // Grant gardener role for two gardens
    const grant1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    const grant2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(11),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2500),
    });
    // Revoke from first garden
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await processEvents(mockDb, [grant1, grant2, revokeEvent]);

    const gardener = await mockDb.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 1);
    assert.ok(gardener.gardens.includes(addr(11)));
    assert.equal(gardener.gardens.includes(addr(10)), false);
  });
});
