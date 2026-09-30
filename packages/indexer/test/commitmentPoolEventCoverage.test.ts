import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as yaml from "js-yaml";
import { after } from "mocha";

import { routeEvent } from "../src/handlers/commitmentPool";
import type { PoolingContext, RuntimeEvent } from "../src/handlers/commitment-pool-runtime";
import {
  Addresses,
  CommitmentPoolingModule,
  CommitmentRegistry,
  createTestIndexer,
  executedMockEventNames,
  processEvents,
} from "./v3";

const CHAIN_ID = 42161;
const START_BLOCK = 433_714_500;
const MEMBER_FUNDING_EVENTS = [
  "FundingPledged",
  "FundingDepositRecorded",
  "FundingConsumed",
  "FundingWithdrawn",
] as const;

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

function runtimeEvent(event: Record<string, unknown>, eventName: string): RuntimeEvent {
  return {
    ...event,
    contractName: "CommitmentPoolingModule",
    eventName,
  } as unknown as RuntimeEvent;
}

function configuredEvents(config: string, contractName: string): Set<string> {
  const document = yaml.load(config) as {
    contracts?: Array<{
      name?: unknown;
      events?: Array<{ event?: unknown } | string>;
    }>;
  };
  const contract = document.contracts?.find((entry) => entry.name === contractName);
  const events = new Set<string>();
  for (const declaration of contract?.events ?? []) {
    const signature =
      typeof declaration === "string"
        ? declaration
        : typeof declaration.event === "string"
          ? declaration.event
          : undefined;
    const eventName = signature?.match(/^(\w+)\(/)?.[1];
    if (eventName) events.add(eventName);
  }
  return events;
}

async function frozenEventBoundary(): Promise<{
  moduleEvents: Set<string>;
  registryEvents: Set<string>;
  settlementEvents: Set<string>;
  expected: Set<string>;
}> {
  const config = await readFile(new URL("../config.yaml", import.meta.url), "utf8");
  const moduleEvents = configuredEvents(config, "CommitmentPoolingModule");
  const registryEvents = configuredEvents(config, "CommitmentRegistry");
  const settlementEvents = configuredEvents(config, "SettlementModule");
  return {
    moduleEvents,
    registryEvents,
    settlementEvents,
    expected: new Set([
      ...[...moduleEvents].map((event) => `CommitmentPoolingModule.${event}`),
      ...[...registryEvents].map((event) => `CommitmentRegistry.${event}`),
      ...MEMBER_FUNDING_EVENTS.map((event) => `SettlementModule.${event}`),
    ]),
  };
}

describe("Commitment Pooling direct event coverage", () => {
  it("keeps the frozen 58-event roster aligned with the indexed boundary", async () => {
    const { moduleEvents, registryEvents, settlementEvents, expected } =
      await frozenEventBoundary();

    assert.equal(moduleEvents.size, 48, "pooling module boundary must remain frozen at 48 events");
    assert.equal(registryEvents.size, 6, "registry boundary must remain frozen at 6 events");
    assert.equal(
      MEMBER_FUNDING_EVENTS.filter((event) => settlementEvents.has(event)).length,
      4,
      "all four settlement member-funding events must remain indexed"
    );
    assert.equal(expected.size, 58);
  });

  it("counts only events that successfully pass through the mock dispatcher", async () => {
    const db = createTestIndexer();
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 71n,
      garden: address(1),
      poolType: 0n,
      mockEventData: eventData(0),
    });

    assert.equal(executedMockEventNames(db).has("CommitmentPoolingModule.PoolRegistered"), false);
    await processEvents(db, [registered]);
    assert.equal(executedMockEventNames(db).has("CommitmentPoolingModule.PoolRegistered"), true);
  });

  it("executes consideration, assessment, and expiry through the registered handlers", async () => {
    const db = await processEvents(createTestIndexer(), [
      CommitmentPoolingModule.PoolRegistered.createMockEvent({
        poolId: 72n,
        garden: address(1),
        poolType: 0n,
        mockEventData: eventData(1),
      }),
      CommitmentPoolingModule.CommitmentCreated.createMockEvent({
        commitmentId: 81n,
        poolId: 72n,
        cycleId: 0n,
        commitmentSeriesId: 0n,
        creationRequestKey: hash(810),
        creationPayloadHash: hash(811),
        creator: address(2),
        recordedBy: address(2),
        direction: 0n,
        commitmentType: 0n,
        claimType: 1n,
        claimMode: 0n,
        contributorPolicy: 0n,
        domains: [],
        requirementActionUIDs: [],
        requirementDomains: [],
        requirementRequiredCounts: [],
        unitLabel: "hours",
        targetUnits: 1n,
        requiresAssessment: true,
        dueDate: 0n,
        metadataCID: "ipfs://runtime-coverage",
        needUID: hash(812),
        counterCommitmentId: 0n,
        declaredUnitValue: 0n,
        declaredValueBasis: "",
        payerGarden: address(1),
        mockEventData: eventData(2),
      }),
      CommitmentPoolingModule.ConsiderationDeclared.createMockEvent({
        commitmentId: 81n,
        rail: 1n,
        source: address(2),
        token: address(3),
        amount: 50n,
        mockEventData: eventData(3),
      }),
      CommitmentPoolingModule.AssessmentAttached.createMockEvent({
        commitmentId: 81n,
        assessmentUID: hash(81),
        attacher: address(4),
        mockEventData: eventData(4),
      }),
      CommitmentPoolingModule.CommitmentExpired.createMockEvent({
        commitmentId: 81n,
        mockEventData: eventData(5),
      }),
    ]);

    const commitment = await db.Commitment.get(`${CHAIN_ID}-81`);
    assert.equal(commitment?.considerationRail, "ARBITRUM_EXTERNAL");
    assert.equal(commitment?.assessmentUID, hash(81));
    assert.equal(commitment?.state, "EXPIRED");
  });

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
    let db = await processEvents(createTestIndexer(), [
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
    ]);

    let series = await db.CommitmentSeries.get(`${CHAIN_ID}-11`);
    assert.equal(series?.state, "RESTING");

    db = await processEvents(db, [
      CommitmentPoolingModule.CommitmentSeriesResumed.createMockEvent({
        seriesId: 11n,
        mockEventData: eventData(16),
      }),
    ]);
    series = await db.CommitmentSeries.get(`${CHAIN_ID}-11`);
    assert.equal(series?.state, "ACTIVE");

    db = await processEvents(db, [
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
    series = await db.CommitmentSeries.get(`${CHAIN_ID}-11`);
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

  it("orders same-block lifecycle events by log index and ignores duplicate delivery", async () => {
    const registered = CommitmentPoolingModule.PoolRegistered.createMockEvent({
      poolId: 17n,
      garden: address(7),
      poolType: 0n,
      mockEventData: eventData(30),
    });
    const paused = CommitmentPoolingModule.PoolPaused.createMockEvent({
      poolId: 17n,
      reasonCID: "ipfs://same-block-pause",
      mockEventData: eventData(31, 0),
    });
    const opened = CommitmentPoolingModule.PoolOpened.createMockEvent({
      poolId: 17n,
      mockEventData: eventData(31, 1),
    });
    const db = await processEvents(createTestIndexer(), [registered, paused, opened]);
    await routeEvent(runtimeEvent(opened, "PoolOpened"), db as unknown as PoolingContext);

    const pool = await db.CommitmentPool.get(`${CHAIN_ID}-17`);
    assert.equal(pool?.state, "OPEN");
    assert.equal(pool?.lifecycleBlockNumber, BigInt(START_BLOCK + 31));
    assert.equal(pool?.lifecycleLogIndex, 1);
    assert.equal(
      (await db.CommitmentEvent.getAll()).filter((event) => event.eventType === "POOL_OPENED")
        .length,
      1
    );
  });

  it("rejects a known event that falls outside its registered contract router", async () => {
    const moduleUpdated = CommitmentRegistry.ModuleUpdated.createMockEvent({
      oldModule: address(5),
      newModule: address(6),
      mockEventData: eventData(32),
    });

    await assert.rejects(
      routeEvent(
        runtimeEvent(moduleUpdated, "ModuleUpdated"),
        createTestIndexer() as unknown as PoolingContext
      ),
      /Unrouted commitment pooling event: CommitmentPoolingModule\.ModuleUpdated/
    );
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

after("executes every frozen pooling event through the registered mock handlers", async () => {
  if (process.env.GG_RUN_FULL_INDEXER_TEST_SUITE !== "1") return;
  const { expected } = await frozenEventBoundary();
  const executed = executedMockEventNames();
  assert.deepEqual(
    [...expected].filter((event) => !executed.has(event)).sort(),
    [],
    "every frozen pooling event must execute through the mock dispatcher"
  );
});
