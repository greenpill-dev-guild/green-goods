import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, HatsModule, GardenToken } = TestHelpers;

const CHAIN_ID = 42161;

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

function seedGarden(mockDb: any, gardenAddress: string) {
  return mockDb.entities.Garden.set({
    id: gardenAddress,
    chainId: CHAIN_ID,
    tokenAddress: addr(1),
    tokenID: 1n,
    name: "Test Garden",
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
    createdAt: 1000,
    gapProjectUID: undefined,
  });
}

// ============================================================================
// ROLE GRANT — ALL 6 ROLE TYPES
// ============================================================================

describe("HatsModule.RoleGranted", () => {
  it("grants Gardener role (role=0)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n, // Gardener
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.gardeners.includes(account.toLowerCase()));
    assert.deepEqual(garden.operators, []);
  });

  it("grants Evaluator role (role=1)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 1n, // Evaluator
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.evaluators.includes(account.toLowerCase()));
  });

  it("grants Operator role (role=2)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n, // Operator
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.operators.includes(account.toLowerCase()));
  });

  it("grants Owner role (role=3)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 3n, // Owner
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.owners.includes(account.toLowerCase()));
  });

  it("grants Funder role (role=4)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 4n, // Funder
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.funders.includes(account.toLowerCase()));
  });

  it("grants Community role (role=5)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 5n, // Community
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.ok(garden.communities.includes(account.toLowerCase()));
  });

  it("does not add duplicate addresses to role arrays", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event: event1, mockDb });

    // Grant same role again
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event: event2, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.equal(garden.operators.length, 1);
  });

  it("creates default garden when garden not found", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: gardenAddress,
      account,
      role: 2n, // Operator
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.initialized, false);
    assert.ok(garden.operators.includes(account.toLowerCase()));
  });

  it("ignores unknown role numbers (no change)", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 99n, // Unknown role
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));

    assert.ok(garden);
    assert.deepEqual(garden.gardeners, []);
    assert.deepEqual(garden.operators, []);
    assert.deepEqual(garden.evaluators, []);
    assert.deepEqual(garden.owners, []);
    assert.deepEqual(garden.funders, []);
    assert.deepEqual(garden.communities, []);
  });
});

// ============================================================================
// GARDENER ENTITY CREATION
// ============================================================================

describe("HatsModule.RoleGranted — Gardener entity", () => {
  it("creates a new Gardener entity on first garden join", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n, // Gardener
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    const gardener = mockDb.entities.Gardener.get(gardenerId);

    assert.ok(gardener);
    assert.equal(gardener.chainId, CHAIN_ID);
    assert.equal(gardener.firstGarden, addr(10));
    assert.deepEqual(gardener.gardens, [addr(10)]);
    assert.equal(gardener.createdAt, 2000);
    assert.equal(gardener.owner, undefined);
    assert.equal(gardener.ensName, undefined);
  });

  it("adds second garden to existing Gardener", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
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
    mockDb = await HatsModule.RoleGranted.processEvent({ event: event1, mockDb });

    // Grant gardener role for second garden
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(11),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: event2, mockDb });

    const gardener = mockDb.entities.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 2);
    assert.ok(gardener.gardens.includes(addr(10)));
    assert.ok(gardener.gardens.includes(addr(11)));
    assert.equal(gardener.firstGarden, addr(10));
  });

  it("does not duplicate garden in Gardener.gardens", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event1 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: event1, mockDb });

    // Grant again to same garden
    const event2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: event2, mockDb });

    const gardener = mockDb.entities.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 1);
  });

  it("does not create Gardener entity for non-gardener roles", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);
    const gardenerId = `${CHAIN_ID}-${account.toLowerCase()}`;

    const event = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 2n, // Operator (not Gardener)
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });

    const gardener = mockDb.entities.Gardener.get(gardenerId);
    assert.equal(gardener, undefined);
  });
});

// ============================================================================
// ROLE REVOKE
// ============================================================================

describe("HatsModule.RoleRevoked", () => {
  it("revokes Gardener role", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    // Grant first
    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });

    // Revoke
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const garden = mockDb.entities.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.gardeners.includes(account.toLowerCase()), false);
  });

  it("revokes Evaluator role", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 1n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 1n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const garden = mockDb.entities.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.evaluators.length, 0);
  });

  it("revokes Owner role", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 3n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 3n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const garden = mockDb.entities.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.owners.length, 0);
  });

  it("revokes Funder role", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 4n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 4n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const garden = mockDb.entities.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.funders.length, 0);
  });

  it("revokes Community role", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
    const account = addr(20);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: addr(10),
      account,
      role: 5n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 5n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const garden = mockDb.entities.Garden.get(addr(10));
    assert.ok(garden);
    assert.equal(garden.communities.length, 0);
  });

  it("does nothing when garden not found", async () => {
    let mockDb = MockDb.createMockDb();

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account: addr(20),
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });

    // Should not throw
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });
    const garden = mockDb.entities.Garden.get(addr(10));
    assert.equal(garden, undefined);
  });

  it("removes garden from Gardener.gardens on gardener role revoke", async () => {
    let mockDb = seedGarden(MockDb.createMockDb(), addr(10));
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
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grant1, mockDb });

    const grant2 = HatsModule.RoleGranted.createMockEvent({
      garden: addr(11),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2500),
    });
    mockDb = await HatsModule.RoleGranted.processEvent({ event: grant2, mockDb });

    // Revoke from first garden
    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: addr(10),
      account,
      role: 0n,
      mockEventData: mockEvent(CHAIN_ID, 3000),
    });
    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const gardener = mockDb.entities.Gardener.get(gardenerId);
    assert.ok(gardener);
    assert.equal(gardener.gardens.length, 1);
    assert.ok(gardener.gardens.includes(addr(11)));
    assert.equal(gardener.gardens.includes(addr(10)), false);
  });
});
