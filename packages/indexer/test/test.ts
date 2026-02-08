// @ts-nocheck
import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, ActionRegistry, GardenToken, HatsModule } = TestHelpers;

const CHAIN_ID_ARBITRUM = 42161;

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

describe("ActionRegistry", () => {
  it("creates action with chain-prefixed id", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionRegistered.createMockEvent({
      owner: createMockAddress(0),
      actionUID: 123n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Plant Trees",
      instructions: "Instructions",
      capitals: [0, 3],
      media: ["ipfs://QmTest"],
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
    });

    const result = await ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
    const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-123`);

    assert.ok(action);
    assert.equal(action.ownerAddress, createMockAddress(0));
    assert.deepEqual(action.capitals, ["SOCIAL", "LIVING"]);
    assert.equal(action.createdAt, 12345);
  });
});

describe("GardenToken", () => {
  it("GardenMinted creates garden with empty role arrays", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(10);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Test Garden",
      description: "Description",
      location: "Location",
      bannerImage: "Banner",
      openJoining: true,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 10000),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Test Garden");
    assert.equal(garden.openJoining, true);
    assert.deepEqual(garden.gardeners, []);
    assert.deepEqual(garden.operators, []);
    assert.deepEqual(garden.evaluators, []);
    assert.deepEqual(garden.owners, []);
    assert.deepEqual(garden.funders, []);
    assert.deepEqual(garden.communities, []);
  });
});

describe("HatsModule", () => {
  it("RoleGranted updates role arrays and gardener entity", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(20);

    mockDb = mockDb.entities.Garden.set({
      id: gardenAddress,
      chainId: CHAIN_ID_ARBITRUM,
      tokenAddress: createMockAddress(11),
      tokenID: 1n,
      name: "Hats Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
      createdAt: 10000,
    });

    const gardener = createMockAddress(1);
    const evaluator = createMockAddress(2);
    const operator = createMockAddress(3);
    const owner = createMockAddress(4);
    const funder = createMockAddress(5);
    const community = createMockAddress(6);

    const assignments = [
      { role: 0, account: gardener },
      { role: 1, account: evaluator },
      { role: 2, account: operator },
      { role: 3, account: owner },
      { role: 4, account: funder },
      { role: 5, account: community },
    ];

    for (const assignment of assignments) {
      const event = HatsModule.RoleGranted.createMockEvent({
        garden: gardenAddress,
        account: assignment.account,
        role: assignment.role,
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
      });

      mockDb = await HatsModule.RoleGranted.processEvent({ event, mockDb });
    }

    const garden = mockDb.entities.Garden.get(gardenAddress);
    // addUniqueAddress normalizes to lowercase
    assert.deepEqual(garden.gardeners, [gardener.toLowerCase()]);
    assert.deepEqual(garden.evaluators, [evaluator.toLowerCase()]);
    assert.deepEqual(garden.operators, [operator.toLowerCase()]);
    assert.deepEqual(garden.owners, [owner.toLowerCase()]);
    assert.deepEqual(garden.funders, [funder.toLowerCase()]);
    assert.deepEqual(garden.communities, [community.toLowerCase()]);

    const gardenerEntity = mockDb.entities.Gardener.get(
      `${CHAIN_ID_ARBITRUM}-${gardener.toLowerCase()}`
    );
    const operatorEntity = mockDb.entities.Gardener.get(`${CHAIN_ID_ARBITRUM}-${operator}`);

    assert.ok(gardenerEntity);
    assert.equal(operatorEntity, undefined);
  });

  it("RoleRevoked removes role projection and updates gardener entity gardens", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(30);
    const gardener = createMockAddress(7);

    mockDb = mockDb.entities.Garden.set({
      id: gardenAddress,
      chainId: CHAIN_ID_ARBITRUM,
      tokenAddress: createMockAddress(12),
      tokenID: 2n,
      name: "Revoked Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      gardeners: [gardener],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
      createdAt: 20000,
    });

    // Handler uses normalizeAddress (lowercase) for Gardener entity IDs
    mockDb = mockDb.entities.Gardener.set({
      id: `${CHAIN_ID_ARBITRUM}-${gardener.toLowerCase()}`,
      chainId: CHAIN_ID_ARBITRUM,
      createdAt: 15000,
      firstGarden: gardenAddress,
      gardens: [gardenAddress],
    });

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: gardenAddress,
      account: gardener,
      role: 0,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 21000),
    });

    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });

    const updatedGarden = mockDb.entities.Garden.get(gardenAddress);
    assert.deepEqual(updatedGarden.gardeners, []);

    const updatedGardener = mockDb.entities.Gardener.get(
      `${CHAIN_ID_ARBITRUM}-${gardener.toLowerCase()}`
    );
    assert.ok(updatedGardener);
    assert.deepEqual(updatedGardener.gardens, []);
  });

  it("projects roles only from RoleGranted and RoleRevoked", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(40);
    const gardener = createMockAddress(8);

    const mintedEvent = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Projected Garden",
      description: "",
      location: "",
      bannerImage: "",
      openJoining: false,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 30000),
    });

    mockDb = await GardenToken.GardenMinted.processEvent({ event: mintedEvent, mockDb });

    const afterMint = mockDb.entities.Garden.get(gardenAddress);
    assert.deepEqual(afterMint.gardeners, []);

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: gardenAddress,
      account: gardener,
      role: 0,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 30001),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });
    const afterGrant = mockDb.entities.Garden.get(gardenAddress);
    assert.deepEqual(afterGrant.gardeners, [gardener.toLowerCase()]);

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: gardenAddress,
      account: gardener,
      role: 0,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 30002),
    });

    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });
    const afterRevoke = mockDb.entities.Garden.get(gardenAddress);
    assert.deepEqual(afterRevoke.gardeners, []);
  });
});
