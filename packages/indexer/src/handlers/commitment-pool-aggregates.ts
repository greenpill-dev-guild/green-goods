import type { CommitmentCycle, CommitmentPool, CommitmentSeries } from "envio";

import {
  commitmentCycleType,
  commitmentPoolType,
  createCycle,
  createSeries,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import { getPool, type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { normalizeAddress } from "./shared";

export async function handlePoolEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const poolId = value<bigint>(event, "poolId");
  const pool = await getPool(event, context, poolId);
  if (event.eventName === "PoolRegistered") {
    const garden = normalizeAddress(value<string>(event, "garden"));
    context.CommitmentPool.set({
      ...pool,
      registrationSeen: true,
      garden,
      gardenId: garden,
      poolType: commitmentPoolType(value<bigint>(event, "poolType")),
      state: pool.lifecycleBlockNumber === undefined ? "NOT_READY" : pool.state,
      createdAt: pool.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "PoolCharterUpdated") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        pool.charterUpdateBlockNumber,
        pool.charterUpdateLogIndex
      )
    )
      return;
    context.CommitmentPool.set({
      ...pool,
      charterCID: value<string>(event, "charterCID"),
      charterUpdateBlockNumber: BigInt(event.block.number),
      charterUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      pool.lifecycleBlockNumber,
      pool.lifecycleLogIndex
    )
  )
    return;
  const stateByEvent: Readonly<Record<string, CommitmentPool["state"]>> = {
    PoolReady: "READY",
    PoolOpened: "OPEN",
    PoolPaused: "PAUSED",
    PoolResumed: "OPEN",
    PoolClosed: "CLOSED",
    PoolComposted: "COMPOSTED",
  };
  const nextState =
    event.eventName === "PoolReopened"
      ? value<boolean>(event, "toOpen")
        ? "OPEN"
        : "READY"
      : stateByEvent[event.eventName];
  if (
    event.eventName === "PoolClosed" &&
    (pool.liveCommitmentCount !== 0n || pool.nonTerminalCycleCount !== 0n)
  )
    return;
  context.CommitmentPool.set({
    ...pool,
    state: nextState,
    pauseReasonCID:
      event.eventName === "PoolPaused"
        ? value<string>(event, "reasonCID")
        : event.eventName === "PoolResumed"
          ? undefined
          : pool.pauseReasonCID,
    lifecycleBlockNumber: BigInt(event.block.number),
    lifecycleLogIndex: event.logIndex,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
}

export async function handleCycleEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const cycleId = value<bigint>(event, "cycleId");
  const poolId = value<bigint>(event, "poolId");
  const entityId = poolingEntityId(event.chainId, cycleId);
  const pool = await getPool(event, context, poolId);
  const cycle =
    (await context.CommitmentCycle.get(entityId)) ??
    createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
  if (event.eventName === "CycleSeeded") {
    const seeded = {
      ...cycle,
      seedSeen: true,
      poolId,
      poolEntityId: pool.id,
      garden: pool.registrationSeen ? pool.garden : cycle.garden,
      gardenId: pool.registrationSeen ? pool.gardenId : cycle.gardenId,
      cycleType: commitmentCycleType(value<bigint>(event, "cycleType")),
      state: cycle.lifecycleBlockNumber === undefined ? "SEEDED" : cycle.state,
      startTime: value<bigint>(event, "startTime"),
      endTime: value<bigint>(event, "endTime"),
      metadataCID: value<string>(event, "metadataCID"),
      createdAt: cycle.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    } satisfies CommitmentCycle;
    context.CommitmentCycle.set(seeded);
    if (!cycle.seedSeen && seeded.state !== "COMPOSTED" && seeded.state !== "CANCELLED") {
      context.CommitmentPool.set({
        ...pool,
        nonTerminalCycleCount: pool.nonTerminalCycleCount + 1n,
        openSeasonCycleId:
          seeded.state === "OPEN" && seeded.cycleType === "SEASON"
            ? cycleId
            : pool.openSeasonCycleId,
        openSeasonCycleEntityId:
          seeded.state === "OPEN" && seeded.cycleType === "SEASON"
            ? seeded.id
            : pool.openSeasonCycleEntityId,
        openCampaignIds:
          seeded.state === "OPEN" && seeded.cycleType === "CAMPAIGN"
            ? sortedUnique([...pool.openCampaignIds, cycleId])
            : pool.openCampaignIds,
        openCampaignEntityIds:
          seeded.state === "OPEN" && seeded.cycleType === "CAMPAIGN"
            ? sortedUnique([...pool.openCampaignEntityIds, seeded.id])
            : pool.openCampaignEntityIds,
        updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
      });
    }
    return;
  }
  const lifecycleWins = cursorWins(
    event.block.number,
    event.logIndex,
    cycle.lifecycleBlockNumber,
    cycle.lifecycleLogIndex
  );
  const stateByEvent: Readonly<Record<string, CommitmentCycle["state"]>> = {
    CycleOpened: "OPEN",
    CycleClosed: "RECONCILED",
    CycleComposted: "COMPOSTED",
    CycleCancelled: "CANCELLED",
  };
  const isOpen = event.eventName === "CycleOpened";
  const allocationUnset =
    cycle.gardenersBps +
      cycle.treasuryBps +
      cycle.operatorBps +
      cycle.evaluatorBps +
      cycle.communityBps +
      cycle.funderBps ===
    0;
  if (!lifecycleWins && !(isOpen && allocationUnset)) return;
  const nextState = lifecycleWins ? stateByEvent[event.eventName] : cycle.state;
  const nextCycle = {
    ...cycle,
    state: nextState,
    gardenersBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "gardenersBps")) : cycle.gardenersBps,
    treasuryBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "treasuryBps")) : cycle.treasuryBps,
    operatorBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "operatorBps")) : cycle.operatorBps,
    evaluatorBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "evaluatorBps")) : cycle.evaluatorBps,
    communityBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "communityBps")) : cycle.communityBps,
    funderBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "funderBps")) : cycle.funderBps,
    equalParticipationBps:
      isOpen && allocationUnset
        ? Number(value<bigint>(event, "equalParticipationBps"))
        : cycle.equalParticipationBps,
    verifiedContributionBps:
      isOpen && allocationUnset
        ? Number(value<bigint>(event, "verifiedContributionBps"))
        : cycle.verifiedContributionBps,
    lifecycleBlockNumber: lifecycleWins ? BigInt(event.block.number) : cycle.lifecycleBlockNumber,
    lifecycleLogIndex: lifecycleWins ? event.logIndex : cycle.lifecycleLogIndex,
    updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
  } satisfies CommitmentCycle;
  context.CommitmentCycle.set(nextCycle);
  if (!lifecycleWins || !cycle.seedSeen) return;
  const wasTerminal = cycle.state === "COMPOSTED" || cycle.state === "CANCELLED";
  const isTerminalCycle = nextState === "COMPOSTED" || nextState === "CANCELLED";
  context.CommitmentPool.set({
    ...pool,
    nonTerminalCycleCount:
      wasTerminal === isTerminalCycle
        ? pool.nonTerminalCycleCount
        : isTerminalCycle
          ? pool.nonTerminalCycleCount > 0n
            ? pool.nonTerminalCycleCount - 1n
            : 0n
          : pool.nonTerminalCycleCount + 1n,
    openSeasonCycleId:
      nextState === "OPEN" && cycle.cycleType === "SEASON"
        ? cycleId
        : pool.openSeasonCycleId === cycleId && nextState !== "OPEN"
          ? undefined
          : pool.openSeasonCycleId,
    openSeasonCycleEntityId:
      nextState === "OPEN" && cycle.cycleType === "SEASON"
        ? entityId
        : pool.openSeasonCycleId === cycleId && nextState !== "OPEN"
          ? undefined
          : pool.openSeasonCycleEntityId,
    openCampaignIds:
      cycle.cycleType === "CAMPAIGN"
        ? nextState === "OPEN"
          ? sortedUnique([...pool.openCampaignIds, cycleId])
          : pool.openCampaignIds.filter((candidate) => candidate !== cycleId)
        : pool.openCampaignIds,
    openCampaignEntityIds:
      cycle.cycleType === "CAMPAIGN"
        ? nextState === "OPEN"
          ? sortedUnique([...pool.openCampaignEntityIds, entityId])
          : pool.openCampaignEntityIds.filter((candidate) => candidate !== entityId)
        : pool.openCampaignEntityIds,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
}

export async function handleSeriesEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const seriesId = value<bigint>(event, "seriesId");
  const entityId = poolingEntityId(event.chainId, seriesId);
  const series =
    (await context.CommitmentSeries.get(entityId)) ??
    createSeries(event.chainId, seriesId, event.block.timestamp);
  if (event.eventName === "CommitmentSeriesCreated") {
    const holder = normalizeAddress(value<string>(event, "holder"));
    const poolId = value<bigint>(event, "poolId");
    context.CommitmentSeries.set({
      ...series,
      creationSeen: true,
      poolId,
      poolEntityId: poolingEntityId(event.chainId, poolId),
      createdBy: holder,
      currentHolder: holder,
      state: series.latestLifecycleBlock === undefined ? "ACTIVE" : series.state,
      metadataCID:
        series.latestMetadataBlock === undefined
          ? value<string>(event, "metadataCID")
          : series.metadataCID,
      createdAt: series.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "CommitmentSeriesMetadataUpdated") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        series.latestMetadataBlock,
        series.latestMetadataLogIndex
      )
    )
      return;
    context.CommitmentSeries.set({
      ...series,
      metadataCID: value<string>(event, "metadataCID"),
      latestMetadataBlock: BigInt(event.block.number),
      latestMetadataLogIndex: event.logIndex,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      series.latestLifecycleBlock,
      series.latestLifecycleLogIndex
    )
  )
    return;
  const states: Readonly<Record<string, CommitmentSeries["state"]>> = {
    CommitmentSeriesRested: "RESTING",
    CommitmentSeriesResumed: "ACTIVE",
    CommitmentSeriesRetired: "RETIRED",
  };
  context.CommitmentSeries.set({
    ...series,
    state: states[event.eventName],
    latestLifecycleBlock: BigInt(event.block.number),
    latestLifecycleLogIndex: event.logIndex,
    updatedAt: Math.max(series.updatedAt, event.block.timestamp),
  });
}
