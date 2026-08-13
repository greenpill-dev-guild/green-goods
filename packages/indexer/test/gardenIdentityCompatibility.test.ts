import assert from "node:assert/strict";

import { Addresses, CommitmentPoolingModule, createTestIndexer } from "./v3";

const CHAIN_ID = 42161;

describe("Commitment Pooling Garden identity compatibility", () => {
  it("keeps Garden relationship ids as normalized bare addresses", async () => {
    const garden = (Addresses.mockAddresses[4] ?? "0x0000000000000000000000000000000000000004")
      .toUpperCase()
      .replace("0X", "0x");
    const event = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 9n,
      garden,
      poolType: 0n,
      mockEventData: {
        chainId: CHAIN_ID,
        block: { timestamp: 1, number: 433_713_812 },
        srcAddress: Addresses.mockAddresses[9],
        transaction: { hash: `0x${"1".padStart(64, "0")}` },
        logIndex: 0,
      },
    });
    const db = await CommitmentPoolingModule.PoolRegistered.processEvent({
      event,
      mockDb: createTestIndexer(),
    });
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-9`);
    assert.ok(pool);
    assert.equal(pool.gardenId, garden.toLowerCase());
    assert.equal(pool.gardenId.includes(`${CHAIN_ID}-`), false);
  });
});
