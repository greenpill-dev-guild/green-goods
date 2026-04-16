import assert from "assert";
import { createRequire } from "module";

// @ts-expect-error import.meta.url is valid at runtime in tsx.
const require = createRequire(import.meta.url);
const generated = require("../generated");
const { TestHelpers } = generated;
const { MockDb, Addresses, YieldSplitter } = TestHelpers;

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

// ============================================================================
// YIELD SPLIT
// ============================================================================

describe("YieldSplitter.YieldSplit", () => {
  it("creates YieldAllocation with all fields", async () => {
    const mockDb = MockDb.createMockDb();
    const garden = addr(30);
    const asset = addr(31);
    const tx = txHash(200);

    const event = YieldSplitter.YieldSplit.createMockEvent({
      garden,
      asset,
      cookieJarAmount: 10n,
      fractionsAmount: 20n,
      juiceboxAmount: 30n,
      totalYield: 60n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 3 }),
    });

    const result = await YieldSplitter.YieldSplit.processEvent({ event, mockDb });
    const allocation = result.entities.YieldAllocation.get(`${CHAIN_ID}-${tx}-3`);

    assert.ok(allocation);
    assert.equal(allocation.chainId, CHAIN_ID);
    assert.equal(allocation.garden, garden.toLowerCase());
    assert.equal(allocation.asset, asset.toLowerCase());
    assert.equal(allocation.cookieJarAmount, 10n);
    assert.equal(allocation.fractionsAmount, 20n);
    assert.equal(allocation.juiceboxAmount, 30n);
    assert.equal(allocation.totalAmount, 60n);
    assert.equal(allocation.txHash, tx);
    assert.equal(allocation.timestamp, 5000);
  });

  it("normalizes addresses to lowercase", async () => {
    const mockDb = MockDb.createMockDb();
    const tx = txHash(200);

    const event = YieldSplitter.YieldSplit.createMockEvent({
      garden: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      asset: "0x1234567890ABCDEF1234567890ABCDEF12345678",
      cookieJarAmount: 1n,
      fractionsAmount: 2n,
      juiceboxAmount: 3n,
      totalYield: 6n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
    });

    const result = await YieldSplitter.YieldSplit.processEvent({ event, mockDb });
    const allocation = result.entities.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);

    assert.ok(allocation);
    assert.equal(allocation.garden, "0xabcdef1234567890abcdef1234567890abcdef12");
    assert.equal(allocation.asset, "0x1234567890abcdef1234567890abcdef12345678");
  });

  it("handles zero amounts", async () => {
    const mockDb = MockDb.createMockDb();
    const tx = txHash(200);

    const event = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(30),
      asset: addr(31),
      cookieJarAmount: 0n,
      fractionsAmount: 0n,
      juiceboxAmount: 0n,
      totalYield: 0n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
    });

    const result = await YieldSplitter.YieldSplit.processEvent({ event, mockDb });
    const allocation = result.entities.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);

    assert.ok(allocation);
    assert.equal(allocation.totalAmount, 0n);
  });

  it("creates unique IDs per transaction + logIndex", async () => {
    let mockDb = MockDb.createMockDb();
    const tx = txHash(200);

    const event1 = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(30),
      asset: addr(31),
      cookieJarAmount: 10n,
      fractionsAmount: 20n,
      juiceboxAmount: 30n,
      totalYield: 60n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 1 }),
    });
    mockDb = await YieldSplitter.YieldSplit.processEvent({ event: event1, mockDb });

    const event2 = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(32),
      asset: addr(33),
      cookieJarAmount: 100n,
      fractionsAmount: 200n,
      juiceboxAmount: 300n,
      totalYield: 600n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx, logIndex: 2 }),
    });
    mockDb = await YieldSplitter.YieldSplit.processEvent({ event: event2, mockDb });

    const allocation1 = mockDb.entities.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);
    const allocation2 = mockDb.entities.YieldAllocation.get(`${CHAIN_ID}-${tx}-2`);

    assert.ok(allocation1);
    assert.ok(allocation2);
    assert.equal(allocation1.totalAmount, 60n);
    assert.equal(allocation2.totalAmount, 600n);
  });

  it("creates separate allocations per transaction", async () => {
    let mockDb = MockDb.createMockDb();
    const tx1 = txHash(200);
    const tx2 = txHash(300);

    const event1 = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(30),
      asset: addr(31),
      cookieJarAmount: 10n,
      fractionsAmount: 20n,
      juiceboxAmount: 30n,
      totalYield: 60n,
      mockEventData: mockEvent(CHAIN_ID, 5000, { txHash: tx1, logIndex: 1 }),
    });
    mockDb = await YieldSplitter.YieldSplit.processEvent({ event: event1, mockDb });

    const event2 = YieldSplitter.YieldSplit.createMockEvent({
      garden: addr(30),
      asset: addr(31),
      cookieJarAmount: 5n,
      fractionsAmount: 10n,
      juiceboxAmount: 15n,
      totalYield: 30n,
      mockEventData: mockEvent(CHAIN_ID, 6000, { txHash: tx2, logIndex: 1 }),
    });
    mockDb = await YieldSplitter.YieldSplit.processEvent({ event: event2, mockDb });

    const allocation1 = mockDb.entities.YieldAllocation.get(`${CHAIN_ID}-${tx1}-1`);
    const allocation2 = mockDb.entities.YieldAllocation.get(`${CHAIN_ID}-${tx2}-1`);

    assert.ok(allocation1);
    assert.ok(allocation2);
    assert.equal(allocation1.totalAmount, 60n);
    assert.equal(allocation2.totalAmount, 30n);
  });
});
