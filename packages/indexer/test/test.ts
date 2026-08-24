import assert from "assert";
import {
  ActionRegistry,
  createTestIndexer,
  GardenToken,
  OctantModule,
  OctantVault,
  processEvents,
} from "./v3";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";

const CHAIN_ID = CHAINS.arbitrum;

describe("ActionRegistry retained surface", () => {
  it("creates and updates actions", async () => {
    let mockDb = createTestIndexer();

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

    const updateEvent = ActionRegistry.ActionTitleUpdated.createMockEvent({
      owner: addr(1),
      actionUID: 123n,
      title: "Updated Action",
      mockEventData: mockEvent(CHAIN_ID, 1_001),
    });

    mockDb = await processEvents(mockDb, [createEvent, updateEvent]);

    const action = await mockDb.Action.get(`${CHAIN_ID}-123`);
    assert.ok(action);
    assert.equal(action.title, "Updated Action");
    assert.equal(action.domain, "WASTE");
  });

  it("stores GardenDomains bitmask expansions", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = addr(2);

    const event = ActionRegistry.GardenDomainsUpdated.createMockEvent({
      garden: gardenAddress,
      domainMask: 0x09,
      mockEventData: mockEvent(CHAIN_ID, 2_000),
    });

    const result = await ActionRegistry.GardenDomainsUpdated.processEvent({ event, mockDb });
    const domains = await result.GardenDomains.get(`${CHAIN_ID}-${gardenAddress.toLowerCase()}`);

    assert.ok(domains);
    assert.equal(domains.domainMask, 0x09);
    assert.deepEqual(domains.domains, ["SOLAR", "WASTE"]);
  });
});

describe("GardenToken retained surface", () => {
  it("mints gardens with role arrays initialized", async () => {
    const mockDb = createTestIndexer();
    const gardenAddress = addr(10);

    const event = GardenToken.GardenMinted.createMockEvent({
      tokenId: 1n,
      account: gardenAddress,
      name: "Community Garden",
      description: "Grow good things",
      location: "Earth",
      bannerImage: "ipfs://bafk-banner",
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 3_000),
    });

    const result = await GardenToken.GardenMinted.processEvent({ event, mockDb });
    const garden = await result.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Community Garden");
    assert.equal(garden.openJoining, true);
    assert.deepEqual(garden.operators, []);
  });
});

describe("Octant retained surface", () => {
  it("tracks vault creation, deposits, withdrawals, and governance events", async () => {
    let mockDb = createTestIndexer();
    const garden = addr(20);
    const asset = addr(21);
    const vault = addr(22);

    const created = OctantModule.VaultCreated.createMockEvent({
      garden,
      vault,
      asset,
      mockEventData: mockEvent(CHAIN_ID, 4_000, { txHash: txHash(400), logIndex: 1 }),
    });
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
    const harvest = OctantModule.HarvestTriggered.createMockEvent({
      garden,
      asset,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 4_300, { txHash: txHash(430), logIndex: 1 }),
    });
    const paused = OctantModule.EmergencyPaused.createMockEvent({
      garden,
      asset,
      caller: addr(25),
      mockEventData: mockEvent(CHAIN_ID, 4_400, { txHash: txHash(440), logIndex: 1 }),
    });
    const donationUpdated = OctantModule.DonationAddressUpdated.createMockEvent({
      garden,
      oldAddress: addr(26),
      newAddress: addr(27),
      mockEventData: mockEvent(CHAIN_ID, 4_500, { txHash: txHash(450), logIndex: 1 }),
    });
    mockDb = await processEvents(mockDb, [
      created,
      deposit,
      withdraw,
      harvest,
      paused,
      donationUpdated,
    ]);

    const vaultId = `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`;
    const vaultEntity = await mockDb.GardenVault.get(vaultId);

    assert.ok(vaultEntity);
    assert.equal(vaultEntity.totalDeposited, 10n);
    assert.equal(vaultEntity.totalWithdrawn, 3n);
    assert.equal(vaultEntity.totalHarvestCount, 1);
    assert.equal(vaultEntity.paused, true);
    assert.equal(vaultEntity.donationAddress, addr(27).toLowerCase());
  });
});
