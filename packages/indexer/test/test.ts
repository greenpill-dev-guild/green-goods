// @ts-nocheck
import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, ActionRegistry, GardenToken, HatsModule, OctantModule, OctantVault } =
  TestHelpers;

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
