import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, ActionRegistry, GardenToken, OctantModule, OctantVault } = TestHelpers;

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

describe("ActionRegistry retained surface", () => {
  it("creates and updates actions", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(1),
      actionUID: 123n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Initial Action",
      slug: "waste.cleanup",
      instructions: "Do work",
      capitals: [0, 2],
      media: ["ipfs://bafk-media"],
      domain: 3,
      mockEventData: mockEvent(CHAIN_ID, 1_000),
    });

    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    const updateEvent = ActionRegistry.ActionTitleUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 123n,
      title: "Updated Action",
      mockEventData: mockEvent(CHAIN_ID, 1_001),
    });

    mockDb = await ActionRegistry.ActionTitleUpdated.processEvent({ event: updateEvent, mockDb });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-123`);
    assert.ok(action);
    assert.equal(action.title, "Updated Action");
    assert.equal(action.domain, "WASTE");
  });

  it("stores GardenDomains bitmask expansions", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(2);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x09,
      mockEventData: mockEvent(CHAIN_ID, 2_000),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const domains = result.entities.GardenDomains.get(`${CHAIN_ID}-${gardenAddress.toLowerCase()}`);

    assert.ok(domains);
    assert.equal(domains.domainMask, 0x09);
    assert.deepEqual(domains.domains, ["SOLAR", "WASTE"]);
  });
});

describe("GardenToken retained surface", () => {
  it("mints gardens with role arrays initialized", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Community Garden",
      description: "Grow good things",
      location: "Earth",
      bannerImage: "ipfs://bafk-banner",
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 3_000, { srcAddress: addr(11) }),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Community Garden");
    assert.equal(garden.openJoining, true);
    assert.deepEqual(garden.operators, []);
  });
});

describe("Octant retained surface", () => {
  it("tracks vault creation, deposits, withdrawals, and governance events", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = addr(20);
    const asset = addr(21);
    const vault = addr(22);

    const created = OctantModule.VaultCreated.createMockEvent({
      garden,
      vault,
      asset,
      mockEventData: mockEvent(CHAIN_ID, 4_000, { txHash: txHash(400), logIndex: 1 }),
    });
    mockDb = await OctantModule.VaultCreated.processEvent({ event: created, mockDb });

    const deposit = OctantVault.Deposit.createMockEvent({
      sender: addr(23),
      owner: addr(24),
      assets: 10n,
      shares: 10n,
      mockEventData: mockEvent(CHAIN_ID, 4_100, {
        srcAddress: vault,
        txHash: txHash(410),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Deposit.processEvent({ event: deposit, mockDb });

    const withdraw = OctantVault.Withdraw.createMockEvent({
      sender: addr(23),
      receiver: addr(24),
      owner: addr(24),
      assets: 3n,
      shares: 3n,
      mockEventData: mockEvent(CHAIN_ID, 4_200, {
        srcAddress: vault,
        txHash: txHash(420),
        logIndex: 1,
      }),
    });
    mockDb = await OctantVault.Withdraw.processEvent({ event: withdraw, mockDb });

    const harvest = OctantModule.HarvestTriggered.createMockEvent({
      garden,
      asset,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 4_300, { txHash: txHash(430), logIndex: 1 }),
    });
    mockDb = await OctantModule.HarvestTriggered.processEvent({ event: harvest, mockDb });

    const paused = OctantModule.EmergencyPaused.createMockEvent({
      garden,
      asset,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 4_400, { txHash: txHash(440), logIndex: 1 }),
    });
    mockDb = await OctantModule.EmergencyPaused.processEvent({ event: paused, mockDb });

    const donationUpdated = OctantModule.DonationAddressUpdated.createMockEvent({
      garden,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4_500, { txHash: txHash(450), logIndex: 1 }),
    });
    mockDb = await OctantModule.DonationAddressUpdated.processEvent({
      event: donationUpdated,
      mockDb,
    });

    const vaultId = `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`;
    const vaultEntity = mockDb.entities.GardenVault.get(vaultId);

    assert.ok(vaultEntity);
    assert.equal(vaultEntity.totalDeposited, 10n);
    assert.equal(vaultEntity.totalWithdrawn, 3n);
    assert.equal(vaultEntity.totalHarvestCount, 1);
    assert.equal(vaultEntity.paused, true);
    assert.equal(vaultEntity.donationAddress, addr(27).toLowerCase());
  });
});
