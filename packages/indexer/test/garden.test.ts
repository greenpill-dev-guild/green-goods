import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, GardenToken, GardenAccount } = TestHelpers;

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

// ============================================================================
// GARDEN TOKEN HANDLERS
// ============================================================================

describe("GardenToken.GardenMinted", () => {
  it("creates a new garden entity with all fields", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);
    const tokenContract = addr(11);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 42n,
      account: gardenAddress,
      name: "My Garden",
      description: "A community garden",
      location: "Berlin",
      bannerImage: "ipfs://bafk-banner",
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: tokenContract }),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.id, gardenAddress);
    assert.equal(garden.chainId, CHAIN_ID);
    assert.equal(garden.name, "My Garden");
    assert.equal(garden.description, "A community garden");
    assert.equal(garden.location, "Berlin");
    assert.equal(garden.bannerImage, "ipfs://bafk-banner");
    assert.equal(garden.openJoining, true);
    assert.equal(garden.initialized, true);
    assert.equal(garden.tokenAddress, tokenContract);
    assert.equal(garden.tokenID, 42n);
    assert.equal(garden.createdAt, 1000);
    assert.equal(garden.gapProjectUID, undefined);
  });

  it("initializes all role arrays as empty", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

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
// GARDEN ACCOUNT UPDATE HANDLERS
// ============================================================================

describe("GardenAccount.NameUpdated", () => {
  it("updates name on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    // Create garden first
    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Original",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Updated Name",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });
    const result = await GardenAccount.NameUpdated.processEvent({ event: updateEvent, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Updated Name");
    // Other fields should be preserved
    assert.equal(garden.initialized, true);
  });

  it("creates a default garden if not existing", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Default Garden",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.NameUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Default Garden");
    assert.equal(garden.initialized, false);
    assert.equal(garden.chainId, CHAIN_ID);
  });
});

describe("GardenAccount.DescriptionUpdated", () => {
  it("updates description on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "Old",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.DescriptionUpdated.createMockEvent({
      updater: addr(1),
      newDescription: "New description",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.DescriptionUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "New description");
  });

  it("creates default garden when missing", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenAccount.DescriptionUpdated.createMockEvent({
      updater: addr(1),
      newDescription: "Some description",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.DescriptionUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "Some description");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.LocationUpdated", () => {
  it("updates location on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "Old Location",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.LocationUpdated.createMockEvent({
      updater: addr(1),
      newLocation: "New York",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.LocationUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.location, "New York");
  });

  it("creates default garden when missing", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenAccount.LocationUpdated.createMockEvent({
      updater: addr(1),
      newLocation: "Mars",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.LocationUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.location, "Mars");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.BannerImageUpdated", () => {
  it("updates banner image on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "ipfs://old",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.BannerImageUpdated.createMockEvent({
      updater: addr(1),
      newBannerImage: "ipfs://new",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.BannerImageUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.bannerImage, "ipfs://new");
  });

  it("creates default garden when missing", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenAccount.BannerImageUpdated.createMockEvent({
      updater: addr(1),
      newBannerImage: "ipfs://banner",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.BannerImageUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.bannerImage, "ipfs://banner");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.GAPProjectCreated", () => {
  it("sets gapProjectUID on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const gapEvent = GardenAccount.GAPProjectCreated.createMockEvent({
      projectUID: "0xproject-uid-123",
      gardenAddress: gardenAddress,
      projectName: "Garden GAP",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.GAPProjectCreated.processEvent({
      event: gapEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.gapProjectUID, "0xproject-uid-123");
  });

  it("does nothing when garden not found", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const gapEvent = GardenAccount.GAPProjectCreated.createMockEvent({
      projectUID: "0xproject-uid-123",
      gardenAddress: gardenAddress,
      projectName: "Garden GAP",
      mockEventData: mockEvent(CHAIN_ID, 2000),
    });

    // Should not throw - just logs a warning
    const result = await GardenAccount.GAPProjectCreated.processEvent({
      event: gapEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);
    assert.equal(garden, undefined);
  });
});

describe("GardenAccount.OpenJoiningUpdated", () => {
  it("toggles openJoining on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: addr(11) }),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.OpenJoiningUpdated.createMockEvent({
      updater: addr(1),
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.OpenJoiningUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.openJoining, true);
  });

  it("does nothing when garden not found", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const updateEvent = GardenAccount.OpenJoiningUpdated.createMockEvent({
      updater: addr(1),
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.OpenJoiningUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = result.entities.Garden.get(gardenAddress);
    assert.equal(garden, undefined);
  });
});
