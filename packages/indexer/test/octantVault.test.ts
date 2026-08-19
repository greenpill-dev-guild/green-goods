import assert from "assert";
import { Addresses, createTestIndexer, OctantModule, OctantVault, processEvents } from "./v3";

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
    srcAddress: opts.srcAddress,
    transaction: { hash: opts.txHash ?? txHash(timestamp) },
    logIndex: opts.logIndex,
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
  it("registers the created OctantVault for dynamic discovery", async () => {
    const mockDb = await seedVault(createTestIndexer());

    assert.ok(
      mockDb.chains[CHAIN_ID].OctantVault.addresses.some(
        (address) => address.toLowerCase() === VAULT.toLowerCase()
      )
    );
  });

  it("creates GardenVault entity", async () => {
    const mockDb = await seedVault(createTestIndexer());
    const vault = await mockDb.GardenVault.get(vaultId());

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
    const mockDb = await seedVault(createTestIndexer());
    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = await mockDb.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.garden, GARDEN.toLowerCase());
    assert.ok(index.assets.includes(ASSET.toLowerCase()));
  });

  it("creates VaultAddressIndex for reverse lookup", async () => {
    const mockDb = await seedVault(createTestIndexer());
    const indexId = `${CHAIN_ID}-${VAULT.toLowerCase()}`;
    const vaultIndex = await mockDb.VaultAddressIndex.get(indexId);

    assert.ok(vaultIndex);
    assert.equal(vaultIndex.garden, GARDEN.toLowerCase());
    assert.equal(vaultIndex.asset, ASSET.toLowerCase());
    assert.equal(vaultIndex.vaultAddress, VAULT.toLowerCase());
  });

  it("does not duplicate assets in GardenVaultIndex", async () => {
    let mockDb = await seedVault(createTestIndexer());

    // Create same vault again (should not duplicate asset)
    const event = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: VAULT,
      asset: ASSET,
      mockEventData: mockEvent(CHAIN_ID, 2000, { txHash: txHash(200), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event, mockDb });

    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = await mockDb.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.assets.length, 1);
  });

  it("adds second asset to existing GardenVaultIndex", async () => {
    let mockDb = await seedVault(createTestIndexer());
    const secondAsset = addr(23);

    const event = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: addr(24),
      asset: secondAsset,
      mockEventData: mockEvent(CHAIN_ID, 2000, { txHash: txHash(200), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event, mockDb });

    const indexId = `${CHAIN_ID}-${GARDEN.toLowerCase()}`;
    const index = await mockDb.GardenVaultIndex.get(indexId);

    assert.ok(index);
    assert.equal(index.assets.length, 2);
  });
});

// ============================================================================
// DEPOSITS
// ============================================================================

describe("OctantVault.Deposit", () => {
  it("creates deposit record and updates vault totals", async () => {
    let mockDb = await seedVault(createTestIndexer());

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

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalDeposited, 100n);
    assert.equal(vault.depositorCount, 1);
  });

  it("accumulates deposits from same depositor", async () => {
    let mockDb = await seedVault(createTestIndexer());

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
    mockDb = await processEvents(mockDb, [event1, event2]);

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const deposit = await mockDb.VaultDeposit.get(depositId);

    assert.ok(deposit);
    assert.equal(deposit.shares, 150n);
    assert.equal(deposit.totalDeposited, 150n);

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalDeposited, 150n);
    assert.equal(vault.depositorCount, 1); // Same depositor, count stays 1
  });

  it("increments depositor count for new depositors", async () => {
    let mockDb = await seedVault(createTestIndexer());

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
    mockDb = await processEvents(mockDb, [deposit1, deposit2]);

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.depositorCount, 2);
  });

  it("does not increment depositor count for zero-share deposits", async () => {
    let mockDb = await seedVault(createTestIndexer());

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

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.depositorCount, 0);
  });

  it("creates VaultEvent with DEPOSIT type", async () => {
    let mockDb = await seedVault(createTestIndexer());
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

    const vaultEvent = await mockDb.VaultEvent.get(`${CHAIN_ID}-${tx}-5`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "DEPOSIT");
    assert.equal(vaultEvent.amount, 100n);
    assert.equal(vaultEvent.shares, 100n);
    assert.equal(vaultEvent.actor, addr(30).toLowerCase());
    assert.equal(vaultEvent.garden, GARDEN.toLowerCase());
  });

  it("ignores deposit when vault address not indexed", async () => {
    const mockDb = createTestIndexer(); // No vault setup

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

    // Envio rejects an event whose address is not indexed rather than silently
    // skipping it, so the guarantee is now enforced before the handler runs.
    await assert.rejects(
      () => OctantVault.Deposit.processEvent({ event, mockDb }),
      /never reached a handler/
    );
    assert.equal(await mockDb.GardenVault.get(vaultId()), undefined);
  });
});

// ============================================================================
// WITHDRAWALS
// ============================================================================

describe("OctantVault.Withdraw", () => {
  it("tracks withdrawals and updates vault totals", async () => {
    let mockDb = await seedVault(createTestIndexer());

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
    mockDb = await processEvents(mockDb, [deposit, withdraw]);

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalWithdrawn, 40n);

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const depositRecord = await mockDb.VaultDeposit.get(depositId);
    assert.ok(depositRecord);
    assert.equal(depositRecord.shares, 60n); // 100 - 40
    assert.equal(depositRecord.totalWithdrawn, 40n);
  });

  it("clamps shares to zero when over-withdrawing", async () => {
    let mockDb = await seedVault(createTestIndexer());

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
    mockDb = await processEvents(mockDb, [deposit, withdraw]);

    const depositId = `${CHAIN_ID}-${VAULT.toLowerCase()}-${addr(31).toLowerCase()}`;
    const depositRecord = await mockDb.VaultDeposit.get(depositId);
    assert.ok(depositRecord);
    assert.equal(depositRecord.shares, 0n); // Clamped to 0
  });

  it("creates VaultEvent with WITHDRAW type", async () => {
    let mockDb = await seedVault(createTestIndexer());
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
    mockDb = await processEvents(mockDb, [deposit, withdraw]);

    const vaultEvent = await mockDb.VaultEvent.get(`${CHAIN_ID}-${tx}-3`);
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
    let mockDb = await seedVault(createTestIndexer());

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 1);
  });

  it("increments harvest count multiple times", async () => {
    let mockDb = await seedVault(createTestIndexer());

    for (let i = 0; i < 3; i++) {
      const event = OctantModule.HarvestTriggered.createMockEvent({
        garden: GARDEN,
        asset: ASSET,
        caller: addr(25),
        mockEventData: mockEvent(CHAIN_ID, 3000 + i, { txHash: txHash(300 + i), logIndex: 1 }),
      });
      mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });
    }

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 3);
  });

  it("creates VaultEvent with HARVEST type", async () => {
    let mockDb = await seedVault(createTestIndexer());
    const tx = txHash(300);

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: tx, logIndex: 2 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vaultEvent = await mockDb.VaultEvent.get(`${CHAIN_ID}-${tx}-2`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "HARVEST");
    assert.equal(vaultEvent.amount, undefined);
    assert.equal(vaultEvent.shares, undefined);
    assert.equal(vaultEvent.actor, addr(25).toLowerCase());
  });

  it("creates default vault when vault not found", async () => {
    let mockDb = createTestIndexer();

    const event = OctantModule.HarvestTriggered.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event, mockDb });

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.totalHarvestCount, 1);
  });
});

describe("OctantModule.EmergencyPaused", () => {
  it("sets paused flag to true", async () => {
    let mockDb = await seedVault(createTestIndexer());

    const event = OctantModule.EmergencyPaused.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: txHash(300), logIndex: 1 }),
    });
    mockDb = await OctantModule.EmergencyPaused.processEvent({ event, mockDb });

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.paused, true);
  });

  it("creates VaultEvent with EMERGENCY_PAUSED type", async () => {
    let mockDb = await seedVault(createTestIndexer());
    const tx = txHash(300);

    const event = OctantModule.EmergencyPaused.createMockEvent({
      garden: GARDEN,
      asset: ASSET,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 3000, { txHash: tx, logIndex: 4 }),
    });
    mockDb = await OctantModule.EmergencyPaused.processEvent({ event, mockDb });

    const vaultEvent = await mockDb.VaultEvent.get(`${CHAIN_ID}-${tx}-4`);
    assert.ok(vaultEvent);
    assert.equal(vaultEvent.eventType, "EMERGENCY_PAUSED");
  });
});

// ============================================================================
// DONATION ADDRESS UPDATED
// ============================================================================

describe("OctantModule.DonationAddressUpdated", () => {
  it("updates donationAddress on all vaults for the garden", async () => {
    let mockDb = await seedVault(createTestIndexer());

    const event = OctantModule.DonationAddressUpdated.createMockEvent({
      garden: GARDEN,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: txHash(400), logIndex: 1 }),
    });
    mockDb = await OctantModule.DonationAddressUpdated.processEvent({ event, mockDb });

    const vault = await mockDb.GardenVault.get(vaultId());
    assert.ok(vault);
    assert.equal(vault.donationAddress, addr(27).toLowerCase());
  });

  it("does nothing when GardenVaultIndex not found", async () => {
    const mockDb = createTestIndexer();

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
    let mockDb = await seedVault(createTestIndexer());
    const secondAsset = addr(23);
    const secondVault = addr(24);

    // Create second vault for same garden
    const createEvent = OctantModule.VaultCreated.createMockEvent({
      garden: GARDEN,
      vault: secondVault,
      asset: secondAsset,
      mockEventData: mockEvent(CHAIN_ID, 1500, { txHash: txHash(150), logIndex: 1 }),
    });
    // Update donation address
    const updateEvent = OctantModule.DonationAddressUpdated.createMockEvent({
      garden: GARDEN,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4000, { txHash: txHash(400), logIndex: 1 }),
    });
    mockDb = await processEvents(mockDb, [createEvent, updateEvent]);

    const vault1 = await mockDb.GardenVault.get(vaultId());
    const vault2 = await mockDb.GardenVault.get(
      `${CHAIN_ID}-${GARDEN.toLowerCase()}-${secondAsset.toLowerCase()}`
    );

    assert.ok(vault1);
    assert.ok(vault2);
    assert.equal(vault1.donationAddress, addr(27).toLowerCase());
    assert.equal(vault2.donationAddress, addr(27).toLowerCase());
  });
});
