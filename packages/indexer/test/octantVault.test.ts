import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, OctantModule, OctantVault } = TestHelpers;

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

const GARDEN = addr(20);
const ASSET = addr(21);
const VAULT = addr(22);

async function seedVault(mockDb: any) {
  const event = OctantModule.VaultCreated.createMockEvent({
    garden: GARDEN,
    vault: VAULT,
    asset: ASSET,
    mockEventData: mockEvent(CHAIN_ID, 1000, { txHash: txHash(100), logIndex: 1 }),
  });
  return OctantModule.VaultCreated.processEvent({ event, mockDb });
}

function vaultId() {
  return `${CHAIN_ID}-${GARDEN.toLowerCase()}-${ASSET.toLowerCase()}`;
}

// ============================================================================
// VAULT CREATION
// ============================================================================

describe("OctantModule.VaultCreated", () => {
  it("creates GardenVault entity", async () => {
    const mockDb = await seedVault(MockDb.createMockDb());
    const vault = mockDb.entities.GardenVault.get(vaultId());

    assert.ok(vault);
    assert.equal(vault.garden, GARDEN.toLowerCase());
    assert.equal(vault.asset, ASSET.toLowerCase());
    assert.equal(vault.vaultAddress, VAULT.toLowerCase());
    assert.equal(vault.totalDeposited, 0n);
    assert.equal(vault.totalWithdrawn, 0n);
    assert.equal(vault.totalHarvestCount, 0);
    assert.equal(vault.paused, false);
    assert.equal(vault.depositorCount, 0);
  });

  it("creates GardenVaultIndex with asset", async () => {
    const mockDb = await seedVault(MockDb.createMockDb());
    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = mockDb.entities.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.garden, GARDEN.toLowerCase());
    assert.ok(index.assets.includes(ASSET.toLowerCase()));
  });

  it("creates VaultAddressIndex for reverse lookup", async () => {
    const mockDb = await seedVault(MockDb.createMockDb());
    const indexId = `${CHAIN_ID}-${VAULT.toLowerCase()}`;
    const vaultIndex = mockDb.entities.VaultAddressIndex.get(indexId);

    assert.ok(vaultIndex);
    assert.equal(vaultIndex.garden, GARDEN.toLowerCase());
    assert.equal(vaultIndex.asset, ASSET.toLowerCase());
    assert.equal(vaultIndex.vaultAddress, VAULT.toLowerCase());
  });

  it("does not duplicate assets in GardenVaultIndex", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    // Create same vault again (should not duplicate asset)
    const event = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: VAULT,
      asset: ASSET,
      mockEventData: mockEvent(CHAIN_ID, 2000, { txHash: txHash(200), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event, mockDb });

    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = mockDb.entities.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.assets.length, 1);
  });

  it("adds second asset to existing GardenVaultIndex", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const secondAsset = addr(23);

    const event = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: addr(24),
      asset: secondAsset,
      mockEventData: mockEvent(CHAIN_ID, 2000, { txHash: txHash(200), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event, mockDb });

    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = mockDb.entities.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.assets.length, 2);
  });
});

// ============================================================================
// DEPOSITS
// ============================================================================

describe("OctantVault.Deposit", () => {
  it("creates deposit record and updates vault totals", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalDeposited, 100n);
    assert.equal(vault.depositorCount, 1);
  });

  it("accumulates deposits from same depositor", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event1 = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: event1, mockDb });

    const event2 = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 50n,
      shares: 50n,
      mockEventData: mockEvent(CHAIN_ID, 3000, {
        srcAddress: VAULT,
        txHash: txHash(300),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: event2, mockDb });

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const deposit = mockDb.entities.VaultDeposit.get(depositId);

    assert.ok(deposit);
    assert.equal(deposit.shares, 150n);
    assert.equal(deposit.totalDeposited, 150n);

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalDeposited, 150n);
    assert.equal(vault.depositorCount, 1); // Same depositor, count stays 1
  });

  it("increments depositor count for new depositors", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const deposit1 = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit1, mockDb });

    const deposit2 = OctantVault.Deposit.createMockEvent({
      sender: addr(32),
      owner: addr(33),
      assets: 50n,
      shares: 50n,
      mockEventData: mockEvent(CHAIN_ID, 3000, {
        srcAddress: VAULT,
        txHash: txHash(300),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit2, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.depositorCount, 2);
  });

  it("does not increment depositor count for zero-share deposits", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 0n,
      shares: 0n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.depositorCount, 0);
  });

  it("creates VaultEvent with DEPOSIT type", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const tx = txHash(200);

    const event = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: tx,
        logIndex: 5,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event, mockDb });

    const vaultEvent = mockDb.entities.VaultEvent.get(`${CHAIN_ID}-${tx}-5`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "DEPOSIT");
    assert.equal(vaultEvent.amount, 100n);
    assert.equal(vaultEvent.shares, 100n);
    assert.equal(vaultEvent.actor, addr(30).toLowerCase());
    assert.equal(vaultEvent.garden, GARDEN.toLowerCase());
  });

  it("ignores deposit when vault address not indexed", async () => {
    const mockDb = MockDb.createMockDb(); // No vault setup

    const event = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: addr(50), // Unknown vault
        txHash: txHash(200),
        logIndex: 1,
      }),
    });

    const result = await OctantVault.Deposit.processEvent({ event, mockDb });
    // Should not throw, just skip
    assert.equal(result.entities.GardenVault.get(vaultId()), undefined);
  });
});

// ============================================================================
// WITHDRAWALS
// ============================================================================

describe("OctantVault.Withdraw", () => {
  it("tracks withdrawals and updates vault totals", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    // Deposit first
    const deposit = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit, mockDb });

    // Withdraw
    const withdraw = OctantVault.Withdraw.createMockEvent({
      sender: addr(30),
      receiver: addr(31),
      owner: addr(31),
      assets: 40n,
      shares: 40n,
      mockEventData: mockEvent(CHAIN_ID, 3000, {
        srcAddress: VAULT,
        txHash: txHash(300),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event: withdraw, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalWithdrawn, 40n);

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const depositRecord = mockDb.entities.VaultDeposit.get(depositId);
    assert.ok(depositRecord);
    assert.equal(depositRecord.shares, 60n); // 100 - 40
    assert.equal(depositRecord.totalWithdrawn, 40n);
  });

  it("clamps shares to zero when over-withdrawing", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    // Deposit 50
    const deposit = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 50n,
      shares: 50n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit, mockDb });

    // Withdraw 100 (more than deposited)
    const withdraw = OctantVault.Withdraw.createMockEvent({
      sender: addr(30),
      receiver: addr(31),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 3000, {
        srcAddress: VAULT,
        txHash: txHash(300),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event: withdraw, mockDb });

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const depositRecord = mockDb.entities.VaultDeposit.get(depositId);
    assert.ok(depositRecord);
    assert.equal(depositRecord.shares, 0n); // Clamped to 0
  });

  it("creates VaultEvent with WITHDRAW type", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const tx = txHash(300);

    // Deposit first
    const deposit = OctantVault.Deposit.createMockEvent({
      sender: addr(30),
      owner: addr(31),
      assets: 100n,
      shares: 100n,
      mockEventData: mockEvent(CHAIN_ID, 2000, {
        srcAddress: VAULT,
        txHash: txHash(200),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit, mockDb });

    const withdraw = OctantVault.Withdraw.createMockEvent({
      sender: addr(30),
      receiver: addr(31),
      owner: addr(31),
      assets: 25n,
      shares: 25n,
      mockEventData: mockEvent(CHAIN_ID, 3000, {
        srcAddress: VAULT,
        txHash: tx,
        logIndex: 3,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event: withdraw, mockDb });

    const vaultEvent = mockDb.entities.VaultEvent.get(`${CHAIN_ID}-${tx}-3`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "WITHDRAW");
    assert.equal(vaultEvent.amount, 25n);
  });
});

// ============================================================================
// HARVEST + EMERGENCY PAUSE
// ============================================================================

describe("OctantModule.HarvestTriggered", () => {
  it("increments harvest count", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 1);
  });

  it("increments harvest count multiple times", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    for (let i = 0; i < 3; i++) {
      const event = OctantModule.HarvestTriggered.createMockEvent({
        garden: GARDEN,
        asset: ASSET,
        caller: addr(25),
        mockEventData: mockEvent(CHAIN_ID, 3000 + i, { txHash: txHash(300 + i), logIndex: 1 }),
      });
      mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });
    }

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 3);
  });

  it("creates VaultEvent with HARVEST type", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const tx = txHash(300);

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: tx, logIndex: 2 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vaultEvent = mockDb.entities.VaultEvent.get(`${CHAIN_ID}-${tx}-2`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "HARVEST");
    assert.equal(vaultEvent.amount, undefined);
    assert.equal(vaultEvent.shares, undefined);
    assert.equal(vaultEvent.actor, addr(25).toLowerCase());
  });

  it("creates default vault when vault not found", async () => {
    let mockDb = MockDb.createMockDb();

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 1);
  });
});

describe("OctantModule.EmergencyPaused", () => {
  it("sets paused flag to true", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event = OctantModule.EmergencyPaused.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.EmergencyPaused.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.paused, true);
  });

  it("creates VaultEvent with EMERGENCY_PAUSED type", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const tx = txHash(300);

    const event = OctantModule.EmergencyPaused.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: tx, logIndex: 4 }),
    });
    mockDb = await OctantModule.EmergencyPaused.processEvent({ event, mockDb });

    const vaultEvent = mockDb.entities.VaultEvent.get(`${CHAIN_ID}-${tx}-4`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "EMERGENCY_PAUSED");
  });
});

// ============================================================================
// DONATION ADDRESS UPDATED
// ============================================================================

describe("OctantModule.DonationAddressUpdated", () => {
  it("updates donationAddress on all vaults for the garden", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());

    const event = OctantModule.DonationAddressUpdated.createMockEvent({
      garden: GARDEN,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: txHash(400), logIndex: 1 }),
    });
    mockDb = await OctantModule.DonationAddressUpdated.processEvent({ event, mockDb });

    const vault = mockDb.entities.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.donationAddress, addr(27).toLowerCase());
  });

  it("does nothing when GardenVaultIndex not found", async () => {
    const mockDb = MockDb.createMockDb();

    const event = OctantModule.DonationAddressUpdated.createMockEvent({
      garden: addr(50),
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: txHash(400), logIndex: 1 }),
    });

    // Should not throw
    const result = await OctantModule.DonationAddressUpdated.processEvent({ event, mockDb });
    assert.ok(result); // Just verifying no crash
  });

  it("updates all assets for the same garden", async () => {
    let mockDb = await seedVault(MockDb.createMockDb());
    const secondAsset = addr(23);
    const secondVault = addr(24);

    // Create second vault for same garden
    const createEvent = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: secondVault,
      asset: secondAsset,
      mockEventData: mockEvent(CHAIN_ID, 1500, { txHash: txHash(150), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event: createEvent, mockDb });

    // Update donation address
    const updateEvent = OctantModule.DonationAddressUpdated.createMockEvent({
      garden: GARDEN,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: txHash(400), logIndex: 1 }),
    });
    mockDb = await OctantModule.DonationAddressUpdated.processEvent({ event: updateEvent, mockDb });

    const vault1 = mockDb.entities.GardenVault.get(vaultId());
    const vault2 = mockDb.entities.GardenVault.get(
      `${CHAIN_ID}-${GARDEN.toLowerCase()}-${secondAsset.toLowerCase()}`
    );

    assert.ok(vault1);
    assert.ok(vault2);
    assert.equal(vault1.donationAddress, addr(27).toLowerCase());
    assert.equal(vault2.donationAddress, addr(27).toLowerCase());
  });
});
