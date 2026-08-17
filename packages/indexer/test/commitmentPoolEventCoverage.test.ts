import assert from "node:assert/strict";

import {
  Addresses,
  CommitmentPoolingModule,
  CommitmentRegistry,
  createTestIndexer,
  processEvents,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_714_500;

function address(index: number): string {
  return Addresses.mockAddresses[index] ?? `0x${index.toString(16).padStart(40, "0")}`;
}

function hash(index: number): string {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function eventData(offset: number, logIndex = 0) {
  const blockNumber = START_BLOCK + offset;
  return {
    chainId: CHAIN_ID,
    block: { timestamp: blockNumber, number: blockNumber },
    srcAddress: undefined,
    transaction: { hash: hash(offset * 10 + logIndex + 1) },
    logIndex,
  };
}

describe("Commitment Pooling direct event coverage", () => {
  it("projects the remaining pool lifecycle and charter events", async () => {
    const db = await processEvents(createTestIndexer(), [
      CommitmentPoolingModule.PoolRegistered.createMockEvent({
        poolId: 7n,
        garden: address(1),
        poolType: 0n,
        mockEventData: eventData(0),
      }),
      CommitmentPoolingModule.PoolCharterUpdated.createMockEvent({
        poolId: 7n,
        charterCID: "ipfs://charter-v2",
        mockEventData: eventData(1),
      }),
      CommitmentPoolingModule.PoolReady.createMockEvent({
        poolId: 7n,
        mockEventData: eventData(2),
      }),
      CommitmentPoolingModule.PoolOpened.createMockEvent({
        poolId: 7n,
        mockEventData: eventData(3),
      }),
      CommitmentPoolingModule.PoolPaused.createMockEvent({
        poolId: 7n,
        reasonCID: "ipfs://pause",
        mockEventData: eventData(4),
      }),
      CommitmentPoolingModule.PoolResumed.createMockEvent({
        poolId: 7n,
        mockEventData: eventData(5),
      }),
      CommitmentPoolingModule.PoolClosed.createMockEvent({
        poolId: 7n,
        mockEventData: eventData(6),
      }),
      CommitmentPoolingModule.PoolComposted.createMockEvent({
        poolId: 7n,
        mockEventData: eventData(7),
      }),
      CommitmentPoolingModule.PoolReopened.createMockEvent({
        poolId: 7n,
        toOpen: true,
        mockEventData: eventData(8),
      }),
    ]);

    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    assert.ok(pool);
    assert.equal(pool.charterCID, "ipfs://charter-v2");
    assert.equal(pool.pauseReasonCID, undefined);
    assert.equal(pool.state, "OPEN");
    assert.equal(pool.lifecycleBlockNumber, BigInt(START_BLOCK + 8));

    const auditTypes = new Set((await db.CommitmentEvent.getAll()).map((row) => row.eventType));
    for (const eventType of [
      "POOL_CHARTER_UPDATED",
      "POOL_READY",
      "POOL_RESUMED",
      "POOL_COMPOSTED",
      "POOL_REOPENED",
    ] as const) {
      assert.ok(auditTypes.has(eventType), `missing ${eventType} audit`);
    }
  });

  it("projects cycle cancellation, the full series lifecycle, and exchange acceptance", async () => {
    const db = await processEvents(createTestIndexer(), [
      CommitmentPoolingModule.PoolRegistered.createMockEvent({
        poolId: 7n,
        garden: address(1),
        poolType: 0n,
        mockEventData: eventData(10),
      }),
      CommitmentPoolingModule.CycleSeeded.createMockEvent({
        cycleId: 9n,
        poolId: 7n,
        cycleType: 0n,
        startTime: 1n,
        endTime: 2n,
        metadataCID: "ipfs://cycle",
        mockEventData: eventData(11),
      }),
      CommitmentPoolingModule.CycleCancelled.createMockEvent({
        cycleId: 9n,
        poolId: 7n,
        reasonCID: "ipfs://cancelled-cycle",
        mockEventData: eventData(12),
      }),
      CommitmentPoolingModule.CommitmentSeriesCreated.createMockEvent({
        seriesId: 11n,
        poolId: 7n,
        holder: address(2),
        metadataCID: "ipfs://series-v1",
        mockEventData: eventData(13),
      }),
      CommitmentPoolingModule.CommitmentSeriesMetadataUpdated.createMockEvent({
        seriesId: 11n,
        metadataCID: "ipfs://series-v2",
        mockEventData: eventData(14),
      }),
      CommitmentPoolingModule.CommitmentSeriesRested.createMockEvent({
        seriesId: 11n,
        mockEventData: eventData(15),
      }),
      CommitmentPoolingModule.CommitmentSeriesResumed.createMockEvent({
        seriesId: 11n,
        mockEventData: eventData(16),
      }),
      CommitmentPoolingModule.CommitmentSeriesRetired.createMockEvent({
        seriesId: 11n,
        mockEventData: eventData(17),
      }),
      CommitmentPoolingModule.ExchangeAccepted.createMockEvent({
        commitmentIdA: 31n,
        commitmentIdB: 32n,
        poolId: 7n,
        acceptorA: address(3),
        acceptorB: address(4),
        mockEventData: eventData(18),
      }),
    ]);

    const cycle = await db.CommitmentCycle.get(`${CHAIN_ID}-9`);
    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const series = await db.CommitmentSeries.get(`${CHAIN_ID}-11`);
    const exchange = await db.CommitmentExchange.get(`${CHAIN_ID}-EXCHANGE-7-31-32`);

    assert.ok(cycle);
    assert.ok(pool);
    assert.ok(series);
    assert.ok(exchange);
    assert.equal(cycle.state, "CANCELLED");
    assert.equal(pool.nonTerminalCycleCount, 0n);
    assert.equal(series.creationSeen, true);
    assert.equal(series.metadataCID, "ipfs://series-v2");
    assert.equal(series.state, "RETIRED");
    assert.equal(exchange.acceptorA, address(3).toLowerCase());
    assert.equal(exchange.acceptorB, address(4).toLowerCase());

    const audits = await db.CommitmentEvent.getAll();
    assert.equal(
      audits.find((row) => row.eventType === "CYCLE_CANCELLED")?.data,
      "ipfs://cancelled-cycle"
    );
    for (const eventType of [
      "COMMITMENT_SERIES_CREATED",
      "COMMITMENT_SERIES_METADATA_UPDATED",
      "COMMITMENT_SERIES_RESTED",
      "COMMITMENT_SERIES_RESUMED",
      "COMMITMENT_SERIES_RETIRED",
      "EXCHANGE_ACCEPTED",
    ] as const) {
      assert.ok(
        audits.some((row) => row.eventType === eventType),
        `missing ${eventType} audit`
      );
    }
  });

  it("projects registry completion and preserves module configuration audits", async () => {
    const previousAddress = address(5);
    const newAddress = address(6);
    const previousUID = hash(701);
    const newUID = hash(702);
    const db = await processEvents(createTestIndexer(), [
      CommitmentPoolingModule.PoolRegistered.createMockEvent({
        poolId: 7n,
        garden: address(1),
        poolType: 0n,
        mockEventData: eventData(20),
      }),
      CommitmentRegistry.ProviderOpenCommitmentCapUpdated.createMockEvent({
        poolId: 7n,
        cap: 5n,
        mockEventData: eventData(21),
      }),
      CommitmentRegistry.UnitsCommitted.createMockEvent({
        classId: 41n,
        poolId: 7n,
        account: address(2),
        cycleId: 0n,
        unitLabel: "hours",
        units: 5n,
        totalCommitted: 5n,
        mockEventData: eventData(22),
      }),
      CommitmentRegistry.UnitsFulfilled.createMockEvent({
        classId: 41n,
        poolId: 7n,
        account: address(2),
        cycleId: 0n,
        unitLabel: "hours",
        units: 5n,
        totalFulfilled: 5n,
        mockEventData: eventData(23),
      }),
      CommitmentPoolingModule.ModuleDependencyUpdated.createMockEvent({
        dependency: 1n,
        previousAddress,
        newAddress,
        mockEventData: eventData(24),
      }),
      CommitmentPoolingModule.ModuleSchemaUIDUpdated.createMockEvent({
        schemaKind: 2n,
        previousUID,
        newUID,
        mockEventData: eventData(25),
      }),
      CommitmentPoolingModule.ModulePauseStatusChanged.createMockEvent({
        previousPaused: false,
        paused: true,
        mockEventData: eventData(26),
      }),
      CommitmentRegistry.ModuleUpdated.createMockEvent({
        oldModule: previousAddress,
        newModule: newAddress,
        mockEventData: eventData(27),
      }),
    ]);

    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-7`);
    const exposure = await db.CommitmentProviderExposure.get(
      `${CHAIN_ID}-7-${address(2).toLowerCase()}`
    );
    const summary = (await db.CommitmentUnitSummary.getAll()).find(
      (row) => row.scope === "POOL" && row.unitLabel === "hours"
    );
    assert.ok(pool);
    assert.ok(exposure);
    assert.ok(summary);
    assert.equal(pool.providerOpenCommitmentCap, 5n);
    assert.equal(pool.openCommitmentCount, 0n);
    assert.equal(exposure.openCommitmentCount, 0n);
    assert.equal(summary.expectedUnits, 5n);
    assert.equal(summary.fulfilledUnits, 5n);
    assert.equal(summary.openUnits, 0n);

    const audits = await db.CommitmentEvent.getAll();
    const dependency = audits.find((row) => row.eventType === "MODULE_DEPENDENCY_UPDATED");
    const schema = audits.find((row) => row.eventType === "MODULE_SCHEMA_UID_UPDATED");
    const pause = audits.find((row) => row.eventType === "MODULE_PAUSE_STATUS_CHANGED");
    const module = audits.find((row) => row.eventType === "MODULE_UPDATED");
    assert.deepEqual(
      {
        configurationKey: dependency?.configurationKey,
        previousValue: dependency?.previousValue,
        newValue: dependency?.newValue,
      },
      {
        configurationKey: 1,
        previousValue: previousAddress.toLowerCase(),
        newValue: newAddress.toLowerCase(),
      }
    );
    assert.deepEqual(
      {
        configurationKey: schema?.configurationKey,
        previousValue: schema?.previousValue,
        newValue: schema?.newValue,
      },
      { configurationKey: 2, previousValue: previousUID, newValue: newUID }
    );
    assert.deepEqual(
      { previousValue: pause?.previousValue, newValue: pause?.newValue },
      { previousValue: "false", newValue: "true" }
    );
    assert.deepEqual(
      { previousValue: module?.previousValue, newValue: module?.newValue },
      { previousValue: previousAddress.toLowerCase(), newValue: newAddress.toLowerCase() }
    );
  });
});
