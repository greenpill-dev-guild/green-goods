import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, ActionRegistry } = TestHelpers;

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

async function seedAction(mockDb: any, actionUID: bigint = 100n) {
  const event = ActionRegistry.ActionRegistered.createMockEvent({
    owner: addr(1),
    actionUID,
    startTime: 1000n,
    endTime: 2000n,
    title: "Test Action",
    slug: "waste.cleanup",
    instructions: "Do the work",
    capitals: [0, 2, 5],
    media: ["ipfs://media-1"],
    domain: 3,
    mockEventData: mockEvent(CHAIN_ID, 1000),
  });

  return ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
}

// ============================================================================
// ACTION REGISTERED
// ============================================================================

describe("ActionRegistry.ActionRegistered", () => {
  it("creates action entity with all fields", async () => {
    const mockDb = await seedAction(MockDb.createMockDb());
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.equal(action.id, `${CHAIN_ID}-100`);
    assert.equal(action.chainId, CHAIN_ID);
    assert.equal(action.ownerAddress, addr(1));
    assert.equal(action.startTime, 1000n);
    assert.equal(action.endTime, 2000n);
    assert.equal(action.title, "Test Action");
    assert.equal(action.slug, "waste.cleanup");
    assert.equal(action.instructions, "Do the work");
    assert.equal(action.domain, "WASTE");
    assert.equal(action.createdAt, 1000);
    assert.deepEqual(action.media, ["ipfs://media-1"]);
  });

  it("maps capital types correctly", async () => {
    const mockDb = await seedAction(MockDb.createMockDb());
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.deepEqual(action.capitals, ["SOCIAL", "FINANCIAL", "EXPERIENTIAL"]);
  });

  it("maps all domain types", async () => {
    const domains = [
      { value: 0, expected: "SOLAR" },
      { value: 1, expected: "AGRO" },
      { value: 2, expected: "EDU" },
      { value: 3, expected: "WASTE" },
    ];

    for (const { value, expected } of domains) {
      const mockDb = MockDb.createMockDb();
      const event = ActionRegistry.ActionRegistered.createMockEvent({
        owner: addr(1),
        actionUID: BigInt(value + 200),
        startTime: 1000n,
        endTime: 2000n,
        title: `Domain ${expected}`,
        slug: "test",
        instructions: "",
        capitals: [],
        media: [],
        domain: value,
        mockEventData: mockEvent(CHAIN_ID, 1000),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
      const action = result.entities.Action.get(`${CHAIN_ID}-${value + 200}`);
      assert.ok(action, `Action for domain ${expected} should exist`);
      assert.equal(action.domain, expected);
    }
  });

  it("uses chainId in action ID for cross-chain uniqueness", async () => {
    let mockDb = MockDb.createMockDb();

    // Same actionUID on different chains
    const event1 = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(1),
      actionUID: 42n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Chain 1",
      slug: "test",
      instructions: "",
      capitals: [],
      media: [],
      domain: 0,
      mockEventData: mockEvent(42161, 1000),
    });

    const event2 = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(1),
      actionUID: 42n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Chain 2",
      slug: "test",
      instructions: "",
      capitals: [],
      media: [],
      domain: 0,
      mockEventData: mockEvent(11155111, 1000),
    });

    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: event1, mockDb });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: event2, mockDb });

    const action1 = mockDb.entities.Action.get("42161-42");
    const action2 = mockDb.entities.Action.get("11155111-42");

    assert.ok(action1);
    assert.ok(action2);
    assert.equal(action1.title, "Chain 1");
    assert.equal(action2.title, "Chain 2");
  });
});

// ============================================================================
// ACTION UPDATE HANDLERS
// ============================================================================

describe("ActionRegistry.ActionStartTimeUpdated", () => {
  it("updates start time on existing action", async () => {
    let mockDb = await seedAction(MockDb.createMockDb());

    const event = ActionRegistry.ActionStartTimeUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 100n,
      startTime: 5000n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await ActionRegistry.ActionStartTimeUpdated.processEvent({ event, mockDb });
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.equal(action.startTime, 5000n);
    // Other fields preserved
    assert.equal(action.title, "Test Action");
  });

  it("does nothing when action not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionStartTimeUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 999n,
      startTime: 5000n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    const result = await ActionRegistry.ActionStartTimeUpdated.processEvent({ event, mockDb });
    const action = result.entities.Action.get(`${CHAIN_ID}-999`);
    assert.equal(action, undefined);
  });
});

describe("ActionRegistry.ActionEndTimeUpdated", () => {
  it("updates end time on existing action", async () => {
    let mockDb = await seedAction(MockDb.createMockDb());

    const event = ActionRegistry.ActionEndTimeUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 100n,
      endTime: 9000n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await ActionRegistry.ActionEndTimeUpdated.processEvent({ event, mockDb });
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.equal(action.endTime, 9000n);
  });

  it("does nothing when action not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionEndTimeUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 999n,
      endTime: 9000n,
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    const result = await ActionRegistry.ActionEndTimeUpdated.processEvent({ event, mockDb });
    assert.equal(result.entities.Action.get(`${CHAIN_ID}-999`), undefined);
  });
});

describe("ActionRegistry.ActionTitleUpdated", () => {
  it("updates title on existing action", async () => {
    let mockDb = await seedAction(MockDb.createMockDb());

    const event = ActionRegistry.ActionTitleUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 100n,
      title: "New Title",
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await ActionRegistry.ActionTitleUpdated.processEvent({ event, mockDb });
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.equal(action.title, "New Title");
    assert.equal(action.instructions, "Do the work"); // preserved
  });

  it("does nothing when action not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionTitleUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 999n,
      title: "No-op",
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    const result = await ActionRegistry.ActionTitleUpdated.processEvent({ event, mockDb });
    assert.equal(result.entities.Action.get(`${CHAIN_ID}-999`), undefined);
  });
});

describe("ActionRegistry.ActionInstructionsUpdated", () => {
  it("updates instructions on existing action", async () => {
    let mockDb = await seedAction(MockDb.createMockDb());

    const event = ActionRegistry.ActionInstructionsUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 100n,
      instructions: "New instructions here",
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await ActionRegistry.ActionInstructionsUpdated.processEvent({ event, mockDb });
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.equal(action.instructions, "New instructions here");
  });

  it("does nothing when action not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionInstructionsUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 999n,
      instructions: "No-op",
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    const result = await ActionRegistry.ActionInstructionsUpdated.processEvent({ event, mockDb });
    assert.equal(result.entities.Action.get(`${CHAIN_ID}-999`), undefined);
  });
});

describe("ActionRegistry.ActionMediaUpdated", () => {
  it("updates media on existing action", async () => {
    let mockDb = await seedAction(MockDb.createMockDb());

    const event = ActionRegistry.ActionMediaUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 100n,
      media: ["ipfs://new-media-1", "ipfs://new-media-2"],
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    mockDb = await ActionRegistry.ActionMediaUpdated.processEvent({ event, mockDb });
    const action = mockDb.entities.Action.get(`${CHAIN_ID}-100`);

    assert.ok(action);
    assert.deepEqual(action.media, ["ipfs://new-media-1", "ipfs://new-media-2"]);
  });

  it("does nothing when action not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionMediaUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 999n,
      media: ["ipfs://no-op"],
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    const result = await ActionRegistry.ActionMediaUpdated.processEvent({ event, mockDb });
    assert.equal(result.entities.Action.get(`${CHAIN_ID}-999`), undefined);
  });
});

// ============================================================================
// GARDEN DOMAINS
// ============================================================================

describe("ActionRegistry.GardenDomainsUpdated", () => {
  it("creates GardenDomains entity with expanded bitmask", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(5);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x0f, // All 4 domains
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const domains = result.entities.GardenDomains.get(
      `${CHAIN_ID}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(domains);
    assert.equal(domains.domainMask, 0x0f);
    assert.deepEqual(domains.domains, ["SOLAR", "AGRO", "EDU", "WASTE"]);
    assert.equal(domains.garden, gardenAddress.toLowerCase());
    assert.equal(domains.updatedAt, 1000);
  });

  it("stores single domain bitmask", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(5);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x04, // EDU only
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const domains = result.entities.GardenDomains.get(
      `${CHAIN_ID}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(domains);
    assert.equal(domains.domainMask, 0x04);
    assert.deepEqual(domains.domains, ["EDU"]);
  });

  it("overwrites previous GardenDomains on re-update", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(5);

    const event1 = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x0f,
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });
    mockDb = await ActionRegistry.GardenDomainsUpdated.processEvent({ event: event1, mockDb });

    const event2 = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x01, // Only SOLAR
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });
    mockDb = await ActionRegistry.GardenDomainsUpdated.processEvent({ event: event2, mockDb });

    const domains = mockDb.entities.GardenDomains.get(
      `${CHAIN_ID}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(domains);
    assert.equal(domains.domainMask, 0x01);
    assert.deepEqual(domains.domains, ["SOLAR"]);
    assert.equal(domains.updatedAt, 2000);
  });
});
