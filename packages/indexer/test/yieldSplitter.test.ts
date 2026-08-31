import assert from "assert";
import { createTestIndexer, YieldSplitter } from "./v3";
import { addr, CHAINS, mockEvent, txHash } from "./helpers/events";

const CHAIN_ID = CHAINS.arbitrum;

// ============================================================================
// YIELD SPLIT
// ============================================================================

describe("YieldSplitter.YieldSplit", () => {
  it("creates YieldAllocation with all fields", async () => {
    const mockDb = createTestIndexer();
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
    const allocation = await result.YieldAllocation.get(`${CHAIN_ID}-${tx}-3`);

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
    const mockDb = createTestIndexer();
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
    const allocation = await result.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);

    assert.ok(allocation);
    assert.equal(allocation.garden, "0xabcdef1234567890abcdef1234567890abcdef12");
    assert.equal(allocation.asset, "0x1234567890abcdef1234567890abcdef12345678");
  });

  it("handles zero amounts", async () => {
    const mockDb = createTestIndexer();
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
    const allocation = await result.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);

    assert.ok(allocation);
    assert.equal(allocation.totalAmount, 0n);
  });

  it("creates unique IDs per transaction + logIndex", async () => {
    let mockDb = createTestIndexer();
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

    const allocation1 = await mockDb.YieldAllocation.get(`${CHAIN_ID}-${tx}-1`);
    const allocation2 = await mockDb.YieldAllocation.get(`${CHAIN_ID}-${tx}-2`);

    assert.ok(allocation1);
    assert.ok(allocation2);
    assert.equal(allocation1.totalAmount, 60n);
    assert.equal(allocation2.totalAmount, 600n);
  });

  it("creates separate allocations per transaction", async () => {
    let mockDb = createTestIndexer();
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

    const allocation1 = await mockDb.YieldAllocation.get(`${CHAIN_ID}-${tx1}-1`);
    const allocation2 = await mockDb.YieldAllocation.get(`${CHAIN_ID}-${tx2}-1`);

    assert.ok(allocation1);
    assert.ok(allocation2);
    assert.equal(allocation1.totalAmount, 60n);
    assert.equal(allocation2.totalAmount, 30n);
  });
});
