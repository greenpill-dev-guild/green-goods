import type { Commitment, CommitmentSeries, CommitmentSeriesCycleSummary } from "envio";

import {
  createSeries,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import { reconcilePendingPoolClose } from "./commitment-pool-pool-reconciliation";
import { isTerminal, reconcileMemberHistory } from "./commitment-pool-members";
import type { PoolingContext } from "./commitment-pool-runtime";
import { reconcileCommitmentHypercerts } from "./hypercert-allocations";

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

function lifetimeCounterKey(
  state: NonNullable<Commitment["state"]>
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
  nextState: NonNullable<Commitment["state"]>,
  blockNumber: bigint,
  logIndex: number,
  timestamp: number,
  patch: Partial<Commitment> = {}
): Promise<Commitment> {
  const lifecycleWins = cursorWins(
    Number(blockNumber),
    logIndex,
    commitment.lifecycleBlockNumber,
    commitment.lifecycleLogIndex
  );
  const counterKey = lifetimeCounterKey(nextState);
  const milestoneIsNew =
    counterKey !== undefined && !commitment.countedLifecycleStates.includes(nextState);
  const previousState = commitment.state;
  const previousTerminal = isTerminal(previousState);
  const nextTerminal = isTerminal(nextState);
  let updated: Commitment = milestoneIsNew
    ? {
        ...commitment,
        countedLifecycleStates: sortedUnique([...commitment.countedLifecycleStates, nextState]),
        cancelledAt:
          nextState === "CANCELLED"
            ? (commitment.cancelledAt ?? timestamp)
            : commitment.cancelledAt,
        expiredAt:
          nextState === "EXPIRED" ? (commitment.expiredAt ?? timestamp) : commitment.expiredAt,
        updatedAt: Math.max(commitment.updatedAt, timestamp),
      }
    : commitment;
  if (lifecycleWins) {
    updated = {
      ...updated,
      ...patch,
      state: nextState,
      lifecycleBlockNumber: blockNumber,
      lifecycleLogIndex: logIndex,
      updatedAt: Math.max(updated.updatedAt, timestamp),
    };
  }
  if (lifecycleWins || milestoneIsNew) context.Commitment.set(updated);

  if (commitment.poolId !== undefined) {
    const pool = await context.CommitmentPool.get(
      poolingEntityId(commitment.chainId, commitment.poolId)
    );
    if (pool) {
      let nextPool =
        milestoneIsNew && counterKey ? { ...pool, [counterKey]: pool[counterKey] + 1n } : pool;
      if (lifecycleWins) {
        nextPool = {
          ...nextPool,
          liveCommitmentCount:
            previousTerminal === nextTerminal
              ? nextPool.liveCommitmentCount
              : nextTerminal
                ? nextPool.liveCommitmentCount > 0n
                  ? nextPool.liveCommitmentCount - 1n
                  : 0n
                : nextPool.liveCommitmentCount + 1n,
          commitmentsDue:
            commitment.acceptanceSeen && previousState !== nextState
              ? previousState === "CANCELLED"
                ? nextPool.commitmentsDue + 1n
                : nextState === "CANCELLED"
                  ? nextPool.commitmentsDue > 0n
                    ? nextPool.commitmentsDue - 1n
                    : 0n
                  : nextPool.commitmentsDue
              : nextPool.commitmentsDue,
        };
      }
      context.CommitmentPool.set(
        reconcilePendingPoolClose(
          { ...nextPool, updatedAt: Math.max(nextPool.updatedAt, timestamp) },
          timestamp
        )
      );
    }
  }

  if (commitment.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(commitment.chainId, commitment.cycleId)
    );
    if (cycle) {
      let nextCycle =
        milestoneIsNew && counterKey ? { ...cycle, [counterKey]: cycle[counterKey] + 1n } : cycle;
      if (lifecycleWins) {
        nextCycle = {
          ...nextCycle,
          liveCommitmentCount:
            previousTerminal === nextTerminal
              ? nextCycle.liveCommitmentCount
              : nextTerminal
                ? nextCycle.liveCommitmentCount > 0n
                  ? nextCycle.liveCommitmentCount - 1n
                  : 0n
                : nextCycle.liveCommitmentCount + 1n,
          commitmentsDue:
            commitment.acceptanceSeen && previousState !== nextState
              ? previousState === "CANCELLED"
                ? nextCycle.commitmentsDue + 1n
                : nextState === "CANCELLED"
                  ? nextCycle.commitmentsDue > 0n
                    ? nextCycle.commitmentsDue - 1n
                    : 0n
                  : nextCycle.commitmentsDue
              : nextCycle.commitmentsDue,
        };
      }
      context.CommitmentCycle.set({
        ...nextCycle,
        updatedAt: Math.max(nextCycle.updatedAt, timestamp),
      });
    }
  }
  if (!lifecycleWins) return updated;
  await applySeriesTransition(context, commitment, previousState, nextState, timestamp);
  if (nextState === "FULFILLED" && previousState !== "FULFILLED") {
    await applyFulfillmentSideEffects(context, updated, timestamp);
  }
  const reconciled = await reconcileMemberHistory(context, updated, timestamp);
  await reconcileCommitmentHypercerts(context, reconciled, timestamp);
  return reconciled;
}
