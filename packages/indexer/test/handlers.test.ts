import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const {
  MockDb,
  Addresses,
  GardenAccount,
  HatsModule,
  YieldSplitter,
  HypercertMinter,
  CookieJarFactory,
} = TestHelpers;

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

describe("retained garden + role handlers", () => {
  it("creates a default garden on GardenAccount.NameUpdated", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);

    const event = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Indexer Garden",
      mockEventData: mockEvent(CHAIN_ID, 10_000, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.NameUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Indexer Garden");
    assert.equal(garden.chainId, CHAIN_ID);
  });

  it("adds and removes operators via Hats role grant/revoke", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(20);
    const operator = addr(21);

    mockDb = mockDb.entities.Garden.set({
      id: gardenAddress,
      chainId: CHAIN_ID,
      tokenAddress: addr(1),
      tokenID: 1n,
      name: "Garden",
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
      createdAt: 1,
      gapProjectUID: undefined,
    });

    const grantEvent = HatsModule.RoleGranted.createMockEvent({
      garden: gardenAddress,
      account: operator,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 11_000),
    });

    mockDb = await HatsModule.RoleGranted.processEvent({ event: grantEvent, mockDb });
    const grantedGarden = mockDb.entities.Garden.get(gardenAddress);
    assert.ok(grantedGarden?.operators.includes(operator.toLowerCase()));

    const revokeEvent = HatsModule.RoleRevoked.createMockEvent({
      garden: gardenAddress,
      account: operator,
      role: 2n,
      mockEventData: mockEvent(CHAIN_ID, 12_000),
    });

    mockDb = await HatsModule.RoleRevoked.processEvent({ event: revokeEvent, mockDb });
    const revokedGarden = mockDb.entities.Garden.get(gardenAddress);
    assert.equal(revokedGarden?.operators.includes(operator.toLowerCase()), false);
  });
});

describe("retained yield + hypercert handlers", () => {
  it("stores YieldSplit records as YieldAllocation", async () => {
    const mockDb = MockDb.createMockDb();

    const event = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(30),
      asset: addr(31),
      cookieJarAmount: 1n,
      fractionsAmount: 2n,
      juiceboxAmount: 3n,
      totalYield: 6n,
      mockEventData: mockEvent(CHAIN_ID, 20_000, { txHash: txHash(200), logIndex: 1 }),
    });

    const result = await YieldSplitter.YieldSplit.processEvent({ event, mockDb });
    const allocation = result.entities.YieldAllocation.get(`${CHAIN_ID}-${txHash(200)}-1`);

    assert.ok(allocation);
    assert.equal(allocation.totalAmount, 6n);
    assert.equal(allocation.garden, addr(30).toLowerCase());
  });

  it("keeps only minimal hypercert linkage fields from ClaimStored metadata", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        name: "Externalized title",
        description: "Externalized description",
        hidden_properties: {
          gardenId: addr(40).toLowerCase(),
          attestationRefs: [{ uid: "0xatt-1" }, { uid: "0xatt-2" }],
        },
      }),
    })) as unknown as typeof fetch;

    try {
      const mockDb = MockDb.createMockDb();

      const event = HypercertMinter.ClaimStored.createMockEvent({
        claimID: 999n,
        uri: "ipfs://bafk-test-metadata",
        totalUnits: 100n,
        mockEventData: mockEvent(CHAIN_ID, 30_000, { txHash: txHash(300), logIndex: 1 }),
      });

      const result = await HypercertMinter.ClaimStored.processEvent({ event, mockDb });
      const hypercert = result.entities.Hypercert.get(`${CHAIN_ID}-999`);

      assert.ok(hypercert);
      assert.equal(hypercert.garden, addr(40).toLowerCase());
      assert.equal(hypercert.attestationCount, 2);
      assert.deepEqual(hypercert.attestationUIDs, ["0xatt-1", "0xatt-2"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("campaign cookie jar factory handlers", () => {
  it("stores JarCreated candidates without requiring metadata on the create event", async () => {
    const mockDb = MockDb.createMockDb();
    const jarAddress = addr(50);
    const creator = addr(51);

    const event = CookieJarFactory.JarCreated.createMockEvent({
      jarAddress,
      creator,
      mockEventData: mockEvent(CHAIN_ID, 40_000, {
        srcAddress: addr(52),
        txHash: txHash(400),
      }),
    });

    const result = await CookieJarFactory.JarCreated.processEvent({ event, mockDb });
    const jar = result.entities.CampaignCookieJar.get(`${CHAIN_ID}-${jarAddress.toLowerCase()}`);

    assert.ok(jar);
    assert.equal(jar.jarAddress, jarAddress.toLowerCase());
    assert.equal(jar.creator, creator.toLowerCase());
    assert.equal(jar.isValidCampaign, false);
    assert.equal(jar.rawMetadata, "");
  });

  it("parses valid campaign metadata updates", async () => {
    const mockDb = MockDb.createMockDb();
    const jarAddress = addr(53);
    const metadata = JSON.stringify({
      kind: "green-goods.campaign-cookie-jar",
      version: 1,
      slug: "earth-week",
      title: "Earth Week Cookie Jar",
      sourceGardens: [addr(54), addr(54)],
      operatorPolicy: "one-operator-per-garden",
      extraAllowlist: [addr(55)],
      chainId: CHAIN_ID,
      createdAt: 1770000000,
    });

    const event = CookieJarFactory.MetadataUpdated.createMockEvent({
      jarAddress,
      metadata,
      mockEventData: mockEvent(CHAIN_ID, 41_000, {
        srcAddress: addr(52),
        txHash: txHash(410),
      }),
    });

    const result = await CookieJarFactory.MetadataUpdated.processEvent({ event, mockDb });
    const jar = result.entities.CampaignCookieJar.get(`${CHAIN_ID}-${jarAddress.toLowerCase()}`);

    assert.ok(jar);
    assert.equal(jar.slug, "earth-week");
    assert.equal(jar.title, "Earth Week Cookie Jar");
    assert.equal(jar.metadataKind, "green-goods.campaign-cookie-jar");
    assert.equal(jar.metadataVersion, 1);
    assert.equal(jar.isValidCampaign, true);
    assert.deepEqual(jar.sourceGardens, [addr(54).toLowerCase()]);
    assert.deepEqual(jar.extraAllowlist, [addr(55).toLowerCase()]);
    assert.equal(jar.metadataUpdatedAt, 41_000);
  });

  it("stores invalid metadata without classifying the jar as public", async () => {
    const mockDb = MockDb.createMockDb();
    const jarAddress = addr(56);

    const event = CookieJarFactory.MetadataUpdated.createMockEvent({
      jarAddress,
      metadata: JSON.stringify({ kind: "other", version: 1, slug: "test", title: "Test" }),
      mockEventData: mockEvent(CHAIN_ID, 42_000, {
        srcAddress: addr(52),
        txHash: txHash(420),
      }),
    });

    const result = await CookieJarFactory.MetadataUpdated.processEvent({ event, mockDb });
    const jar = result.entities.CampaignCookieJar.get(`${CHAIN_ID}-${jarAddress.toLowerCase()}`);

    assert.ok(jar);
    assert.equal(jar.isValidCampaign, false);
    assert.equal(jar.metadataKind, "other");
  });
});

describe("boundary assertions", () => {
  it("does not expose externalized entity stores in mock db", () => {
    const mockDb = MockDb.createMockDb();
    const entities = mockDb.entities as Record<string, unknown>;

    assert.equal(entities.CookieJar, undefined);
    assert.equal(entities.ENSRegistration, undefined);
    assert.equal(entities.MarketplaceOrder, undefined);
    assert.equal(entities.MarketplacePurchase, undefined);
    assert.equal(entities.PowerRegistryConfig, undefined);
    assert.equal(entities.PowerRegistryDeregistration, undefined);
    assert.equal(entities.GardenCommunity, undefined);
    assert.equal(entities.GardenSignalPool, undefined);
    assert.equal(entities.YieldAccumulation, undefined);
    assert.equal(entities.YieldFractionPurchase, undefined);
    assert.equal(entities.YieldCookieJarTransfer, undefined);
    assert.equal(entities.YieldJuiceboxPayment, undefined);
    assert.equal(entities.YieldStranded, undefined);
    assert.equal(entities.GardenHatTree, undefined);
    assert.equal(entities.PartialGrantFailure, undefined);
  });
});
