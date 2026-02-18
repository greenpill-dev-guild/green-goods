import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error: import.meta.url is valid at runtime (tsx loader) but tsconfig targets CommonJS
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const {
  MockDb,
  Addresses,
  ActionRegistry,
  GardenToken,
  GardenAccount,
  HatsModule,
  GreenGoodsENS,
  YieldSplitter,
  CookieJarModule,
  HypercertMarketplaceAdapter,
  UnifiedPowerRegistry,
} = TestHelpers;

const CHAIN_ID = 42161;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

/** Seed a Garden entity in the mock DB */
function seedGarden(
  mockDb: ReturnType<typeof MockDb.createMockDb>,
  gardenAddress: string,
  overrides: Record<string, unknown> = {}
) {
  return mockDb.entities.Garden.set({
    id: gardenAddress,
    chainId: CHAIN_ID,
    tokenAddress: addr(11),
    tokenID: 1n,
    name: "Test Garden",
    description: "A garden",
    location: "Earth",
    bannerImage: "banner.png",
    openJoining: false,
    gardeners: [],
    operators: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    createdAt: 10000,
    ...overrides,
  });
}

// ============================================================================
// GardenAccount Event Handlers
// ============================================================================

describe("GardenAccount NameUpdated", () => {
  it("updates garden name on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(10);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Updated Garden Name",
      mockEventData: mockEvent(CHAIN_ID, 20000, { srcAddress: gardenAddress }),
    });

    mockDb = await GardenAccount.NameUpdated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Updated Garden Name");
  });

  it("creates default garden if none exists", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(15);

    const event = GardenAccount.NameUpdated.createMockEvent({
      updater: addr(1),
      newName: "Brand New Garden",
      mockEventData: mockEvent(CHAIN_ID, 20001, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.NameUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.name, "Brand New Garden");
    assert.equal(garden.chainId, CHAIN_ID);
    assert.deepEqual(garden.gardeners, []);
  });
});

describe("GardenAccount DescriptionUpdated", () => {
  it("updates description on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(20);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GardenAccount.DescriptionUpdated.createMockEvent({
      updater: addr(1),
      newDescription: "New description text",
      mockEventData: mockEvent(CHAIN_ID, 20010, { srcAddress: gardenAddress }),
    });

    mockDb = await GardenAccount.DescriptionUpdated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "New description text");
    assert.equal(garden.name, "Test Garden"); // unchanged
  });

  it("creates default garden if none exists", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(21);

    const event = GardenAccount.DescriptionUpdated.createMockEvent({
      updater: addr(1),
      newDescription: "Description for new garden",
      mockEventData: mockEvent(CHAIN_ID, 20011, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.DescriptionUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.description, "Description for new garden");
  });
});

describe("GardenAccount LocationUpdated", () => {
  it("updates location on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(25);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GardenAccount.LocationUpdated.createMockEvent({
      updater: addr(1),
      newLocation: "Mars Colony",
      mockEventData: mockEvent(CHAIN_ID, 20020, { srcAddress: gardenAddress }),
    });

    mockDb = await GardenAccount.LocationUpdated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.location, "Mars Colony");
  });
});

describe("GardenAccount BannerImageUpdated", () => {
  it("updates banner image on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(30);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GardenAccount.BannerImageUpdated.createMockEvent({
      updater: addr(1),
      newBannerImage: "ipfs://QmNewBanner",
      mockEventData: mockEvent(CHAIN_ID, 20030, { srcAddress: gardenAddress }),
    });

    mockDb = await GardenAccount.BannerImageUpdated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.bannerImage, "ipfs://QmNewBanner");
  });
});

describe("GardenAccount GAPProjectCreated", () => {
  it("updates garden with GAP project UID when garden exists", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(35);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GardenAccount.GAPProjectCreated.createMockEvent({
      projectUID: "0xgap-project-uid-123",
      gardenAddress: gardenAddress,
      projectName: "Gap Project",
      mockEventData: mockEvent(CHAIN_ID, 20040),
    });

    mockDb = await GardenAccount.GAPProjectCreated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.gapProjectUID, "0xgap-project-uid-123");
    assert.equal(garden.name, "Test Garden"); // unchanged
  });

  it("does nothing when garden does not exist", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(36);

    const event = GardenAccount.GAPProjectCreated.createMockEvent({
      projectUID: "0xgap-project-uid-456",
      gardenAddress: gardenAddress,
      projectName: "Gap Project",
      mockEventData: mockEvent(CHAIN_ID, 20041),
    });

    const result = await GardenAccount.GAPProjectCreated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.equal(garden, undefined);
  });
});

describe("GardenAccount OpenJoiningUpdated", () => {
  it("toggles openJoining on existing garden", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(40);
    mockDb = seedGarden(mockDb, gardenAddress, { openJoining: false });

    const event = GardenAccount.OpenJoiningUpdated.createMockEvent({
      updater: addr(1),
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 20050, { srcAddress: gardenAddress }),
    });

    mockDb = await GardenAccount.OpenJoiningUpdated.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.openJoining, true);
  });

  it("does nothing when garden does not exist", async () => {
    const mockDb = MockDb.createMockDb();
    const gardenAddress = addr(41);

    const event = GardenAccount.OpenJoiningUpdated.createMockEvent({
      updater: addr(1),
      openJoining: true,
      mockEventData: mockEvent(CHAIN_ID, 20051, { srcAddress: gardenAddress }),
    });

    const result = await GardenAccount.OpenJoiningUpdated.processEvent({ event, mockDb });
    const garden = result.entities.Garden.get(gardenAddress);

    assert.equal(garden, undefined);
  });
});

// ============================================================================
// ActionRegistry Update Event Handlers
// ============================================================================

describe("ActionRegistry ActionStartTimeUpdated", () => {
  it("updates startTime on existing action", async () => {
    let mockDb = MockDb.createMockDb();

    // First create an action
    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(0),
      actionUID: 10n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Test Action",
      slug: "test.action",
      instructions: "Do it",
      capitals: [0],
      media: [],
      domain: 0,
      mockEventData: mockEvent(CHAIN_ID, 5000),
    });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    // Then update startTime
    const updateEvent = ActionRegistry.ActionStartTimeUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 10n,
      startTime: 5000n,
      mockEventData: mockEvent(CHAIN_ID, 6000),
    });
    mockDb = await ActionRegistry.ActionStartTimeUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-10`);
    assert.ok(action);
    assert.equal(action.startTime, 5000n);
    assert.equal(action.endTime, 2000n); // unchanged
  });

  it("does nothing for nonexistent action", async () => {
    const mockDb = MockDb.createMockDb();

    const event = ActionRegistry.ActionStartTimeUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 999n,
      startTime: 5000n,
      mockEventData: mockEvent(CHAIN_ID, 6001),
    });
    const result = await ActionRegistry.ActionStartTimeUpdated.processEvent({ event, mockDb });
    const action = result.entities.Action.get(`${CHAIN_ID}-999`);
    assert.equal(action, undefined);
  });
});

describe("ActionRegistry ActionEndTimeUpdated", () => {
  it("updates endTime on existing action", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(0),
      actionUID: 11n,
      startTime: 1000n,
      endTime: 2000n,
      title: "End Time Action",
      slug: "test.endtime",
      instructions: "Do it",
      capitals: [0],
      media: [],
      domain: 1,
      mockEventData: mockEvent(CHAIN_ID, 5010),
    });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    const updateEvent = ActionRegistry.ActionEndTimeUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 11n,
      endTime: 9000n,
      mockEventData: mockEvent(CHAIN_ID, 6010),
    });
    mockDb = await ActionRegistry.ActionEndTimeUpdated.processEvent({ event: updateEvent, mockDb });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-11`);
    assert.ok(action);
    assert.equal(action.endTime, 9000n);
    assert.equal(action.startTime, 1000n); // unchanged
  });
});

describe("ActionRegistry ActionTitleUpdated", () => {
  it("updates title on existing action", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(0),
      actionUID: 12n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Original Title",
      slug: "test.title",
      instructions: "Do it",
      capitals: [0],
      media: [],
      domain: 2,
      mockEventData: mockEvent(CHAIN_ID, 5020),
    });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    const updateEvent = ActionRegistry.ActionTitleUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 12n,
      title: "New Title",
      mockEventData: mockEvent(CHAIN_ID, 6020),
    });
    mockDb = await ActionRegistry.ActionTitleUpdated.processEvent({ event: updateEvent, mockDb });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-12`);
    assert.ok(action);
    assert.equal(action.title, "New Title");
    assert.equal(action.slug, "test.title"); // unchanged
  });
});

describe("ActionRegistry ActionInstructionsUpdated", () => {
  it("updates instructions on existing action", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(0),
      actionUID: 13n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Instructions Action",
      slug: "test.instructions",
      instructions: "Old instructions",
      capitals: [0],
      media: [],
      domain: 3,
      mockEventData: mockEvent(CHAIN_ID, 5030),
    });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    const updateEvent = ActionRegistry.ActionInstructionsUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 13n,
      instructions: "Updated instructions",
      mockEventData: mockEvent(CHAIN_ID, 6030),
    });
    mockDb = await ActionRegistry.ActionInstructionsUpdated.processEvent({
      event: updateEvent,
      mockDb,
    });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-13`);
    assert.ok(action);
    assert.equal(action.instructions, "Updated instructions");
  });
});

describe("ActionRegistry ActionMediaUpdated", () => {
  it("updates media on existing action", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = ActionRegistry.ActionRegistered.createMockEvent({
      owner: addr(0),
      actionUID: 14n,
      startTime: 1000n,
      endTime: 2000n,
      title: "Media Action",
      slug: "test.media",
      instructions: "Do it",
      capitals: [0],
      media: ["ipfs://old"],
      domain: 0,
      mockEventData: mockEvent(CHAIN_ID, 5040),
    });
    mockDb = await ActionRegistry.ActionRegistered.processEvent({ event: createEvent, mockDb });

    const updateEvent = ActionRegistry.ActionMediaUpdated.createMockEvent({
      owner: addr(0),
      actionUID: 14n,
      media: ["ipfs://new1", "ipfs://new2"],
      mockEventData: mockEvent(CHAIN_ID, 6040),
    });
    mockDb = await ActionRegistry.ActionMediaUpdated.processEvent({ event: updateEvent, mockDb });

    const action = mockDb.entities.Action.get(`${CHAIN_ID}-14`);
    assert.ok(action);
    assert.deepEqual(action.media, ["ipfs://new1", "ipfs://new2"]);
  });
});

// ============================================================================
// GreenGoodsENS Event Handlers
// ============================================================================

describe("GreenGoodsENS NameRegistrationSent", () => {
  it("creates ENSRegistration entity with pending status", async () => {
    const mockDb = MockDb.createMockDb();
    const owner = addr(50);

    const event = GreenGoodsENS.NameRegistrationSent.createMockEvent({
      messageId: "0xccip-msg-id-1",
      slug: "my-garden",
      owner: owner,
      nameType: 1n, // Garden
      ccipFee: 100000n,
      mockEventData: mockEvent(CHAIN_ID, 30000, { txHash: txHash(200) }),
    });

    const result = await GreenGoodsENS.NameRegistrationSent.processEvent({ event, mockDb });

    const registration = result.entities.ENSRegistration.get(`${CHAIN_ID}-my-garden`);
    assert.ok(registration);
    assert.equal(registration.slug, "my-garden");
    assert.equal(registration.owner, owner.toLowerCase());
    assert.equal(registration.nameType, "Garden");
    assert.equal(registration.status, "pending");
    assert.equal(registration.ccipMessageId, "0xccip-msg-id-1");
    assert.equal(registration.ccipFee, 100000n);
    assert.equal(registration.registeredAt, 30000);
  });

  it("maps Gardener nameType correctly", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GreenGoodsENS.NameRegistrationSent.createMockEvent({
      messageId: "0xccip-msg-id-2",
      slug: "my-name",
      owner: addr(51),
      nameType: 0n, // Gardener
      ccipFee: 50000n,
      mockEventData: mockEvent(CHAIN_ID, 30010, { txHash: txHash(201) }),
    });

    const result = await GreenGoodsENS.NameRegistrationSent.processEvent({ event, mockDb });
    const registration = result.entities.ENSRegistration.get(`${CHAIN_ID}-my-name`);

    assert.ok(registration);
    assert.equal(registration.nameType, "Gardener");
  });

  it("updates Garden entity with slug and ensStatus for Garden type", async () => {
    let mockDb = MockDb.createMockDb();
    const gardenAddress = addr(52);
    mockDb = seedGarden(mockDb, gardenAddress);

    const event = GreenGoodsENS.NameRegistrationSent.createMockEvent({
      messageId: "0xccip-msg-id-3",
      slug: "garden-slug",
      owner: gardenAddress,
      nameType: 1n, // Garden
      ccipFee: 75000n,
      mockEventData: mockEvent(CHAIN_ID, 30020, { txHash: txHash(202) }),
    });

    mockDb = await GreenGoodsENS.NameRegistrationSent.processEvent({ event, mockDb });
    const garden = mockDb.entities.Garden.get(gardenAddress);

    assert.ok(garden);
    assert.equal(garden.slug, "garden-slug");
    assert.equal(garden.ensStatus, "pending");
  });
});

describe("GreenGoodsENS NameReleaseSent", () => {
  it("updates existing ENSRegistration status to released", async () => {
    let mockDb = MockDb.createMockDb();
    const owner = addr(55);

    // First register
    const regEvent = GreenGoodsENS.NameRegistrationSent.createMockEvent({
      messageId: "0xccip-msg-id-10",
      slug: "released-name",
      owner: owner,
      nameType: 0n,
      ccipFee: 100000n,
      mockEventData: mockEvent(CHAIN_ID, 31000, { txHash: txHash(210) }),
    });
    mockDb = await GreenGoodsENS.NameRegistrationSent.processEvent({ event: regEvent, mockDb });

    // Then release
    const releaseEvent = GreenGoodsENS.NameReleaseSent.createMockEvent({
      messageId: "0xccip-release-id-1",
      slug: "released-name",
      previousOwner: owner,
      mockEventData: mockEvent(CHAIN_ID, 32000, { txHash: txHash(211) }),
    });
    mockDb = await GreenGoodsENS.NameReleaseSent.processEvent({ event: releaseEvent, mockDb });

    const registration = mockDb.entities.ENSRegistration.get(`${CHAIN_ID}-released-name`);
    assert.ok(registration);
    assert.equal(registration.status, "released");
    assert.equal(registration.ccipMessageId, "0xccip-release-id-1");
  });

  it("is safe when no prior registration exists", async () => {
    const mockDb = MockDb.createMockDb();

    const event = GreenGoodsENS.NameReleaseSent.createMockEvent({
      messageId: "0xccip-release-orphan",
      slug: "never-registered",
      previousOwner: addr(56),
      mockEventData: mockEvent(CHAIN_ID, 33000, { txHash: txHash(212) }),
    });

    // Should not throw
    const result = await GreenGoodsENS.NameReleaseSent.processEvent({ event, mockDb });
    const registration = result.entities.ENSRegistration.get(`${CHAIN_ID}-never-registered`);
    assert.equal(registration, undefined);
  });
});

// ============================================================================
// YieldSplitter Event Handlers
// ============================================================================

describe("YieldSplitter YieldSplit", () => {
  it("creates YieldAllocation entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(60);
    const asset = addr(61);

    const event = YieldSplitter.YieldSplit.createMockEvent({
      garden: garden,
      asset: asset,
      cookieJarAmount: 300n,
      fractionsAmount: 500n,
      juiceboxAmount: 200n,
      totalYield: 1000n,
      mockEventData: mockEvent(CHAIN_ID, 40000, { txHash: txHash(300), logIndex: 1 }),
    });

    const result = await YieldSplitter.YieldSplit.processEvent({ event, mockDb });

    const allocation = result.entities.YieldAllocation.get(`${CHAIN_ID}-${txHash(300)}-1`);
    assert.ok(allocation);
    assert.equal(allocation.garden, garden.toLowerCase());
    assert.equal(allocation.asset, asset.toLowerCase());
    assert.equal(allocation.cookieJarAmount, 300n);
    assert.equal(allocation.fractionsAmount, 500n);
    assert.equal(allocation.juiceboxAmount, 200n);
    assert.equal(allocation.totalAmount, 1000n);
    assert.equal(allocation.timestamp, 40000);
  });
});

describe("YieldSplitter YieldAccumulated", () => {
  it("creates YieldAccumulation entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(62);
    const asset = addr(63);

    const event = YieldSplitter.YieldAccumulated.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 50n,
      totalPending: 150n,
      mockEventData: mockEvent(CHAIN_ID, 40010),
    });

    const result = await YieldSplitter.YieldAccumulated.processEvent({ event, mockDb });

    const accumulation = result.entities.YieldAccumulation.get(
      `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.ok(accumulation);
    assert.equal(accumulation.pendingAmount, 150n);
    assert.equal(accumulation.lastAccumulatedAt, 40010);
  });

  it("overwrites previous accumulation for same garden+asset", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = addr(64);
    const asset = addr(65);

    const event1 = YieldSplitter.YieldAccumulated.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 50n,
      totalPending: 50n,
      mockEventData: mockEvent(CHAIN_ID, 40020),
    });
    mockDb = await YieldSplitter.YieldAccumulated.processEvent({ event: event1, mockDb });

    const event2 = YieldSplitter.YieldAccumulated.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 100n,
      totalPending: 150n,
      mockEventData: mockEvent(CHAIN_ID, 40021),
    });
    mockDb = await YieldSplitter.YieldAccumulated.processEvent({ event: event2, mockDb });

    const accumulation = mockDb.entities.YieldAccumulation.get(
      `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.ok(accumulation);
    assert.equal(accumulation.pendingAmount, 150n);
    assert.equal(accumulation.lastAccumulatedAt, 40021);
  });
});

describe("YieldSplitter FractionPurchased", () => {
  it("creates YieldFractionPurchase entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(66);
    const treasury = addr(67);

    const event = YieldSplitter.FractionPurchased.createMockEvent({
      garden: garden,
      hypercertId: 42n,
      amount: 500n,
      fractionId: 7n,
      treasury: treasury,
      mockEventData: mockEvent(CHAIN_ID, 40030, { txHash: txHash(310), logIndex: 2 }),
    });

    const result = await YieldSplitter.FractionPurchased.processEvent({ event, mockDb });

    const purchase = result.entities.YieldFractionPurchase.get(`${CHAIN_ID}-${txHash(310)}-2-42`);
    assert.ok(purchase);
    assert.equal(purchase.garden, garden.toLowerCase());
    assert.equal(purchase.hypercertId, 42n);
    assert.equal(purchase.amount, 500n);
    assert.equal(purchase.fractionId, 7n);
    assert.equal(purchase.treasury, treasury.toLowerCase());
  });

  it("sets fractionId to undefined when zero", async () => {
    const mockDb = MockDb.createMockDb();

    const event = YieldSplitter.FractionPurchased.createMockEvent({
      garden: addr(68),
      hypercertId: 43n,
      amount: 100n,
      fractionId: 0n,
      treasury: addr(69),
      mockEventData: mockEvent(CHAIN_ID, 40031, { txHash: txHash(311), logIndex: 3 }),
    });

    const result = await YieldSplitter.FractionPurchased.processEvent({ event, mockDb });
    const purchase = result.entities.YieldFractionPurchase.get(`${CHAIN_ID}-${txHash(311)}-3-43`);
    assert.ok(purchase);
    assert.equal(purchase.fractionId, undefined);
  });
});

describe("YieldSplitter YieldToCookieJar", () => {
  it("creates YieldCookieJarTransfer entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(70);
    const asset = addr(71);
    const jar = addr(72);

    const event = YieldSplitter.YieldToCookieJar.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 250n,
      jar: jar,
      mockEventData: mockEvent(CHAIN_ID, 40040, { txHash: txHash(320), logIndex: 4 }),
    });

    const result = await YieldSplitter.YieldToCookieJar.processEvent({ event, mockDb });

    const transfer = result.entities.YieldCookieJarTransfer.get(`${CHAIN_ID}-${txHash(320)}-4`);
    assert.ok(transfer);
    assert.equal(transfer.garden, garden.toLowerCase());
    assert.equal(transfer.asset, asset.toLowerCase());
    assert.equal(transfer.amount, 250n);
    assert.equal(transfer.jar, jar.toLowerCase());
  });
});

describe("YieldSplitter YieldToJuicebox", () => {
  it("creates YieldJuiceboxPayment entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(73);
    const asset = addr(74);

    const event = YieldSplitter.YieldToJuicebox.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 1000n,
      projectId: 42n,
      mockEventData: mockEvent(CHAIN_ID, 40050, { txHash: txHash(330), logIndex: 5 }),
    });

    const result = await YieldSplitter.YieldToJuicebox.processEvent({ event, mockDb });

    const payment = result.entities.YieldJuiceboxPayment.get(`${CHAIN_ID}-${txHash(330)}-5`);
    assert.ok(payment);
    assert.equal(payment.garden, garden.toLowerCase());
    assert.equal(payment.asset, asset.toLowerCase());
    assert.equal(payment.amount, 1000n);
    assert.equal(payment.projectId, 42n);
  });
});

describe("YieldSplitter YieldStranded", () => {
  it("creates YieldStranded entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(75);
    const asset = addr(76);

    const event = YieldSplitter.YieldStranded.createMockEvent({
      garden: garden,
      asset: asset,
      amount: 500n,
      destination: "no-cookie-jar-configured",
      mockEventData: mockEvent(CHAIN_ID, 40060, { txHash: txHash(340), logIndex: 6 }),
    });

    const result = await YieldSplitter.YieldStranded.processEvent({ event, mockDb });

    const stranded = result.entities.YieldStranded.get(`${CHAIN_ID}-${txHash(340)}-6`);
    assert.ok(stranded);
    assert.equal(stranded.garden, garden.toLowerCase());
    assert.equal(stranded.asset, asset.toLowerCase());
    assert.equal(stranded.amount, 500n);
    assert.equal(stranded.destination, "no-cookie-jar-configured");
  });
});

// ============================================================================
// CookieJarModule Event Handlers
// ============================================================================

describe("CookieJarModule JarCreated", () => {
  it("creates CookieJar entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(80);
    const asset = addr(81);
    const jar = addr(82);

    const event = CookieJarModule.JarCreated.createMockEvent({
      garden: garden,
      asset: asset,
      jar: jar,
      mockEventData: mockEvent(CHAIN_ID, 50000),
    });

    const result = await CookieJarModule.JarCreated.processEvent({ event, mockDb });

    const cookieJar = result.entities.CookieJar.get(
      `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.ok(cookieJar);
    assert.equal(cookieJar.garden, garden.toLowerCase());
    assert.equal(cookieJar.asset, asset.toLowerCase());
    assert.equal(cookieJar.jarAddress, jar.toLowerCase());
    assert.equal(cookieJar.createdAt, 50000);
  });

  it("is idempotent — skips duplicate creation", async () => {
    let mockDb = MockDb.createMockDb();
    const garden = addr(83);
    const asset = addr(84);
    const jarA = addr(85);
    const jarB = addr(86);

    const event1 = CookieJarModule.JarCreated.createMockEvent({
      garden: garden,
      asset: asset,
      jar: jarA,
      mockEventData: mockEvent(CHAIN_ID, 50010),
    });
    mockDb = await CookieJarModule.JarCreated.processEvent({ event: event1, mockDb });

    const event2 = CookieJarModule.JarCreated.createMockEvent({
      garden: garden,
      asset: asset,
      jar: jarB,
      mockEventData: mockEvent(CHAIN_ID, 50020),
    });
    mockDb = await CookieJarModule.JarCreated.processEvent({ event: event2, mockDb });

    const cookieJar = mockDb.entities.CookieJar.get(
      `${CHAIN_ID}-${garden.toLowerCase()}-${asset.toLowerCase()}`
    );
    assert.ok(cookieJar);
    assert.equal(cookieJar.jarAddress, jarA.toLowerCase()); // original preserved
  });
});

// ============================================================================
// HypercertMarketplaceAdapter Event Handlers
// ============================================================================

describe("HypercertMarketplaceAdapter OrderRegistered", () => {
  it("creates MarketplaceOrder entity", async () => {
    const mockDb = MockDb.createMockDb();
    const seller = addr(90);
    const currency = addr(91);

    const event = HypercertMarketplaceAdapter.OrderRegistered.createMockEvent({
      orderId: 1n,
      hypercertId: 100n,
      seller: seller,
      currency: currency,
      pricePerUnit: 1000000n,
      endTime: 9999999n,
      mockEventData: mockEvent(CHAIN_ID, 60000, { txHash: txHash(400) }),
    });

    const result = await HypercertMarketplaceAdapter.OrderRegistered.processEvent({
      event,
      mockDb,
    });

    const order = result.entities.MarketplaceOrder.get(`${CHAIN_ID}-1`);
    assert.ok(order);
    assert.equal(order.orderId, 1n);
    assert.equal(order.hypercertId, 100n);
    assert.equal(order.seller, seller.toLowerCase());
    assert.equal(order.currency, currency.toLowerCase());
    assert.equal(order.pricePerUnit, 1000000n);
    assert.equal(order.endTime, 9999999n);
    assert.equal(order.active, true);
    assert.equal(order.totalUnitsSold, 0n);
    assert.equal(order.totalPaymentsReceived, 0n);
    assert.equal(order.createdAt, 60000);
    assert.equal(order.deactivatedAt, undefined);
    assert.equal(order.deactivatedBy, undefined);
  });
});

describe("HypercertMarketplaceAdapter OrderDeactivated", () => {
  it("deactivates existing order", async () => {
    let mockDb = MockDb.createMockDb();
    const seller = addr(92);

    // Create order first
    const createEvent = HypercertMarketplaceAdapter.OrderRegistered.createMockEvent({
      orderId: 2n,
      hypercertId: 101n,
      seller: seller,
      currency: addr(93),
      pricePerUnit: 500000n,
      endTime: 9999999n,
      mockEventData: mockEvent(CHAIN_ID, 60010, { txHash: txHash(401) }),
    });
    mockDb = await HypercertMarketplaceAdapter.OrderRegistered.processEvent({
      event: createEvent,
      mockDb,
    });

    // Deactivate
    const deactivateEvent = HypercertMarketplaceAdapter.OrderDeactivated.createMockEvent({
      orderId: 2n,
      deactivatedBy: seller,
      mockEventData: mockEvent(CHAIN_ID, 60020, { txHash: txHash(402) }),
    });
    mockDb = await HypercertMarketplaceAdapter.OrderDeactivated.processEvent({
      event: deactivateEvent,
      mockDb,
    });

    const order = mockDb.entities.MarketplaceOrder.get(`${CHAIN_ID}-2`);
    assert.ok(order);
    assert.equal(order.active, false);
    assert.equal(order.deactivatedAt, 60020);
    assert.equal(order.deactivatedBy, seller.toLowerCase());
  });

  it("is safe when order does not exist", async () => {
    const mockDb = MockDb.createMockDb();

    const event = HypercertMarketplaceAdapter.OrderDeactivated.createMockEvent({
      orderId: 999n,
      deactivatedBy: addr(94),
      mockEventData: mockEvent(CHAIN_ID, 60030, { txHash: txHash(403) }),
    });

    // Should not throw
    const result = await HypercertMarketplaceAdapter.OrderDeactivated.processEvent({
      event,
      mockDb,
    });
    const order = result.entities.MarketplaceOrder.get(`${CHAIN_ID}-999`);
    assert.equal(order, undefined);
  });
});

describe("HypercertMarketplaceAdapter FractionPurchased", () => {
  it("creates MarketplacePurchase and updates order totals", async () => {
    let mockDb = MockDb.createMockDb();
    const seller = addr(95);
    const recipient = addr(96);

    // Create order
    const createEvent = HypercertMarketplaceAdapter.OrderRegistered.createMockEvent({
      orderId: 3n,
      hypercertId: 102n,
      seller: seller,
      currency: addr(97),
      pricePerUnit: 200000n,
      endTime: 9999999n,
      mockEventData: mockEvent(CHAIN_ID, 60040, { txHash: txHash(404) }),
    });
    mockDb = await HypercertMarketplaceAdapter.OrderRegistered.processEvent({
      event: createEvent,
      mockDb,
    });

    // Purchase fraction
    const purchaseEvent = HypercertMarketplaceAdapter.FractionPurchased.createMockEvent({
      orderId: 3n,
      hypercertId: 102n,
      recipient: recipient,
      units: 50n,
      payment: 10000000n,
      mockEventData: mockEvent(CHAIN_ID, 60050, { txHash: txHash(405), logIndex: 1 }),
    });
    mockDb = await HypercertMarketplaceAdapter.FractionPurchased.processEvent({
      event: purchaseEvent,
      mockDb,
    });

    // Check purchase entity
    const purchase = mockDb.entities.MarketplacePurchase.get(`${CHAIN_ID}-${txHash(405)}-1`);
    assert.ok(purchase);
    assert.equal(purchase.orderId, 3n);
    assert.equal(purchase.hypercertId, 102n);
    assert.equal(purchase.recipient, recipient.toLowerCase());
    assert.equal(purchase.units, 50n);
    assert.equal(purchase.payment, 10000000n);

    // Check order updated
    const order = mockDb.entities.MarketplaceOrder.get(`${CHAIN_ID}-3`);
    assert.ok(order);
    assert.equal(order.totalUnitsSold, 50n);
    assert.equal(order.totalPaymentsReceived, 10000000n);
  });

  it("accumulates totals across multiple purchases", async () => {
    let mockDb = MockDb.createMockDb();

    const createEvent = HypercertMarketplaceAdapter.OrderRegistered.createMockEvent({
      orderId: 4n,
      hypercertId: 103n,
      seller: addr(98),
      currency: addr(99),
      pricePerUnit: 100000n,
      endTime: 9999999n,
      mockEventData: mockEvent(CHAIN_ID, 60060, { txHash: txHash(406) }),
    });
    mockDb = await HypercertMarketplaceAdapter.OrderRegistered.processEvent({
      event: createEvent,
      mockDb,
    });

    const purchase1 = HypercertMarketplaceAdapter.FractionPurchased.createMockEvent({
      orderId: 4n,
      hypercertId: 103n,
      recipient: addr(1),
      units: 20n,
      payment: 2000000n,
      mockEventData: mockEvent(CHAIN_ID, 60070, { txHash: txHash(407), logIndex: 1 }),
    });
    mockDb = await HypercertMarketplaceAdapter.FractionPurchased.processEvent({
      event: purchase1,
      mockDb,
    });

    const purchase2 = HypercertMarketplaceAdapter.FractionPurchased.createMockEvent({
      orderId: 4n,
      hypercertId: 103n,
      recipient: addr(2),
      units: 30n,
      payment: 3000000n,
      mockEventData: mockEvent(CHAIN_ID, 60080, { txHash: txHash(408), logIndex: 2 }),
    });
    mockDb = await HypercertMarketplaceAdapter.FractionPurchased.processEvent({
      event: purchase2,
      mockDb,
    });

    const order = mockDb.entities.MarketplaceOrder.get(`${CHAIN_ID}-4`);
    assert.ok(order);
    assert.equal(order.totalUnitsSold, 50n);
    assert.equal(order.totalPaymentsReceived, 5000000n);
  });
});

// ============================================================================
// UnifiedPowerRegistry Event Handlers
// ============================================================================

describe("UnifiedPowerRegistry ConfigUpdated", () => {
  it("creates PowerRegistryConfig entity", async () => {
    const mockDb = MockDb.createMockDb();

    const event = UnifiedPowerRegistry.ConfigUpdated.createMockEvent({
      key: "goodsToken",
      oldValue: ZERO_ADDRESS,
      newValue: addr(1),
      mockEventData: mockEvent(CHAIN_ID, 70000, { txHash: txHash(500), logIndex: 1 }),
    });

    const result = await UnifiedPowerRegistry.ConfigUpdated.processEvent({ event, mockDb });

    const config = result.entities.PowerRegistryConfig.get(`${CHAIN_ID}-${txHash(500)}-1`);
    assert.ok(config);
    assert.equal(config.key, "goodsToken");
    assert.equal(config.oldValue, ZERO_ADDRESS);
    assert.equal(config.newValue, addr(1).toLowerCase());
    assert.equal(config.timestamp, 70000);
  });
});

describe("UnifiedPowerRegistry GardenDeregistered", () => {
  it("creates PowerRegistryDeregistration entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(5);

    const event = UnifiedPowerRegistry.GardenDeregistered.createMockEvent({
      garden: garden,
      poolsCleared: 3n,
      mockEventData: mockEvent(CHAIN_ID, 70010, { txHash: txHash(510), logIndex: 2 }),
    });

    const result = await UnifiedPowerRegistry.GardenDeregistered.processEvent({ event, mockDb });

    const dereg = result.entities.PowerRegistryDeregistration.get(`${CHAIN_ID}-${txHash(510)}-2`);
    assert.ok(dereg);
    assert.equal(dereg.garden, garden.toLowerCase());
    assert.equal(dereg.poolsCleared, 3n);
    assert.equal(dereg.timestamp, 70010);
  });
});

// ============================================================================
// HatsModule additional handlers
// ============================================================================

describe("HatsModule GardenHatTreeCreated", () => {
  it("creates GardenHatTree entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(45);

    const event = HatsModule.GardenHatTreeCreated.createMockEvent({
      garden: garden,
      adminHatId: 12345n,
      mockEventData: mockEvent(CHAIN_ID, 25000),
    });

    const result = await HatsModule.GardenHatTreeCreated.processEvent({ event, mockDb });
    const hatTree = result.entities.GardenHatTree.get(garden.toLowerCase());

    assert.ok(hatTree);
    assert.equal(hatTree.adminHatId, "12345");
    assert.equal(hatTree.garden, garden.toLowerCase());
    assert.equal(hatTree.chainId, CHAIN_ID);
    assert.equal(hatTree.createdAt, 25000);
    assert.equal(hatTree.ownerHatId, undefined);
    assert.equal(hatTree.operatorHatId, undefined);
  });
});

describe("HatsModule PartialGrantFailed", () => {
  it("creates PartialGrantFailure entity", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(46);
    const account = addr(47);

    const event = HatsModule.PartialGrantFailed.createMockEvent({
      garden: garden,
      account: account,
      role: 0n,
      reason: "Hat not minted",
      mockEventData: mockEvent(CHAIN_ID, 25010, { txHash: txHash(250), logIndex: 1 }),
    });

    const result = await HatsModule.PartialGrantFailed.processEvent({ event, mockDb });
    const failure = result.entities.PartialGrantFailure.get(`${CHAIN_ID}-${txHash(250)}-1`);

    assert.ok(failure);
    assert.equal(failure.garden, garden.toLowerCase());
    assert.equal(failure.account, account.toLowerCase());
    assert.equal(failure.role, 0);
    assert.equal(failure.reason, "Hat not minted");
    assert.equal(failure.timestamp, 25010);
  });
});
