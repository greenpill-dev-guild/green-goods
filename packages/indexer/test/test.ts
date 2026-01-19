// @ts-nocheck
import assert from "assert";
import { createRequire } from "module";

// Import generated module directly from local folder (bypass bun cache)
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, ActionRegistry, GardenToken, GardenAccount } = TestHelpers;

// ============================================================================
// TEST UTILITIES
// ============================================================================

const CHAIN_ID_ARBITRUM = 42161;
const CHAIN_ID_BASE = 8453;

function createMockAddress(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString().padStart(40, "0")}`;
}

function createMockBlockData(chainId: number, timestamp: number = Date.now()) {
  return {
    chainId,
    block: { timestamp },
    srcAddress: createMockAddress(99),
  };
}

// ============================================================================
// ACTION REGISTRY TESTS
// ============================================================================

describe("ActionRegistry", () => {
  describe("ActionRegistered", () => {
    it("creates Action with chainId-prefixed ID to prevent cross-chain collisions", async () => {
      const mockDb = MockDb.createMockDb();
      const ownerAddress = createMockAddress(0);
      const actionUID = 123n;

      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: ownerAddress,
        actionUID,
        startTime: 1000n,
        endTime: 2000n,
        title: "Plant Trees",
        instructions: "Go plant some trees in the community garden",
        capitals: [0, 3], // SOCIAL, LIVING
        media: ["ipfs://QmTest123"],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const expectedId = `${CHAIN_ID_ARBITRUM}-${actionUID}`;
      const action = result.entities.Action.get(expectedId);

      assert.ok(action, "Action should be created");
      assert.equal(action.id, expectedId, "ID should be chainId-actionUID");
      assert.equal(action.chainId, CHAIN_ID_ARBITRUM, "chainId should be set");
      assert.equal(action.ownerAddress, ownerAddress, "owner should be set");
      assert.equal(action.title, "Plant Trees", "title should be set");
      assert.equal(action.createdAt, 12345, "createdAt should be block timestamp");
    });

    // SKIP: Multi-chain tests require multiple chains in config.yaml
    // The Envio test framework validates chain IDs against the config.
    // To enable this test, add a second chain (e.g., Base 8453) to config.yaml
    it.skip("prevents ID collision when same actionUID exists on different chains", async () => {
      const mockDb = MockDb.createMockDb();
      const ownerAddress = createMockAddress(0);
      const actionUID = 1n; // Same UID on both chains

      // Create action on Arbitrum
      const arbitrumEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: ownerAddress,
        actionUID,
        startTime: 1000n,
        endTime: 2000n,
        title: "Arbitrum Action",
        instructions: "Instructions",
        capitals: [0],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const afterArbitrum = await ActionRegistry.ActionRegistered.processEvent({
        event: arbitrumEvent,
        mockDb,
      });

      // Create action on Base with same UID
      const baseEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: ownerAddress,
        actionUID,
        startTime: 3000n,
        endTime: 4000n,
        title: "Base Action",
        instructions: "Different instructions",
        capitals: [1],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_BASE),
      });

      const afterBase = await ActionRegistry.ActionRegistered.processEvent({
        event: baseEvent,
        mockDb: afterArbitrum,
      });

      // Both actions should exist with different IDs
      const arbitrumAction = afterBase.entities.Action.get(`${CHAIN_ID_ARBITRUM}-${actionUID}`);
      const baseAction = afterBase.entities.Action.get(`${CHAIN_ID_BASE}-${actionUID}`);

      assert.ok(arbitrumAction, "Arbitrum action should exist");
      assert.ok(baseAction, "Base action should exist");
      assert.equal(arbitrumAction.title, "Arbitrum Action");
      assert.equal(baseAction.title, "Base Action");
      assert.notEqual(arbitrumAction.id, baseAction.id, "IDs should be different");
    });
  });

  describe("Capital Mapping", () => {
    it("maps capital 0 to SOCIAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 1n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [0],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-1`);
      assert.deepEqual(action.capitals, ["SOCIAL"]);
    });

    it("maps capital 1 to MATERIAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 2n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [1],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-2`);
      assert.deepEqual(action.capitals, ["MATERIAL"]);
    });

    it("maps capital 2 to FINANCIAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 3n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [2],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-3`);
      assert.deepEqual(action.capitals, ["FINANCIAL"]);
    });

    it("maps capital 3 to LIVING", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 4n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [3],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-4`);
      assert.deepEqual(action.capitals, ["LIVING"]);
    });

    it("maps capital 4 to INTELLECTUAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 5n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [4],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-5`);
      assert.deepEqual(action.capitals, ["INTELLECTUAL"]);
    });

    it("maps capital 5 to EXPERIENTIAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 6n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [5],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-6`);
      assert.deepEqual(action.capitals, ["EXPERIENTIAL"]);
    });

    it("maps capital 6 to SPIRITUAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 7n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [6],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-7`);
      assert.deepEqual(action.capitals, ["SPIRITUAL"]);
    });

    it("maps capital 7 to CULTURAL", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 8n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [7],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-8`);
      assert.deepEqual(action.capitals, ["CULTURAL"]);
    });

    it("maps unknown capital values to UNKNOWN", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 9n,
        startTime: 0n,
        endTime: 0n,
        title: "Test",
        instructions: "",
        capitals: [99, 255], // Invalid values
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-9`);
      assert.deepEqual(action.capitals, ["UNKNOWN", "UNKNOWN"]);
    });

    it("correctly maps multiple capitals in a single action", async () => {
      const mockDb = MockDb.createMockDb();
      const mockEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 10n,
        startTime: 0n,
        endTime: 0n,
        title: "Multi-Capital Action",
        instructions: "",
        capitals: [0, 1, 3, 7], // SOCIAL, MATERIAL, LIVING, CULTURAL
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({
        event: mockEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-10`);
      assert.deepEqual(action.capitals, ["SOCIAL", "MATERIAL", "LIVING", "CULTURAL"]);
    });
  });

  describe("Action Updates", () => {
    it("ActionStartTimeUpdated updates only startTime", async () => {
      // First create an action
      let mockDb = MockDb.createMockDb();
      const actionUID = 100n;

      const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        startTime: 1000n,
        endTime: 2000n,
        title: "Original Title",
        instructions: "Original instructions",
        capitals: [0],
        media: ["original.jpg"],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      mockDb = await ActionRegistry.ActionRegistered.processEvent({
        event: createEvent,
        mockDb,
      });

      // Update start time
      const updateEvent = ActionRegistry.ActionStartTimeUpdated.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        startTime: 5000n,
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionStartTimeUpdated.processEvent({
        event: updateEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-${actionUID}`);
      assert.equal(action.startTime, 5000n, "startTime should be updated");
      assert.equal(action.endTime, 2000n, "endTime should be preserved");
      assert.equal(action.title, "Original Title", "title should be preserved");
    });

    it("ActionEndTimeUpdated updates only endTime", async () => {
      let mockDb = MockDb.createMockDb();
      const actionUID = 101n;

      const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        startTime: 1000n,
        endTime: 2000n,
        title: "Original Title",
        instructions: "Original instructions",
        capitals: [0],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      mockDb = await ActionRegistry.ActionRegistered.processEvent({
        event: createEvent,
        mockDb,
      });

      const updateEvent = ActionRegistry.ActionEndTimeUpdated.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        endTime: 9999n,
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionEndTimeUpdated.processEvent({
        event: updateEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-${actionUID}`);
      assert.equal(action.startTime, 1000n, "startTime should be preserved");
      assert.equal(action.endTime, 9999n, "endTime should be updated");
    });

    it("ActionTitleUpdated updates only title", async () => {
      let mockDb = MockDb.createMockDb();
      const actionUID = 102n;

      const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        startTime: 1000n,
        endTime: 2000n,
        title: "Original Title",
        instructions: "Original instructions",
        capitals: [0],
        media: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      mockDb = await ActionRegistry.ActionRegistered.processEvent({
        event: createEvent,
        mockDb,
      });

      const updateEvent = ActionRegistry.ActionTitleUpdated.createMockEvent({
        owner: createMockAddress(0),
        actionUID,
        title: "New Title",
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionTitleUpdated.processEvent({
        event: updateEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-${actionUID}`);
      assert.equal(action.title, "New Title", "title should be updated");
      assert.equal(
        action.instructions,
        "Original instructions",
        "instructions should be preserved"
      );
    });

    it("update on non-existent action is a no-op", async () => {
      const mockDb = MockDb.createMockDb();

      const updateEvent = ActionRegistry.ActionTitleUpdated.createMockEvent({
        owner: createMockAddress(0),
        actionUID: 999n,
        title: "New Title",
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
      });

      const result = await ActionRegistry.ActionTitleUpdated.processEvent({
        event: updateEvent,
        mockDb,
      });

      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-999`);
      assert.equal(action, undefined, "No action should be created");
    });
  });
});

// ============================================================================
// GARDEN TOKEN TESTS
// ============================================================================

describe("GardenToken", () => {
  describe("GardenMinted", () => {
    it("creates Garden entity with correct fields", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const tokenAddress = createMockAddress(11);
      const gardenerAddresses = [createMockAddress(1), createMockAddress(2)];
      const operatorAddresses = [createMockAddress(3)];
      // Handler merges gardeners + operators (operators are also gardeners by contract design)
      const expectedGardeners = [...new Set([...gardenerAddresses, ...operatorAddresses])];

      const mockEvent = GardenToken.GardenMinted.createMockEvent({
        tokenId: 1n,
        account: gardenAddress,
        name: "Community Garden",
        description: "A beautiful community garden",
        location: "San Francisco, CA",
        bannerImage: "ipfs://QmBanner",
        openJoining: true,
        gardeners: gardenerAddresses,
        operators: operatorAddresses,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 12345 },
          srcAddress: tokenAddress,
        },
      });

      const result = await GardenToken.GardenMinted.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);

      assert.ok(garden, "Garden should be created");
      assert.equal(garden.id, gardenAddress, "ID should be garden address");
      assert.equal(garden.chainId, CHAIN_ID_ARBITRUM, "chainId should be set");
      assert.equal(garden.name, "Community Garden", "name should be set");
      assert.equal(garden.description, "A beautiful community garden", "description should be set");
      assert.equal(garden.location, "San Francisco, CA", "location should be set");
      assert.equal(garden.bannerImage, "ipfs://QmBanner", "bannerImage should be set");
      assert.equal(garden.openJoining, true, "openJoining should be set");
      assert.equal(garden.tokenAddress, tokenAddress, "tokenAddress should be set");
      assert.equal(garden.tokenID, 1n, "tokenID should be set");
      assert.deepEqual(garden.gardeners, expectedGardeners, "gardeners should include operators");
      assert.deepEqual(garden.operators, operatorAddresses, "operators should be set");
    });

    it("creates Gardener entities for all gardeners in the mint", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const gardener1 = createMockAddress(1);
      const gardener2 = createMockAddress(2);

      const mockEvent = GardenToken.GardenMinted.createMockEvent({
        tokenId: 1n,
        account: gardenAddress,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [gardener1, gardener2],
        operators: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 50000),
      });

      const result = await GardenToken.GardenMinted.processEvent({
        event: mockEvent,
        mockDb,
      });

      const gardenerEntity1 = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${gardener1}`);
      const gardenerEntity2 = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${gardener2}`);

      assert.ok(gardenerEntity1, "Gardener 1 should be created");
      assert.ok(gardenerEntity2, "Gardener 2 should be created");

      assert.equal(gardenerEntity1.chainId, CHAIN_ID_ARBITRUM);
      assert.equal(gardenerEntity1.firstGarden, gardenAddress, "firstGarden should be set");
      assert.deepEqual(
        gardenerEntity1.gardens,
        [gardenAddress],
        "gardens should include the garden"
      );
      assert.equal(gardenerEntity1.createdAt, 50000, "createdAt should be block timestamp");
    });

    it("updates existing Gardener when they join a new garden via mint", async () => {
      // Pre-seed a gardener with an existing garden
      let mockDb = MockDb.createMockDb();
      const gardenerAddress = createMockAddress(1);
      const firstGardenAddress = createMockAddress(10);
      const secondGardenAddress = createMockAddress(20);

      const existingGardener = {
        id: `${CHAIN_ID_ARBITRUM}-${gardenerAddress}`,
        chainId: CHAIN_ID_ARBITRUM,
        createdAt: 10000,
        firstGarden: firstGardenAddress,
        gardens: [firstGardenAddress],
      };

      mockDb = mockDb.entities.Gardener.set(existingGardener);

      const mockEvent = GardenToken.GardenMinted.createMockEvent({
        tokenId: 2n,
        account: secondGardenAddress,
        name: "Second Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [gardenerAddress],
        operators: [],
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20000),
      });

      const result = await GardenToken.GardenMinted.processEvent({
        event: mockEvent,
        mockDb,
      });

      const gardener = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${gardenerAddress}`);

      assert.ok(gardener, "Gardener should exist");
      assert.equal(gardener.firstGarden, firstGardenAddress, "firstGarden should not change");
      assert.equal(gardener.createdAt, 10000, "createdAt should not change");
      assert.deepEqual(
        gardener.gardens,
        [firstGardenAddress, secondGardenAddress],
        "gardens should include both gardens"
      );
    });
  });
});

// ============================================================================
// GARDEN ACCOUNT TESTS
// ============================================================================

describe("GardenAccount", () => {
  describe("Bidirectional Gardener-Garden Updates", () => {
    it("GardenerAdded updates both Garden.gardeners and creates Gardener entity", async () => {
      // Pre-seed a garden
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const newGardenerAddress = createMockAddress(5);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.GardenerAdded.createMockEvent({
        updater: createMockAddress(0),
        gardener: newGardenerAddress,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.GardenerAdded.processEvent({
        event: mockEvent,
        mockDb,
      });

      // Check Garden was updated
      const garden = result.entities.Garden.get(gardenAddress);
      assert.ok(
        garden.gardeners.includes(newGardenerAddress),
        "Garden should include new gardener"
      );

      // Check Gardener was created
      const gardener = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${newGardenerAddress}`);
      assert.ok(gardener, "Gardener entity should be created");
      assert.equal(gardener.firstGarden, gardenAddress, "firstGarden should be set");
      assert.deepEqual(gardener.gardens, [gardenAddress], "gardens should include the garden");
    });

    it("GardenerRemoved updates both Garden.gardeners and Gardener.gardens", async () => {
      // Pre-seed garden and gardener
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const gardenerAddress = createMockAddress(5);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [gardenerAddress],
        operators: [],
        createdAt: 10000,
      };

      const existingGardener = {
        id: `${CHAIN_ID_ARBITRUM}-${gardenerAddress}`,
        chainId: CHAIN_ID_ARBITRUM,
        createdAt: 10000,
        firstGarden: gardenAddress,
        gardens: [gardenAddress],
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);
      mockDb = mockDb.entities.Gardener.set(existingGardener);

      const mockEvent = GardenAccount.GardenerRemoved.createMockEvent({
        updater: createMockAddress(0),
        gardener: gardenerAddress,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 30000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.GardenerRemoved.processEvent({
        event: mockEvent,
        mockDb,
      });

      // Check Garden was updated
      const garden = result.entities.Garden.get(gardenAddress);
      assert.equal(garden.gardeners.length, 0, "Garden should have no gardeners");
      assert.ok(!garden.gardeners.includes(gardenerAddress), "Gardener should be removed");

      // Check Gardener was updated
      const gardener = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${gardenerAddress}`);
      assert.ok(gardener, "Gardener entity should still exist");
      assert.equal(gardener.gardens.length, 0, "Gardener should have no gardens");
    });

    it("GardenerAdded updates existing Gardener with multiple gardens", async () => {
      // Pre-seed gardener with one garden, add them to another
      let mockDb = MockDb.createMockDb();
      const garden1Address = createMockAddress(10);
      const garden2Address = createMockAddress(20);
      const gardenerAddress = createMockAddress(5);

      const existingGarden1 = {
        id: garden1Address,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Garden 1",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [gardenerAddress],
        operators: [],
        createdAt: 10000,
      };

      const existingGarden2 = {
        id: garden2Address,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(12),
        tokenID: 2n,
        name: "Garden 2",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [],
        createdAt: 15000,
      };

      const existingGardener = {
        id: `${CHAIN_ID_ARBITRUM}-${gardenerAddress}`,
        chainId: CHAIN_ID_ARBITRUM,
        createdAt: 10000,
        firstGarden: garden1Address,
        gardens: [garden1Address],
      };

      mockDb = mockDb.entities.Garden.set(existingGarden1);
      mockDb = mockDb.entities.Garden.set(existingGarden2);
      mockDb = mockDb.entities.Gardener.set(existingGardener);

      const mockEvent = GardenAccount.GardenerAdded.createMockEvent({
        updater: createMockAddress(0),
        gardener: gardenerAddress,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: garden2Address,
        },
      });

      const result = await GardenAccount.GardenerAdded.processEvent({
        event: mockEvent,
        mockDb,
      });

      const gardener = result.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${gardenerAddress}`);
      assert.equal(gardener.firstGarden, garden1Address, "firstGarden should not change");
      assert.deepEqual(
        gardener.gardens,
        [garden1Address, garden2Address],
        "Both gardens should be listed"
      );
    });
  });

  describe("Create If Not Exists Pattern", () => {
    it("NameUpdated creates minimal garden if garden does not exist", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const mockEvent = GardenAccount.NameUpdated.createMockEvent({
        updater: createMockAddress(0),
        newName: "New Garden Name",
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 12345 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.NameUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);

      assert.ok(garden, "Garden should be created");
      assert.equal(garden.name, "New Garden Name", "name should be set");
      assert.equal(garden.description, "", "description should be empty default");
      assert.equal(garden.location, "", "location should be empty default");
      assert.equal(garden.tokenAddress, "", "tokenAddress should be empty");
      assert.deepEqual(garden.gardeners, [], "gardeners should be empty");
      assert.deepEqual(garden.operators, [], "operators should be empty");
    });

    it("DescriptionUpdated creates minimal garden if garden does not exist", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const mockEvent = GardenAccount.DescriptionUpdated.createMockEvent({
        updater: createMockAddress(0),
        newDescription: "A new garden description",
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 12345 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.DescriptionUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);

      assert.ok(garden, "Garden should be created");
      assert.equal(garden.description, "A new garden description");
      assert.equal(garden.name, "", "name should be empty default");
    });

    it("LocationUpdated creates minimal garden if garden does not exist", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const mockEvent = GardenAccount.LocationUpdated.createMockEvent({
        updater: createMockAddress(0),
        newLocation: "123 Main Street",
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 12345 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.LocationUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);

      assert.ok(garden, "Garden should be created");
      assert.equal(garden.location, "123 Main Street");
    });

    it("BannerImageUpdated creates minimal garden if garden does not exist", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const mockEvent = GardenAccount.BannerImageUpdated.createMockEvent({
        updater: createMockAddress(0),
        newBannerImage: "ipfs://QmNewBanner",
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 12345 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.BannerImageUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);

      assert.ok(garden, "Garden should be created");
      assert.equal(garden.bannerImage, "ipfs://QmNewBanner");
    });
  });

  describe("Operator Management", () => {
    it("GardenOperatorAdded adds operator to garden", async () => {
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const operatorAddress = createMockAddress(5);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.GardenOperatorAdded.createMockEvent({
        updater: createMockAddress(0),
        operator: operatorAddress,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.GardenOperatorAdded.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.deepEqual(garden.operators, [operatorAddress], "Operator should be added");
    });

    it("GardenOperatorRemoved removes operator from garden", async () => {
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const operator1 = createMockAddress(5);
      const operator2 = createMockAddress(6);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [operator1, operator2],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.GardenOperatorRemoved.createMockEvent({
        updater: createMockAddress(0),
        operator: operator1,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.GardenOperatorRemoved.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.deepEqual(garden.operators, [operator2], "Only operator2 should remain");
    });
  });

  describe("OpenJoining Flag", () => {
    it("OpenJoiningUpdated sets openJoining to true", async () => {
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.OpenJoiningUpdated.createMockEvent({
        updater: createMockAddress(0),
        openJoining: true,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.OpenJoiningUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.equal(garden.openJoining, true, "openJoining should be true");
    });

    it("OpenJoiningUpdated sets openJoining to false", async () => {
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: true,
        gardeners: [],
        operators: [],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.OpenJoiningUpdated.createMockEvent({
        updater: createMockAddress(0),
        openJoining: false,
        mockEventData: {
          chainId: CHAIN_ID_ARBITRUM,
          block: { timestamp: 20000 },
          srcAddress: gardenAddress,
        },
      });

      const result = await GardenAccount.OpenJoiningUpdated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.equal(garden.openJoining, false, "openJoining should be false");
    });
  });

  describe("GAP Project Integration", () => {
    it("GAPProjectCreated sets gapProjectUID on existing garden", async () => {
      let mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const projectUID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const existingGarden = {
        id: gardenAddress,
        chainId: CHAIN_ID_ARBITRUM,
        tokenAddress: createMockAddress(11),
        tokenID: 1n,
        name: "Test Garden",
        description: "",
        location: "",
        bannerImage: "",
        openJoining: false,
        gardeners: [],
        operators: [],
        createdAt: 10000,
      };

      mockDb = mockDb.entities.Garden.set(existingGarden);

      const mockEvent = GardenAccount.GAPProjectCreated.createMockEvent({
        projectUID,
        gardenAddress,
        projectName: "Green Goods Project",
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20000),
      });

      const result = await GardenAccount.GAPProjectCreated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.equal(garden.gapProjectUID, projectUID, "gapProjectUID should be set");
    });

    it("GAPProjectCreated does not create garden if it does not exist", async () => {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(10);
      const projectUID = "0x1234567890abcdef";

      const mockEvent = GardenAccount.GAPProjectCreated.createMockEvent({
        projectUID,
        gardenAddress,
        projectName: "Green Goods Project",
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20000),
      });

      const result = await GardenAccount.GAPProjectCreated.processEvent({
        event: mockEvent,
        mockDb,
      });

      const garden = result.entities.Garden.get(gardenAddress);
      assert.equal(garden, undefined, "Garden should not be created");
    });
  });
});

// ============================================================================
// MULTI-CHAIN TESTS
// ============================================================================
// NOTE: These tests require multiple chains in config.yaml
// The Envio test framework validates chain IDs against the config.
// Currently only Arbitrum (42161) is configured - to enable these tests,
// add Base (8453) to config.yaml networks section.

describe("Multi-Chain Support", () => {
  it.skip("same gardener address on different chains creates separate entities", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenerAddress = createMockAddress(1);
    const arbitrumGardenAddress = createMockAddress(10);
    const baseGardenAddress = createMockAddress(20);

    // Create garden on Arbitrum
    const arbitrumEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: arbitrumGardenAddress,
      name: "Arbitrum Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [gardenerAddress],
      operators: [],
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 10000),
    });

    const afterArbitrum = await GardenToken.GardenMinted.processEvent({
      event: arbitrumEvent,
      mockDb,
    });

    // Create garden on Base with same gardener address
    const baseEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: baseGardenAddress,
      name: "Base Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [gardenerAddress],
      operators: [],
      mockEventData: createMockBlockData(CHAIN_ID_BASE, 20000),
    });

    const afterBase = await GardenToken.GardenMinted.processEvent({
      event: baseEvent,
      mockDb: afterArbitrum,
    });

    // Verify separate gardener entities
    const arbitrumGardener = afterBase.entities.Gardener.get(
      `${CHAIN_ID_ARBITRUM}-${gardenerAddress}`
    );
    const baseGardener = afterBase.entities.Gardener.get(`${CHAIN_ID_BASE}-${gardenerAddress}`);

    assert.ok(arbitrumGardener, "Arbitrum gardener should exist");
    assert.ok(baseGardener, "Base gardener should exist");
    assert.notEqual(arbitrumGardener.id, baseGardener.id, "IDs should be different");
    assert.equal(arbitrumGardener.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(baseGardener.chainId, CHAIN_ID_BASE);
    assert.deepEqual(arbitrumGardener.gardens, [arbitrumGardenAddress]);
    assert.deepEqual(baseGardener.gardens, [baseGardenAddress]);
  });

  it.skip("garden addresses are unique per chain", async () => {
    const mockDb = MockDb.createMockDb();
    // Using same address on different chains (theoretically possible)
    const sharedAddress = createMockAddress(10);

    const arbitrumEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: sharedAddress,
      name: "Arbitrum Garden",
      description: "On Arbitrum",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [],
      operators: [],
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM),
    });

    const afterArbitrum = await GardenToken.GardenMinted.processEvent({
      event: arbitrumEvent,
      mockDb,
    });

    const baseEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: sharedAddress,
      name: "Base Garden",
      description: "On Base",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [],
      operators: [],
      mockEventData: createMockBlockData(CHAIN_ID_BASE),
    });

    const afterBase = await GardenToken.GardenMinted.processEvent({
      event: baseEvent,
      mockDb: afterArbitrum,
    });

    // Note: Current implementation uses garden address as ID (not chainId-prefixed)
    // This means same address would be overwritten - this test documents current behavior
    const garden = afterBase.entities.Garden.get(sharedAddress);
    assert.ok(garden, "Garden should exist");
    // Last write wins - this is the current behavior (may need chainId prefix for true multi-chain)
    assert.equal(garden.name, "Base Garden", "Last write should win");
  });
});
