import assert from "node:assert/strict";
import type { Address } from "viem";

import { Addresses, CommitmentRegistry, createTestIndexer, processEvents } from "./v3";

const CHAIN_ID = 42161;
const POOL_ID = 7n;

function address(index: number): Address {
  return (Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`) as Address;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(blockNumber: number) {
  return {
    chainId: CHAIN_ID,
    block: { timestamp: blockNumber, number: blockNumber },
    srcAddress: undefined,
    transaction: { hash: hash(blockNumber) },
    logIndex: 0,
  };
}

function committed(
  classId: bigint,
  provider: Address,
  blockNumber: number,
  totalCommitted: bigint
) {
  return CommitmentRegistry.UnitsCommitted.createMockEvent({
    classId,
    poolId: POOL_ID,
    account: provider,
    cycleId: 0n,
    unitLabel: "hours",
    units: 1n,
    totalCommitted,
    mockEventData: eventData(blockNumber),
  });
}

function released(classId: bigint, provider: Address, blockNumber: number, totalCommitted: bigint) {
  return CommitmentRegistry.UnitsReleased.createMockEvent({
    classId,
    poolId: POOL_ID,
    account: provider,
    cycleId: 0n,
    unitLabel: "hours",
    units: 1n,
    totalCommitted,
    mockEventData: eventData(blockNumber),
  });
}

describe("CommitmentPool distinct provider count", () => {
  it("increments once per provider and remains monotonic through release and replay", async () => {
    const providerA = address(2);
    const providerB = address(3);
    const firstExposure = committed(11n, providerA, 1, 1n);
    const repeatExposure = committed(12n, providerA, 2, 2n);
    const secondProvider = committed(13n, providerB, 3, 1n);
    const firstRelease = released(11n, providerA, 4, 1n);
    const finalRelease = released(12n, providerA, 5, 0n);
    const events = [firstExposure, repeatExposure, secondProvider, firstRelease, finalRelease];

    let db = createTestIndexer();
    db = await processEvents(db, [firstExposure]);
    assert.equal(
      (await db.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      1n
    );

    db = await processEvents(db, [repeatExposure]);
    assert.equal(
      (await db.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      1n
    );

    db = await processEvents(db, [secondProvider]);
    assert.equal(
      (await db.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      2n
    );

    db = await processEvents(db, [firstRelease, finalRelease]);
    const releasedExposure = await db.CommitmentProviderExposure.get(
      `${CHAIN_ID}-${POOL_ID}-${providerA.toLowerCase()}`
    );
    assert.equal(releasedExposure?.openCommitmentCount, 0n);
    assert.equal(
      (await db.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      2n
    );

    const replayed = await processEvents(createTestIndexer(), events);
    const reverseReplay = await processEvents(createTestIndexer(), [...events].reverse());
    assert.equal(
      (await replayed.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      2n
    );
    assert.equal(
      (await reverseReplay.CommitmentPool.get(`${CHAIN_ID}-${POOL_ID}`))?.distinctProviderCount,
      2n
    );
  });
});
