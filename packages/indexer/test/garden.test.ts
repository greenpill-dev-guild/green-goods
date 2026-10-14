import assert from "assert";
import type { Garden } from "envio";
import { assertGardenProjection, assertRoleArrays } from "./helpers/projections";
import { addr, CHAINS, mockEvent } from "./helpers/events";
import { createTestIndexer, GardenAccount, GardenToken, indexedAddress } from "./v3";

const CHAIN_ID = CHAINS.arbitrum;

function assertKarmaDetailsPending(garden: Garden | undefined) {
  assert.ok(garden);
  assert.equal(garden.karmaDetailsState, "PENDING");
  assert.equal(garden.karmaDetailsReason, "garden_metadata_changed");
}

// ============================================================================
// GARDEN TOKEN HANDLERS
// ============================================================================

describe("GardenToken.GardenMinted", () => {
  it("registers the minted GardenAccount for dynamic discovery", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = addr(10);
    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 42n,
      account: gardenAddress,
      name: "Dynamic Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });

    await GardenToken.GardenMinted.processEvent({ event, mockDb });

    assert.ok(
      mockDb.chains[CHAIN_ID].GardenAccount.addresses.some(
        (address) => address.toLowerCase() === gardenAddress.toLowerCase()
      )
    );
  });

  it("creates a new garden entity with all fields", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = addr(10);
    const tokenContract = indexedAddress("GardenToken", CHAIN_ID);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 42n,
      account: gardenAddress,
      name: "My Garden",
      description: "A community garden",
      location: "Berlin",
      bannerImage: "ipfs://bafk-banner",
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assertGardenProjection(garden, {
      id: gardenAddress,
      chainId: CHAIN_ID,
      name: "My Garden",
      description: "A community garden",
      location: "Berlin",
      bannerImage: "ipfs://bafk-banner",
      openJoining: true,
      initialized: true,
      tokenAddress: tokenContract,
      tokenID: 42n,
      createdAt: 1000,
      gapProjectUID: undefined,
    });
  });

  it("initializes all role arrays as empty", async () => {
    const mockDb = createTestIndexer();
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
    const garden = await result.Garden.get(gardenAddress);

    assertRoleArrays(garden, {
      gardeners: [],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
    });
  });
});

// ============================================================================
// GARDEN ACCOUNT UPDATE HANDLERS
// ============================================================================

describe("GardenAccount.NameUpdated", () => {
  it("updates name on existing garden", async () => {
    let mockDb = createTestIndexer();
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
      mockEventData: mockEvent(CHAIN_ID, 1000),
    });
    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintEvent, mockDb });

    const updateEvent = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Updated Name",
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });
    const result = await GardenAccount.NameUpdated.processEvent({ event: updateEvent, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Updated Name");
    assertKarmaDetailsPending(garden);
    // Other fields should be preserved
    assert.equal(garden.initialized, true);
  });

  it("creates a default garden if not existing", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = indexedAddress("GardenAccount", CHAIN_ID);

    const event = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Default Garden",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.NameUpdated.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Default Garden");
    assert.equal(garden.initialized, false);
    assert.equal(garden.chainId, CHAIN_ID);
  });
});

describe("GardenAccount.DescriptionUpdated", () => {
  it("updates description on existing garden", async () => {
    let mockDb = createTestIndexer();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "Old",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000),
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
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "New description");
    assertKarmaDetailsPending(garden);
  });

  it("creates default garden when missing", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = indexedAddress("GardenAccount", CHAIN_ID);

    const event = GardenAccount.DescriptionUpdated.createMockEvent({
      updater: addr(1),
      newDescription: "Some description",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.DescriptionUpdated.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "Some description");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.LocationUpdated", () => {
  it("updates location on existing garden", async () => {
    let mockDb = createTestIndexer();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "Old Location",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000),
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
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.location, "New York");
    assertKarmaDetailsPending(garden);
  });

  it("creates default garden when missing", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = indexedAddress("GardenAccount", CHAIN_ID);

    const event = GardenAccount.LocationUpdated.createMockEvent({
      updater: addr(1),
      newLocation: "Mars",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.LocationUpdated.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.location, "Mars");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.BannerImageUpdated", () => {
  it("updates banner image on existing garden", async () => {
    let mockDb = createTestIndexer();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "ipfs://old",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000),
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
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.bannerImage, "ipfs://new");
    assertKarmaDetailsPending(garden);
  });

  it("creates default garden when missing", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = indexedAddress("GardenAccount", CHAIN_ID);

    const event = GardenAccount.BannerImageUpdated.createMockEvent({
      updater: addr(1),
      newBannerImage: "ipfs://banner",
      mockEventData: mockEvent(CHAIN_ID, 1000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.BannerImageUpdated.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.bannerImage, "ipfs://banner");
    assert.equal(garden.initialized, false);
  });
});

describe("GardenAccount.OpenJoiningUpdated", () => {
  it("toggles openJoining on existing garden", async () => {
    let mockDb = createTestIndexer();
    const gardenAddress = addr(10);

    const mintEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: mockEvent(CHAIN_ID, 1000),
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
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.openJoining, true);
  });

  it("does nothing when garden not found", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = indexedAddress("GardenAccount", CHAIN_ID);

    const updateEvent = GardenAccount.OpenJoiningUpdated.createMockEvent({
      updater: addr(1),
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 2000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.OpenJoiningUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });
    const garden = await result.Garden.get(gardenAddress);
    assert.equal(garden, undefined);
  });
});
