// @ts-nocheck
import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const {
  MockDb,
  Addresses,
  ActionRegistry,
  GardenToken,
  HatsModule,
  OctantModule,
  OctantVault,
  GardensModule,
} = TestHelpers;

const CHAIN_ID_ARBITRUM = 42161;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function createMockAddress(index: number): string {
  return Addresses.mockAddresses[index] || `0x${index.toString().padStart(40, "0")}`;
}

function createMockTxHash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function createMockBlockData(
  chainId: number,
  timestamp: number = Date.now(),
  options: {
    srcAddress?: string;
    txHash?: string;
    logIndex?: number;
    blockNumber?: number;
  } = {}
) {
  return {
    chainId,
    block: { timestamp, number: options.blockNumber ?? 0 },
    srcAddress: options.srcAddress ?? createMockAddress(99),
    transaction: { hash: options.txHash ?? createMockTxHash(timestamp) },
    logIndex: options.logIndex ?? 0,
  };
}

function createMockGardenVault(
  chainId: number,
  garden: string,
  asset: string,
  vaultAddress: string,
  timestamp: number = Date.now()
) {
  return {
    id: `${chainId}-${garden.toLowerCase()}-${asset.toLowerCase()}`,
    chainId,
    garden: garden.toLowerCase(),
    asset: asset.toLowerCase(),
    vaultAddress: vaultAddress.toLowerCase(),
    totalDeposited: 0n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: undefined,
    depositorCount: 0,
    paused: false,
    createdAt: timestamp,
  };
}

function createMockVaultDeposit(
  chainId: number,
  vaultAddress: string,
  depositor: string,
  garden: string,
  asset: string,
  shares: bigint = 0n,
  totalDeposited: bigint = 0n,
  totalWithdrawn: bigint = 0n
) {
  return {
    id: `${chainId}-${vaultAddress.toLowerCase()}-${depositor.toLowerCase()}`,
    chainId,
    garden: garden.toLowerCase(),
    asset: asset.toLowerCase(),
    vaultAddress: vaultAddress.toLowerCase(),
    depositor: depositor.toLowerCase(),
    shares,
    totalDeposited,
    totalWithdrawn,
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
      slug: "waste.plant_trees",
      instructions: "Instructions",
      capitals: [0, 3],
      media: ["ipfs://QmTest"],
      domain: 3,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
    });

    const result = await ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
    const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-123`);

    assert.ok(action);
    assert.equal(action.ownerAddress, createMockAddress(0));
    assert.equal(action.slug, "waste.plant_trees");
    assert.equal(action.domain, "WASTE");
    assert.deepEqual(action.capitals, ["SOCIAL", "LIVING"]);
    assert.equal(action.createdAt, 12345);
  });

  it("maps all domain values correctly", async () => {
    const domainTests = [
      { domain: 0, expected: "SOLAR" },
      { domain: 1, expected: "AGRO" },
      { domain: 2, expected: "EDU" },
      { domain: 3, expected: "WASTE" },
    ];

    for (const { domain, expected } of domainTests) {
      const mockDb = MockDb.createMockDb();
      const event = ActionRegistry.ActionRegistered.createMockEvent({
        owner: createMockAddress(0),
        actionUID: BigInt(domain),
        startTime: 1000n,
        endTime: 2000n,
        title: `${expected} Action`,
        slug: `${expected.toLowerCase()}.test`,
        instructions: "Instructions",
        capitals: [0],
        media: [],
        domain,
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
      });

      const result = await ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
      const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-${domain}`);

      assert.ok(action, `Action for domain ${expected} should exist`);
      assert.equal(action.domain, expected, `Domain should be ${expected}`);
    }
  });

  it("maps unknown domain values to UNKNOWN", async () => {
    const mockDb = MockDb.createMockDb();
    const event = ActionRegistry.ActionRegistered.createMockEvent({
      owner: createMockAddress(0),
      actionUID: 999n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Unknown Domain Action",
      slug: "unknown.test",
      instructions: "Instructions",
      capitals: [0],
      media: [],
      domain: 255,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 12345),
    });

    const result = await ActionRegistry.ActionRegistered.processEvent({ event, mockDb });
    const action = result.entities.Action.get(`${CHAIN_ID_ARBITRUM}-999`);

    assert.ok(action);
    assert.equal(action.domain, "UNKNOWN");
  });
});

describe("ActionRegistry GardenDomains", () => {
  it("GardenDomainsUpdated creates entity with expanded domain array", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(200);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x0f,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20000),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const entity = result.entities.GardenDomains.get(
      `${CHAIN_ID_ARBITRUM}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(entity, "GardenDomains entity should exist");
    assert.equal(entity.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(entity.garden, gardenAddress.toLowerCase());
    assert.equal(entity.domainMask, 0x0f);
    assert.deepEqual(entity.domains, ["SOLAR", "AGRO", "EDU", "WASTE"]);
    assert.equal(entity.updatedAt, 20000);
  });

  it("expands single-domain bitmasks correctly", async () => {
    const singleDomainTests = [
      { mask: 0x01, expected: ["SOLAR"] },
      { mask: 0x02, expected: ["AGRO"] },
      { mask: 0x04, expected: ["EDU"] },
      { mask: 0x08, expected: ["WASTE"] },
    ];

    for (const { mask, expected } of singleDomainTests) {
      const mockDb = MockDb.createMockDb();
      const gardenAddress = createMockAddress(201 + mask);

      const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
        garden: gardenAddress,
        domainMask: mask,
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20001),
      });

      const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
      const entity = result.entities.GardenDomains.get(
        `${CHAIN_ID_ARBITRUM}-${gardenAddress.toLowerCase()}`
      );

      assert.ok(entity, `Entity should exist for mask 0x${mask.toString(16).padStart(2, "0")}`);
      assert.deepEqual(
        entity.domains,
        expected,
        `Mask 0x${mask.toString(16).padStart(2, "0")} should expand to ${expected}`
      );
    }
  });

  it("expands partial bitmask combinations correctly", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(210);

    // Solar + Waste = 0b1001 = 0x09
    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x09,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20002),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const entity = result.entities.GardenDomains.get(
      `${CHAIN_ID_ARBITRUM}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(entity);
    assert.equal(entity.domainMask, 0x09);
    assert.deepEqual(entity.domains, ["SOLAR", "WASTE"]);
  });

  it("handles empty bitmask (no domains)", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(211);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x00,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20003),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const entity = result.entities.GardenDomains.get(
      `${CHAIN_ID_ARBITRUM}-${gardenAddress.toLowerCase()}`
    );

    assert.ok(entity);
    assert.equal(entity.domainMask, 0);
    assert.deepEqual(entity.domains, []);
  });

  it("overwrites previous domain configuration on update", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = createMockAddress(212);

    // First: set all domains
    const event1 = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x0f,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20004),
    });
    mockDb = await ActionRegistry.GardenDomainsUpdated.processEvent({ event: event1, mockDb });

    // Second: narrow to Agro + Edu only
    const event2 = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x06,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 20005),
    });
    mockDb = await ActionRegistry.GardenDomainsUpdated.processEvent({ event: event2, mockDb });

    const entity = mockDb.entities.GardenDomains.get(
      `${CHAIN_ID_ARBITRUM}-${gardenAddress.toLowerCase()}`
    );
    assert.ok(entity);
    assert.equal(entity.domainMask, 0x06);
    assert.deepEqual(entity.domains, ["AGRO", "EDU"]);
    assert.equal(entity.updatedAt, 20005);
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

describe("OctantModule", () => {
  it("VaultCreated creates GardenVault entity with chain-prefixed id", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = createMockAddress(50);
    const asset = createMockAddress(51);
    const vault = createMockAddress(52);

    const event = OctantModule.VaultCreated.createMockEvent({
      garden,
      vault,
      asset,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 45678, {
        txHash: createMockTxHash(1),
        logIndex: 1,
      }),
    });

    const result = await OctantModule.VaultCreated.processEvent({ event, mockDb });

    const expectedId = `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`;
    const gardenVault = result.entities.GardenVault.get(expectedId);
    assert.ok(gardenVault);
    assert.equal(gardenVault.vaultAddress, vault.toLowerCase());
    assert.equal(gardenVault.totalDeposited, 0n);
    assert.equal(gardenVault.totalWithdrawn, 0n);
    assert.equal(gardenVault.totalHarvestCount, 0);
    assert.equal(gardenVault.depositorCount, 0);

    const gardenVaultIndex = result.entities.GardenVaultIndex.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(gardenVaultIndex);
    assert.deepEqual(gardenVaultIndex.assets, [asset.toLowerCase()]);

    const vaultAddressIndex = result.entities.VaultAddressIndex.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}`
    );
    assert.ok(vaultAddressIndex);
    assert.equal(vaultAddressIndex.garden, garden.toLowerCase());
    assert.equal(vaultAddressIndex.asset, asset.toLowerCase());
  });

  it("VaultCreated stores vault address index used for dynamic vault lookup", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(60);
    const asset = createMockAddress(61);
    const vault = createMockAddress(62);
    const depositor = createMockAddress(63);

    const createVaultEvent = OctantModule.VaultCreated.createMockEvent({
      garden,
      vault,
      asset,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 50000, {
        txHash: createMockTxHash(2),
        logIndex: 2,
      }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event: createVaultEvent, mockDb });

    const depositEvent = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 25n,
      shares: 24n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 50001, {
        srcAddress: vault,
        txHash: createMockTxHash(3),
        logIndex: 3,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: depositEvent, mockDb });

    const vaultDeposit = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositor.toLowerCase()}`
    );
    assert.ok(vaultDeposit);
    assert.equal(vaultDeposit.shares, 24n);
  });

  it("DonationAddressUpdated updates GardenVault donation address", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(70);
    const assetA = createMockAddress(71);
    const assetB = createMockAddress(72);
    const vaultA = createMockAddress(73);
    const vaultB = createMockAddress(74);
    const donationAddress = createMockAddress(75);

    mockDb = mockDb.entities.GardenVault.set(
      createMockGardenVault(CHAIN_ID_ARBITRUM, garden, assetA, vaultA, 1234)
    );
    mockDb = mockDb.entities.GardenVault.set(
      createMockGardenVault(CHAIN_ID_ARBITRUM, garden, assetB, vaultB, 1234)
    );
    mockDb = mockDb.entities.GardenVaultIndex.set({
      id: `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`,
      chainId: CHAIN_ID_ARBITRUM,
      garden: garden.toLowerCase(),
      assets: [assetA.toLowerCase(), assetB.toLowerCase()],
    });

    const event = OctantModule.DonationAddressUpdated.createMockEvent({
      garden,
      oldAddress: ZERO_ADDRESS,
      newAddress: donationAddress,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 60000, {
        txHash: createMockTxHash(4),
        logIndex: 4,
      }),
    });
    mockDb = await OctantModule.DonationAddressUpdated.processEvent({ event, mockDb });

    const updatedA = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${assetA.toLowerCase()}`
    );
    const updatedB = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${assetB.toLowerCase()}`
    );
    assert.equal(updatedA.donationAddress, donationAddress.toLowerCase());
    assert.equal(updatedB.donationAddress, donationAddress.toLowerCase());
  });

  it("HarvestTriggered creates VaultEvent with HARVEST type", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(80);
    const asset = createMockAddress(81);
    const vault = createMockAddress(82);
    const caller = createMockAddress(83);

    mockDb = mockDb.entities.GardenVault.set(
      createMockGardenVault(CHAIN_ID_ARBITRUM, garden, asset, vault, 1234)
    );

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden,
      asset,
      caller,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 70000, {
        txHash: createMockTxHash(5),
        logIndex: 5,
      }),
    });

    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const updatedVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.equal(updatedVault.totalHarvestCount, 1);

    const vaultEvent = mockDb.entities.VaultEvent.get(
      `${CHAIN_ID_ARBITRUM}-${createMockTxHash(5)}-5`
    );
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "HARVEST");
    assert.equal(vaultEvent.actor, caller.toLowerCase());
    assert.equal(vaultEvent.vaultAddress, vault.toLowerCase());
  });

  it("EmergencyPaused sets GardenVault.paused and creates VaultEvent", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(90);
    const asset = createMockAddress(91);
    const vault = createMockAddress(92);
    const caller = createMockAddress(93);

    mockDb = mockDb.entities.GardenVault.set(
      createMockGardenVault(CHAIN_ID_ARBITRUM, garden, asset, vault, 1234)
    );

    const event = OctantModule.EmergencyPaused.createMockEvent({
      garden,
      asset,
      caller,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 80000, {
        txHash: createMockTxHash(6),
        logIndex: 6,
      }),
    });

    mockDb = await OctantModule.EmergencyPaused.processEvent({ event, mockDb });

    const updatedVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.equal(updatedVault.paused, true);

    const vaultEvent = mockDb.entities.VaultEvent.get(
      `${CHAIN_ID_ARBITRUM}-${createMockTxHash(6)}-6`
    );
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "EMERGENCY_PAUSED");
    assert.equal(vaultEvent.actor, caller.toLowerCase());
    assert.equal(vaultEvent.vaultAddress, vault.toLowerCase());
  });
});

describe("OctantVault (dynamic)", () => {
  async function seedGardenVault(
    mockDb: ReturnType<typeof MockDb.createMockDb>,
    garden: string,
    asset: string,
    vault: string,
    eventIndex: number
  ) {
    const event = OctantModule.VaultCreated.createMockEvent({
      garden,
      vault,
      asset,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 90000 + eventIndex, {
        txHash: createMockTxHash(100 + eventIndex),
        logIndex: eventIndex,
      }),
    });
    return OctantModule.VaultCreated.processEvent({ event, mockDb });
  }

  it("Deposit creates VaultDeposit entity and updates GardenVault totals", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(100);
    const asset = createMockAddress(101);
    const vault = createMockAddress(102);
    const depositor = createMockAddress(103);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 1);

    const event = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 150n,
      shares: 140n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 91000, {
        srcAddress: vault,
        txHash: createMockTxHash(7),
        logIndex: 7,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event, mockDb });

    const deposit = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositor.toLowerCase()}`
    );
    assert.ok(deposit);
    assert.equal(deposit.shares, 140n);
    assert.equal(deposit.totalDeposited, 150n);
    assert.equal(deposit.totalWithdrawn, 0n);

    const gardenVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.equal(gardenVault.totalDeposited, 150n);
    assert.equal(gardenVault.depositorCount, 1);
  });

  it("Deposit increments depositorCount only for new depositors", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(110);
    const asset = createMockAddress(111);
    const vault = createMockAddress(112);
    const depositor = createMockAddress(113);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 2);

    const firstDeposit = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 25n,
      shares: 24n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 92000, {
        srcAddress: vault,
        txHash: createMockTxHash(8),
        logIndex: 8,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: firstDeposit, mockDb });

    const secondDeposit = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 40n,
      shares: 39n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 92001, {
        srcAddress: vault,
        txHash: createMockTxHash(9),
        logIndex: 9,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: secondDeposit, mockDb });

    const gardenVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    const deposit = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositor.toLowerCase()}`
    );

    assert.equal(gardenVault.depositorCount, 1);
    assert.equal(gardenVault.totalDeposited, 65n);
    assert.equal(deposit.shares, 63n);
  });

  it("Deposit from existing depositor updates shares, not depositorCount", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(120);
    const asset = createMockAddress(121);
    const vault = createMockAddress(122);
    const depositor = createMockAddress(123);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 3);
    mockDb = mockDb.entities.VaultDeposit.set(
      createMockVaultDeposit(CHAIN_ID_ARBITRUM, vault, depositor, garden, asset, 50n, 55n, 0n)
    );
    mockDb = mockDb.entities.GardenVault.set({
      ...createMockGardenVault(CHAIN_ID_ARBITRUM, garden, asset, vault, 1234),
      totalDeposited: 55n,
      depositorCount: 1,
    });

    const event = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 5n,
      shares: 4n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 93000, {
        srcAddress: vault,
        txHash: createMockTxHash(10),
        logIndex: 10,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event, mockDb });

    const gardenVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    const deposit = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositor.toLowerCase()}`
    );

    assert.equal(gardenVault.depositorCount, 1);
    assert.equal(gardenVault.totalDeposited, 60n);
    assert.equal(deposit.shares, 54n);
  });

  it("Withdraw updates VaultDeposit shares and GardenVault totals", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(130);
    const asset = createMockAddress(131);
    const vault = createMockAddress(132);
    const depositor = createMockAddress(133);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 4);

    const deposit = OctantVault.Deposit.createMockEvent({
      sender: depositor,
      owner: depositor,
      assets: 100n,
      shares: 95n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 94000, {
        srcAddress: vault,
        txHash: createMockTxHash(11),
        logIndex: 11,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit, mockDb });

    const withdraw = OctantVault.Withdraw.createMockEvent({
      sender: depositor,
      receiver: depositor,
      owner: depositor,
      assets: 40n,
      shares: 38n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 94001, {
        srcAddress: vault,
        txHash: createMockTxHash(12),
        logIndex: 12,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event: withdraw, mockDb });

    const updatedDeposit = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositor.toLowerCase()}`
    );
    assert.equal(updatedDeposit.shares, 57n);
    assert.equal(updatedDeposit.totalWithdrawn, 40n);

    const gardenVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.equal(gardenVault.totalWithdrawn, 40n);
  });

  it("Withdraw creates VaultEvent with WITHDRAW type", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(140);
    const asset = createMockAddress(141);
    const vault = createMockAddress(142);
    const depositor = createMockAddress(143);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 5);
    mockDb = mockDb.entities.VaultDeposit.set(
      createMockVaultDeposit(CHAIN_ID_ARBITRUM, vault, depositor, garden, asset, 20n, 25n, 0n)
    );
    mockDb = mockDb.entities.GardenVault.set({
      ...createMockGardenVault(CHAIN_ID_ARBITRUM, garden, asset, vault, 1234),
      totalDeposited: 25n,
      depositorCount: 1,
    });

    const event = OctantVault.Withdraw.createMockEvent({
      sender: depositor,
      receiver: depositor,
      owner: depositor,
      assets: 10n,
      shares: 8n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 95000, {
        srcAddress: vault,
        txHash: createMockTxHash(13),
        logIndex: 13,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event, mockDb });

    const vaultEvent = mockDb.entities.VaultEvent.get(
      `${CHAIN_ID_ARBITRUM}-${createMockTxHash(13)}-13`
    );
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "WITHDRAW");
    assert.equal(vaultEvent.actor, depositor.toLowerCase());
    assert.equal(vaultEvent.amount, 10n);
    assert.equal(vaultEvent.shares, 8n);
  });

  it("Multiple depositors tracked independently per vault", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(150);
    const asset = createMockAddress(151);
    const vault = createMockAddress(152);
    const depositorA = createMockAddress(153);
    const depositorB = createMockAddress(154);

    mockDb = await seedGardenVault(mockDb, garden, asset, vault, 6);

    const depositA = OctantVault.Deposit.createMockEvent({
      sender: depositorA,
      owner: depositorA,
      assets: 70n,
      shares: 68n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 96000, {
        srcAddress: vault,
        txHash: createMockTxHash(14),
        logIndex: 14,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: depositA, mockDb });

    const depositB = OctantVault.Deposit.createMockEvent({
      sender: depositorB,
      owner: depositorB,
      assets: 30n,
      shares: 29n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 96001, {
        srcAddress: vault,
        txHash: createMockTxHash(15),
        logIndex: 15,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: depositB, mockDb });

    const depositEntityA = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositorA.toLowerCase()}`
    );
    const depositEntityB = mockDb.entities.VaultDeposit.get(
      `${CHAIN_ID_ARBITRUM}-${vault.toLowerCase()}-${depositorB.toLowerCase()}`
    );
    const gardenVault = mockDb.entities.GardenVault.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );

    assert.equal(depositEntityA.shares, 68n);
    assert.equal(depositEntityB.shares, 29n);
    assert.equal(gardenVault.depositorCount, 2);
    assert.equal(gardenVault.totalDeposited, 100n);
  });
});

describe("GardensModule", () => {
  it("CommunityCreated creates GardenCommunity entity with correct fields", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = createMockAddress(160);
    const community = createMockAddress(161);
    const goodsToken = createMockAddress(162);
    const event = GardensModule.CommunityCreated.createMockEvent({
      garden,
      community,
      weightScheme: 0,
      goodsToken,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 100000, {
        txHash: createMockTxHash(20),
        logIndex: 20,
      }),
    });

    const result = await GardensModule.CommunityCreated.processEvent({ event, mockDb });

    const expectedId = `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`;
    const communityEntity = result.entities.GardenCommunity.get(expectedId);
    assert.ok(communityEntity, "GardenCommunity entity should exist");
    assert.equal(communityEntity.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(communityEntity.garden, garden.toLowerCase());
    assert.equal(communityEntity.communityAddress, community.toLowerCase());
    assert.equal(communityEntity.weightScheme, "LINEAR");
    assert.equal(communityEntity.goodsToken, goodsToken.toLowerCase());
    assert.equal(communityEntity.powerSourceCount, undefined);
    assert.equal(communityEntity.createdAt, 100000);
  });

  it("CommunityCreated maps weight schemes correctly", async () => {
    const weightSchemeTests = [
      { value: 0, expected: "LINEAR" },
      { value: 1, expected: "EXPONENTIAL" },
      { value: 2, expected: "POWER" },
    ];

    for (const { value, expected } of weightSchemeTests) {
      const mockDb = MockDb.createMockDb();
      const garden = createMockAddress(170 + value);

      const event = GardensModule.CommunityCreated.createMockEvent({
        garden,
        community: createMockAddress(171 + value),
        weightScheme: value,
        goodsToken: createMockAddress(172 + value),
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 100100 + value, {
          txHash: createMockTxHash(30 + value),
          logIndex: 30 + value,
        }),
      });

      const result = await GardensModule.CommunityCreated.processEvent({ event, mockDb });
      const communityEntity = result.entities.GardenCommunity.get(
        `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
      );

      assert.ok(communityEntity, `Community for weight scheme ${expected} should exist`);
      assert.equal(communityEntity.weightScheme, expected, `Weight scheme should be ${expected}`);
    }
  });

  it("CommunityCreated is idempotent — skips duplicate creation", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(180);
    const communityA = createMockAddress(181);
    const communityB = createMockAddress(182);

    const event1 = GardensModule.CommunityCreated.createMockEvent({
      garden,
      community: communityA,
      weightScheme: 0,
      goodsToken: createMockAddress(183),
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 101000, {
        txHash: createMockTxHash(40),
        logIndex: 40,
      }),
    });
    mockDb = await GardensModule.CommunityCreated.processEvent({ event: event1, mockDb });

    // Second event for same garden should be skipped
    const event2 = GardensModule.CommunityCreated.createMockEvent({
      garden,
      community: communityB,
      weightScheme: 1,
      goodsToken: createMockAddress(185),
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 102000, {
        txHash: createMockTxHash(41),
        logIndex: 41,
      }),
    });
    mockDb = await GardensModule.CommunityCreated.processEvent({ event: event2, mockDb });

    const entity = mockDb.entities.GardenCommunity.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(entity);
    // Should retain original community address, not the duplicate
    assert.equal(entity.communityAddress, communityA.toLowerCase());
    assert.equal(entity.weightScheme, "LINEAR");
  });

  it("SignalPoolCreated creates GardenSignalPool entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = createMockAddress(190);
    const pool = createMockAddress(191);
    const community = createMockAddress(192);

    const event = GardensModule.SignalPoolCreated.createMockEvent({
      garden,
      pool,
      poolType: 0,
      community,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 110000, {
        txHash: createMockTxHash(50),
        logIndex: 50,
      }),
    });

    const result = await GardensModule.SignalPoolCreated.processEvent({ event, mockDb });

    const expectedId = `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${pool.toLowerCase()}`;
    const poolEntity = result.entities.GardenSignalPool.get(expectedId);
    assert.ok(poolEntity, "GardenSignalPool entity should exist");
    assert.equal(poolEntity.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(poolEntity.garden, garden.toLowerCase());
    assert.equal(poolEntity.poolAddress, pool.toLowerCase());
    assert.equal(poolEntity.poolType, "HYPERCERT");
    assert.equal(poolEntity.communityAddress, community.toLowerCase());
    assert.equal(poolEntity.createdAt, 110000);
  });

  it("SignalPoolCreated maps pool types correctly", async () => {
    const poolTypeTests = [
      { value: 0, expected: "HYPERCERT" },
      { value: 1, expected: "ACTION" },
    ];

    for (const { value, expected } of poolTypeTests) {
      const mockDb = MockDb.createMockDb();
      const garden = createMockAddress(200 + value);
      const pool = createMockAddress(201 + value);

      const event = GardensModule.SignalPoolCreated.createMockEvent({
        garden,
        pool,
        poolType: value,
        community: createMockAddress(202 + value),
        mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 111000 + value, {
          txHash: createMockTxHash(60 + value),
          logIndex: 60 + value,
        }),
      });

      const result = await GardensModule.SignalPoolCreated.processEvent({ event, mockDb });
      const poolEntity = result.entities.GardenSignalPool.get(
        `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${pool.toLowerCase()}`
      );

      assert.ok(poolEntity, `Pool for type ${expected} should exist`);
      assert.equal(poolEntity.poolType, expected, `Pool type should be ${expected}`);
    }
  });

  it("SignalPoolCreated is idempotent — skips duplicate pool", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(210);
    const pool = createMockAddress(211);

    const event1 = GardensModule.SignalPoolCreated.createMockEvent({
      garden,
      pool,
      poolType: 0,
      community: createMockAddress(212),
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 112000, {
        txHash: createMockTxHash(70),
        logIndex: 70,
      }),
    });
    mockDb = await GardensModule.SignalPoolCreated.processEvent({ event: event1, mockDb });

    const event2 = GardensModule.SignalPoolCreated.createMockEvent({
      garden,
      pool,
      poolType: 1,
      community: createMockAddress(213),
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 113000, {
        txHash: createMockTxHash(71),
        logIndex: 71,
      }),
    });
    mockDb = await GardensModule.SignalPoolCreated.processEvent({ event: event2, mockDb });

    const entity = mockDb.entities.GardenSignalPool.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${pool.toLowerCase()}`
    );
    assert.ok(entity);
    // Original pool type should be preserved
    assert.equal(entity.poolType, "HYPERCERT");
  });

  it("GardenPowerRegistered updates existing GardenCommunity with source count", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(220);
    const community = createMockAddress(221);

    // First create a community
    const createEvent = GardensModule.CommunityCreated.createMockEvent({
      garden,
      community,
      weightScheme: 1,
      goodsToken: createMockAddress(223),
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 120000, {
        txHash: createMockTxHash(80),
        logIndex: 80,
      }),
    });
    mockDb = await GardensModule.CommunityCreated.processEvent({ event: createEvent, mockDb });

    // Then register garden power
    const registerEvent = GardensModule.GardenPowerRegistered.createMockEvent({
      garden,
      weightScheme: 1,
      sourceCount: 3n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 121000, {
        txHash: createMockTxHash(81),
        logIndex: 81,
      }),
    });
    mockDb = await GardensModule.GardenPowerRegistered.processEvent({
      event: registerEvent,
      mockDb,
    });

    const communityEntity = mockDb.entities.GardenCommunity.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(communityEntity);
    assert.equal(communityEntity.powerSourceCount, 3);
    // Other fields should remain unchanged
    assert.equal(communityEntity.weightScheme, "EXPONENTIAL");
    assert.equal(communityEntity.communityAddress, community.toLowerCase());
  });

  it("GardenPowerRegistered is safe when no community exists", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(230);

    const event = GardensModule.GardenPowerRegistered.createMockEvent({
      garden,
      weightScheme: 0,
      sourceCount: 3n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 130000, {
        txHash: createMockTxHash(90),
        logIndex: 90,
      }),
    });

    // Should not throw — handler has an if-guard on existingCommunity
    mockDb = await GardensModule.GardenPowerRegistered.processEvent({ event, mockDb });

    const communityEntity = mockDb.entities.GardenCommunity.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.equal(communityEntity, undefined);
  });

  it("GoodsAirdropped creates GoodsAirdrop entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = createMockAddress(240);

    const event = GardensModule.GoodsAirdropped.createMockEvent({
      garden,
      totalAmount: 5000n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 140000, {
        txHash: createMockTxHash(100),
        logIndex: 100,
      }),
    });

    const result = await GardensModule.GoodsAirdropped.processEvent({ event, mockDb });

    const expectedId = `${CHAIN_ID_ARBITRUM}-${createMockTxHash(100)}-100`;
    const airdropEntity = result.entities.GoodsAirdrop.get(expectedId);
    assert.ok(airdropEntity, "GoodsAirdrop entity should exist");
    assert.equal(airdropEntity.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(airdropEntity.garden, garden.toLowerCase());
    assert.equal(airdropEntity.totalAmount, 5000n);
    assert.equal(airdropEntity.txHash, createMockTxHash(100));
    assert.equal(airdropEntity.timestamp, 140000);
  });

  it("GardenTreasurySeeded creates GardenTreasury entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = createMockAddress(250);

    const event = GardensModule.GardenTreasurySeeded.createMockEvent({
      garden,
      amount: 1000n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 150000, {
        txHash: createMockTxHash(110),
        logIndex: 110,
      }),
    });

    const result = await GardensModule.GardenTreasurySeeded.processEvent({ event, mockDb });

    const expectedId = `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`;
    const treasuryEntity = result.entities.GardenTreasury.get(expectedId);
    assert.ok(treasuryEntity, "GardenTreasury entity should exist");
    assert.equal(treasuryEntity.chainId, CHAIN_ID_ARBITRUM);
    assert.equal(treasuryEntity.garden, garden.toLowerCase());
    assert.equal(treasuryEntity.totalSeeded, 1000n);
    assert.equal(treasuryEntity.lastSeededAt, 150000);
  });

  it("GardenTreasurySeeded accumulates totalSeeded across multiple events", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(260);

    const event1 = GardensModule.GardenTreasurySeeded.createMockEvent({
      garden,
      amount: 500n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 160000, {
        txHash: createMockTxHash(120),
        logIndex: 120,
      }),
    });
    mockDb = await GardensModule.GardenTreasurySeeded.processEvent({ event: event1, mockDb });

    const event2 = GardensModule.GardenTreasurySeeded.createMockEvent({
      garden,
      amount: 300n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 161000, {
        txHash: createMockTxHash(121),
        logIndex: 121,
      }),
    });
    mockDb = await GardensModule.GardenTreasurySeeded.processEvent({ event: event2, mockDb });

    const treasuryEntity = mockDb.entities.GardenTreasury.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(treasuryEntity);
    assert.equal(treasuryEntity.totalSeeded, 800n);
    assert.equal(treasuryEntity.lastSeededAt, 161000);
  });

  it("Full GardensModule lifecycle: community, pool, power registration, airdrop, treasury", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = createMockAddress(270);
    const community = createMockAddress(271);
    const pool = createMockAddress(272);
    const goodsToken = createMockAddress(274);

    // Step 1: Create community
    const communityEvent = GardensModule.CommunityCreated.createMockEvent({
      garden,
      community,
      weightScheme: 2,
      goodsToken,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 200000, {
        txHash: createMockTxHash(130),
        logIndex: 130,
      }),
    });
    mockDb = await GardensModule.CommunityCreated.processEvent({
      event: communityEvent,
      mockDb,
    });

    // Step 2: Create signal pool
    const poolEvent = GardensModule.SignalPoolCreated.createMockEvent({
      garden,
      pool,
      poolType: 1,
      community,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 200001, {
        txHash: createMockTxHash(131),
        logIndex: 131,
      }),
    });
    mockDb = await GardensModule.SignalPoolCreated.processEvent({ event: poolEvent, mockDb });

    // Step 3: Register garden power
    const registryEvent = GardensModule.GardenPowerRegistered.createMockEvent({
      garden,
      weightScheme: 2,
      sourceCount: 3n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 200002, {
        txHash: createMockTxHash(132),
        logIndex: 132,
      }),
    });
    mockDb = await GardensModule.GardenPowerRegistered.processEvent({
      event: registryEvent,
      mockDb,
    });

    // Step 4: Airdrop GOODS
    const airdropEvent = GardensModule.GoodsAirdropped.createMockEvent({
      garden,
      totalAmount: 10000n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 200003, {
        txHash: createMockTxHash(133),
        logIndex: 133,
      }),
    });
    mockDb = await GardensModule.GoodsAirdropped.processEvent({ event: airdropEvent, mockDb });

    // Step 5: Seed treasury
    const treasuryEvent = GardensModule.GardenTreasurySeeded.createMockEvent({
      garden,
      amount: 2000n,
      mockEventData: createMockBlockData(CHAIN_ID_ARBITRUM, 200004, {
        txHash: createMockTxHash(134),
        logIndex: 134,
      }),
    });
    mockDb = await GardensModule.GardenTreasurySeeded.processEvent({
      event: treasuryEvent,
      mockDb,
    });

    // Verify all entities
    const communityEntity = mockDb.entities.GardenCommunity.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(communityEntity, "Community should exist");
    assert.equal(communityEntity.weightScheme, "POWER");
    assert.equal(communityEntity.powerSourceCount, 3);

    const poolEntity = mockDb.entities.GardenSignalPool.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}-${pool.toLowerCase()}`
    );
    assert.ok(poolEntity, "Signal pool should exist");
    assert.equal(poolEntity.poolType, "ACTION");

    const airdropEntity = mockDb.entities.GoodsAirdrop.get(
      `${CHAIN_ID_ARBITRUM}-${createMockTxHash(133)}-133`
    );
    assert.ok(airdropEntity, "Airdrop should exist");
    assert.equal(airdropEntity.totalAmount, 10000n);

    const treasuryEntity = mockDb.entities.GardenTreasury.get(
      `${CHAIN_ID_ARBITRUM}-${garden.toLowerCase()}`
    );
    assert.ok(treasuryEntity, "Treasury should exist");
    assert.equal(treasuryEntity.totalSeeded, 2000n);
  });
});
