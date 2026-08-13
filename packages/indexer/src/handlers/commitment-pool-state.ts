import type {
  Commitment,
  CommitmentCycle,
  CommitmentPool,
  CommitmentSeries,
  CommitmentSeriesCycleSummary,
} from "envio";

import {
  createSeries,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import { isTerminal, reconcileMemberHistory } from "./commitment-pool-members";
import type { PoolingContext } from "./commitment-pool-runtime";

function stateCounterKey(
  state: Commitment["state"]
):
  | "offeredCount"
  | "acceptedCount"
  | "readyCount"
  | "fulfilledCount"
  | "cancelledCount"
  | "expiredCount"
  | "disputedCount"
  | undefined {
  switch (state) {
    case "OFFERED":
      return "offeredCount";
    case "ACCEPTED":
      return "acceptedCount";
    case "READY_FOR_CONFIRMATION":
      return "readyCount";
    case "FULFILLED":
      return "fulfilledCount";
    case "CANCELLED":
      return "cancelledCount";
    case "EXPIRED":
      return "expiredCount";
    case "DISPUTED":
      return "disputedCount";
    default:
      return undefined;
  }
}

function aggregateStateCounterKey(
  state: Commitment["state"]
):
  | "commitmentsAccepted"
  | "commitmentsReadyForConfirmation"
  | "commitmentsFulfilled"
  | "commitmentsCancelled"
  | "commitmentsExpired"
  | "commitmentsDisputed"
  | undefined {
  if (state === "ACCEPTED") return "commitmentsAccepted";
  if (state === "READY_FOR_CONFIRMATION") return "commitmentsReadyForConfirmation";
  if (state === "FULFILLED") return "commitmentsFulfilled";
  if (state === "CANCELLED") return "commitmentsCancelled";
  if (state === "EXPIRED") return "commitmentsExpired";
  if (state === "DISPUTED") return "commitmentsDisputed";
  return undefined;
}

function applyAggregateStateTransition<T extends CommitmentPool | CommitmentCycle>(
  aggregate: T,
  previousState: Commitment["state"],
  nextState: Commitment["state"]
): T {
  const previousKey = aggregateStateCounterKey(previousState);
  const nextKey = aggregateStateCounterKey(nextState);
  let updated = aggregate;
  if (previousKey && previousKey !== nextKey) {
    updated = {
      ...updated,
      [previousKey]: updated[previousKey] > 0n ? updated[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updated = { ...updated, [nextKey]: updated[nextKey] + 1n };
  }
  return updated;
}

export function createSeriesCycleSummary(
  chainId: number,
  seriesId: bigint,
  cycleId: bigint,
  poolId: bigint,
  timestamp: number
): CommitmentSeriesCycleSummary {
  return {
    id: `${chainId}-${seriesId}-${cycleId}`,
    chainId,
    seriesId,
    seriesEntityId: poolingEntityId(chainId, seriesId),
    cycleId,
    cycleEntityId: poolingEntityId(chainId, cycleId),
    poolId,
    poolEntityId: poolingEntityId(chainId, poolId),
    instanceCount: 0n,
    offeredCount: 0n,
    acceptedCount: 0n,
    readyCount: 0n,
    fulfilledCount: 0n,
    cancelledCount: 0n,
    expiredCount: 0n,
    disputedCount: 0n,
    updatedAt: timestamp,
  };
}

async function applySeriesTransition(
  context: PoolingContext,
  commitment: Commitment,
  previousState: Commitment["state"],
  nextState: Commitment["state"],
  timestamp: number
): Promise<void> {
  const seriesId = commitment.commitmentSeriesId;
  const poolId = commitment.poolId;
  if (seriesId === undefined || poolId === undefined) return;
  const id = poolingEntityId(commitment.chainId, seriesId);
  const series =
    (await context.CommitmentSeries.get(id)) ??
    createSeries(commitment.chainId, seriesId, timestamp);
  const previousKey = stateCounterKey(previousState);
  const nextKey = stateCounterKey(nextState);
  let updatedSeries: CommitmentSeries = {
    ...series,
    updatedAt: Math.max(series.updatedAt, timestamp),
  };
  if (previousKey && previousKey !== nextKey) {
    updatedSeries = {
      ...updatedSeries,
      [previousKey]: updatedSeries[previousKey] > 0n ? updatedSeries[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updatedSeries = { ...updatedSeries, [nextKey]: updatedSeries[nextKey] + 1n };
  }
  if (nextState === "FULFILLED" && commitment.cycleEntityId) {
    updatedSeries = {
      ...updatedSeries,
      fulfilledCycleIds: sortedUnique([
        ...updatedSeries.fulfilledCycleIds,
        commitment.cycleEntityId,
      ]),
    };
  }
  context.CommitmentSeries.set(updatedSeries);

  if (commitment.cycleId === undefined) return;
  const summaryId = `${commitment.chainId}-${seriesId}-${commitment.cycleId}`;
  const summary =
    (await context.CommitmentSeriesCycleSummary.get(summaryId)) ??
    createSeriesCycleSummary(commitment.chainId, seriesId, commitment.cycleId, poolId, timestamp);
  let updatedSummary: CommitmentSeriesCycleSummary = {
    ...summary,
    updatedAt: Math.max(summary.updatedAt, timestamp),
  };
  if (previousKey && previousKey !== nextKey) {
    updatedSummary = {
      ...updatedSummary,
      [previousKey]: updatedSummary[previousKey] > 0n ? updatedSummary[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updatedSummary = { ...updatedSummary, [nextKey]: updatedSummary[nextKey] + 1n };
  }
  context.CommitmentSeriesCycleSummary.set(updatedSummary);
}

async function applyFulfillmentSideEffects(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<void> {
  const index = await context.CommitmentEvidenceAttributionIndex.get(commitment.id);
  for (const attributionId of index?.attributionEntityIds ?? []) {
    const attribution = await context.CommitmentEvidenceAttribution.get(attributionId);
    if (attribution && !attribution.confirmed) {
      context.CommitmentEvidenceAttribution.set({
        ...attribution,
        confirmed: true,
        updatedAt: Math.max(attribution.updatedAt, timestamp),
      });
    }
  }
  if (!commitment.needUID) return;
  const needId = `${commitment.chainId}-${commitment.needUID.toLowerCase()}`;
  const need = await context.NeedCommitmentIndex.get(needId);
  if (!need) return;
  context.NeedCommitmentIndex.set({
    ...need,
    fulfilledCommitmentEntityIds: sortedUnique([
      ...need.fulfilledCommitmentEntityIds,
      commitment.id,
    ]),
    updatedAt: Math.max(need.updatedAt, timestamp),
  });
}

export async function applyLifecycleState(
  context: PoolingContext,
  commitment: Commitment,
  nextState: Commitment["state"],
  blockNumber: bigint,
  logIndex: number,
  timestamp: number,
  patch: Partial<Commitment> = {}
): Promise<Commitment> {
  if (
    !cursorWins(
      Number(blockNumber),
      logIndex,
      commitment.lifecycleBlockNumber,
      commitment.lifecycleLogIndex
    )
  )
    return commitment;
  const previousState = commitment.state;
  const previousTerminal = isTerminal(previousState);
  const nextTerminal = isTerminal(nextState);
  const updated: Commitment = {
    ...commitment,
    ...patch,
    state: nextState,
    lifecycleBlockNumber: blockNumber,
    lifecycleLogIndex: logIndex,
    updatedAt: Math.max(commitment.updatedAt, timestamp),
  };
  context.Commitment.set(updated);

  if (commitment.poolId !== undefined) {
    const pool = await context.CommitmentPool.get(
      poolingEntityId(commitment.chainId, commitment.poolId)
    );
    if (pool) {
      const transitioned = applyAggregateStateTransition(pool, previousState, nextState);
      context.CommitmentPool.set({
        ...transitioned,
        liveCommitmentCount:
          previousTerminal === nextTerminal
            ? pool.liveCommitmentCount
            : nextTerminal
              ? pool.liveCommitmentCount > 0n
                ? pool.liveCommitmentCount - 1n
                : 0n
              : pool.liveCommitmentCount + 1n,
        commitmentsDue:
          commitment.acceptanceSeen && previousState !== nextState
            ? previousState === "CANCELLED"
              ? pool.commitmentsDue + 1n
              : nextState === "CANCELLED"
                ? pool.commitmentsDue > 0n
                  ? pool.commitmentsDue - 1n
                  : 0n
                : pool.commitmentsDue
            : pool.commitmentsDue,
        updatedAt: Math.max(pool.updatedAt, timestamp),
      });
    }
  }

  if (commitment.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(commitment.chainId, commitment.cycleId)
    );
    if (cycle) {
      const transitioned = applyAggregateStateTransition(cycle, previousState, nextState);
      context.CommitmentCycle.set({
        ...transitioned,
        liveCommitmentCount:
          previousTerminal === nextTerminal
            ? cycle.liveCommitmentCount
            : nextTerminal
              ? cycle.liveCommitmentCount > 0n
                ? cycle.liveCommitmentCount - 1n
                : 0n
              : cycle.liveCommitmentCount + 1n,
        commitmentsDue:
          commitment.acceptanceSeen && previousState !== nextState
            ? previousState === "CANCELLED"
              ? cycle.commitmentsDue + 1n
              : nextState === "CANCELLED"
                ? cycle.commitmentsDue > 0n
                  ? cycle.commitmentsDue - 1n
                  : 0n
                : cycle.commitmentsDue
            : cycle.commitmentsDue,
        updatedAt: Math.max(cycle.updatedAt, timestamp),
      });
    }
  }
  await applySeriesTransition(context, commitment, previousState, nextState, timestamp);
  if (nextState === "FULFILLED" && previousState !== "FULFILLED") {
    await applyFulfillmentSideEffects(context, updated, timestamp);
  }
  return reconcileMemberHistory(context, updated, timestamp);
}
