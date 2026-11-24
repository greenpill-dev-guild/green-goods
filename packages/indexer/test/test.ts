import assert from "assert";
import { ActionRegistry, createTestIndexer, OctantModule, OctantVault, processEvents } from "./v3";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";

const CHAIN_ID = CHAINS.arbitrum;

describe("ActionRegistry retained surface", () => {
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
