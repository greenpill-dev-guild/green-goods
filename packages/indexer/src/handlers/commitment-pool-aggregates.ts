import type { CommitmentCycle, CommitmentPool } from "envio";

import {
  commitmentCycleType,
  commitmentPoolType,
  createCycle,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import {
  reconcilePendingPoolClose,
  retainPendingPoolClose,
  withCycleChild,
} from "./commitment-pool-pool-reconciliation";
import { reconcileRecognitionWeights } from "./commitment-pool-members";
import { getPool, type PoolingContext, type RuntimeEvent, value } from "./commitment-pool-runtime";
import { normalizeAddress } from "./shared";
import { reconcilePoolCommitmentHypercerts } from "./hypercert-allocations";

export async function handlePoolEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const poolId = value<bigint>(event, "poolId");
  const pool = await getPool(event, context, poolId);
  if (event.eventName === "PoolRegistered") {
    const garden = normalizeAddress(value<string>(event, "garden"));
    const registered = {
      ...pool,
      registrationSeen: true,
      garden,
      gardenId: garden,
      poolType: commitmentPoolType(value<bigint>(event, "poolType")),
      state: pool.lifecycleBlockNumber === undefined ? "NOT_READY" : pool.state,
      createdAt: pool.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    } satisfies CommitmentPool;
    context.CommitmentPool.set(registered);
    for (const cycleEntityId of registered.childCycleEntityIds) {
      const cycle = await context.CommitmentCycle.get(cycleEntityId);
      if (cycle) {
        context.CommitmentCycle.set({
          ...cycle,
          garden,
          gardenId: garden,
          updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
        });
      }
    }
    for (const commitmentEntityId of registered.childCommitmentEntityIds) {
      const commitment = await context.Commitment.get(commitmentEntityId);
      if (commitment) {
        context.Commitment.set({
          ...commitment,
          garden,
          gardenId: garden,
          updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
        });
      }
    }
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
  const lifecycleWins = cursorWins(
    event.block.number,
    event.logIndex,
    pool.lifecycleBlockNumber,
    pool.lifecycleLogIndex
  );
  const pausePayloadWins =
    (event.eventName === "PoolPaused" || event.eventName === "PoolResumed") &&
    cursorWins(
      event.block.number,
      event.logIndex,
      pool.pauseReasonBlockNumber,
      pool.pauseReasonLogIndex
    );
  if (!lifecycleWins) {
    if (!pausePayloadWins) return;
    context.CommitmentPool.set({
      ...pool,
      pauseReasonCID:
        event.eventName === "PoolPaused" ? value<string>(event, "reasonCID") : undefined,
      pauseReasonBlockNumber: BigInt(event.block.number),
      pauseReasonLogIndex: event.logIndex,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
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
  ) {
    context.CommitmentPool.set(
      retainPendingPoolClose(pool, event.block.number, event.logIndex, event.block.timestamp)
    );
    return;
  }
  const updatedPool = {
    ...pool,
    state: nextState,
    pauseReasonCID: pausePayloadWins
      ? event.eventName === "PoolPaused"
        ? value<string>(event, "reasonCID")
        : undefined
      : pool.pauseReasonCID,
    pauseReasonBlockNumber: pausePayloadWins
      ? BigInt(event.block.number)
      : pool.pauseReasonBlockNumber,
    pauseReasonLogIndex: pausePayloadWins ? event.logIndex : pool.pauseReasonLogIndex,
    lifecycleBlockNumber: BigInt(event.block.number),
    lifecycleLogIndex: event.logIndex,
    pendingCloseBlockNumber:
      event.eventName === "PoolClosed" ? undefined : pool.pendingCloseBlockNumber,
    pendingCloseLogIndex: event.eventName === "PoolClosed" ? undefined : pool.pendingCloseLogIndex,
    pendingCloseTimestamp:
      event.eventName === "PoolClosed" ? undefined : pool.pendingCloseTimestamp,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  } satisfies CommitmentPool;
  context.CommitmentPool.set(reconcilePendingPoolClose(updatedPool, event.block.timestamp));
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
    const seasonCursorWins =
      seeded.cycleType === "SEASON" &&
      cycle.lifecycleBlockNumber !== undefined &&
      cycle.lifecycleLogIndex !== undefined &&
      cursorWins(
        Number(cycle.lifecycleBlockNumber),
        cycle.lifecycleLogIndex,
        pool.openSeasonBlockNumber,
        pool.openSeasonLogIndex
      );
    if (!cycle.seedSeen && seeded.state !== "COMPOSTED" && seeded.state !== "CANCELLED") {
      context.CommitmentPool.set({
        ...withCycleChild(pool, seeded.id),
        nonTerminalCycleCount: pool.nonTerminalCycleCount + 1n,
        openSeasonCycleId: seasonCursorWins
          ? seeded.state === "OPEN"
            ? cycleId
            : undefined
          : pool.openSeasonCycleId,
        openSeasonCycleEntityId: seasonCursorWins
          ? seeded.state === "OPEN"
            ? seeded.id
            : undefined
          : pool.openSeasonCycleEntityId,
        openSeasonBlockNumber: seasonCursorWins
          ? cycle.lifecycleBlockNumber
          : pool.openSeasonBlockNumber,
        openSeasonLogIndex: seasonCursorWins ? cycle.lifecycleLogIndex : pool.openSeasonLogIndex,
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
    } else if (!pool.childCycleEntityIds.includes(seeded.id) || seasonCursorWins) {
      context.CommitmentPool.set({
        ...withCycleChild(pool, seeded.id),
        openSeasonCycleId: seasonCursorWins
          ? seeded.state === "OPEN"
            ? cycleId
            : undefined
          : pool.openSeasonCycleId,
        openSeasonCycleEntityId: seasonCursorWins
          ? seeded.state === "OPEN"
            ? seeded.id
            : undefined
          : pool.openSeasonCycleEntityId,
        openSeasonBlockNumber: seasonCursorWins
          ? cycle.lifecycleBlockNumber
          : pool.openSeasonBlockNumber,
        openSeasonLogIndex: seasonCursorWins ? cycle.lifecycleLogIndex : pool.openSeasonLogIndex,
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
  if (isOpen && allocationUnset) {
    for (const commitmentEntityId of pool.childCommitmentEntityIds) {
      const commitment = await context.Commitment.get(commitmentEntityId);
      if (commitment?.cycleId === cycleId) {
        await reconcileRecognitionWeights(context, commitment, event.block.timestamp);
      }
    }
  }
  await reconcilePoolCommitmentHypercerts(context, pool, cycleId, event.block.timestamp);
  if (!lifecycleWins || !cycle.seedSeen) return;
  const wasTerminal = cycle.state === "COMPOSTED" || cycle.state === "CANCELLED";
  const isTerminalCycle = nextState === "COMPOSTED" || nextState === "CANCELLED";
  const seasonCursorWins =
    cycle.cycleType === "SEASON" &&
    cursorWins(
      event.block.number,
      event.logIndex,
      pool.openSeasonBlockNumber,
      pool.openSeasonLogIndex
    );
  context.CommitmentPool.set(
    reconcilePendingPoolClose(
      {
        ...pool,
        nonTerminalCycleCount:
          wasTerminal === isTerminalCycle
            ? pool.nonTerminalCycleCount
            : isTerminalCycle
              ? pool.nonTerminalCycleCount > 0n
                ? pool.nonTerminalCycleCount - 1n
                : 0n
              : pool.nonTerminalCycleCount + 1n,
        openSeasonCycleId: seasonCursorWins
          ? nextState === "OPEN"
            ? cycleId
            : undefined
          : pool.openSeasonCycleId,
        openSeasonCycleEntityId: seasonCursorWins
          ? nextState === "OPEN"
            ? entityId
            : undefined
          : pool.openSeasonCycleEntityId,
        openSeasonBlockNumber: seasonCursorWins
          ? BigInt(event.block.number)
          : pool.openSeasonBlockNumber,
        openSeasonLogIndex: seasonCursorWins ? event.logIndex : pool.openSeasonLogIndex,
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
      },
      event.block.timestamp
    )
  );
}
