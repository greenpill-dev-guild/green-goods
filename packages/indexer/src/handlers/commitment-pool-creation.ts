import type { Commitment } from "envio";

import {
  commitmentClaimMode,
  commitmentClaimType,
  commitmentDirection,
  commitmentKind,
  considerationRail,
  contributorPolicy,
  createCycle,
  createSeries,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import { getCommitment } from "./commitment-pool-members";
import { drainPendingLifecycle } from "./commitment-pool-pending";
import {
  getPool,
  optionalBigint,
  optionalBytes32,
  type PoolingContext,
  type RuntimeEvent,
  value,
} from "./commitment-pool-runtime";
import { createSeriesCycleSummary } from "./commitment-pool-state";
import { normalizeAddress } from "./shared";

async function createRequirementRows(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint
): Promise<void> {
  const actionUIDs = value<readonly bigint[]>(event, "requirementActionUIDs");
  const domains = value<readonly bigint[]>(event, "requirementDomains");
  const requiredCounts = value<readonly bigint[]>(event, "requirementRequiredCounts");
  for (let index = 0; index < actionUIDs.length; index += 1) {
    const entityId = `${event.chainId}-${commitmentId}-${index}`;
    if (await context.CommitmentRequirement.get(entityId)) continue;
    context.CommitmentRequirement.set({
      id: entityId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      requirementIndex: index,
      domain: Number(domains[index] ?? 0n),
      actionUID: actionUIDs[index] ?? 0n,
      requiredCount: Number(requiredCounts[index] ?? 0n),
      approvedCount: 0,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
  }
}

export async function handleCommitmentCreated(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const poolId = value<bigint>(event, "poolId");
  const pool = await getPool(event, context, poolId);
  const existing = await getCommitment(event, context, commitmentId);
  const direction = commitmentDirection(value<bigint>(event, "direction"));
  const cycleId = optionalBigint(event, "cycleId");
  const seriesId = optionalBigint(event, "commitmentSeriesId");
  const needUID = optionalBytes32(event, "needUID");
  const counterCommitmentId = optionalBigint(event, "counterCommitmentId");
  const payerGarden = normalizeAddress(value<string>(event, "payerGarden"));
  const initialState = direction === "OFFER" ? "OFFERED" : "REQUESTED";
  const created: Commitment = {
    ...existing,
    creationSeen: true,
    creationRequestKey: value<string>(event, "creationRequestKey").toLowerCase(),
    creationPayloadHash: value<string>(event, "creationPayloadHash").toLowerCase(),
    poolId,
    poolEntityId: pool.id,
    cycleId,
    cycleEntityId: cycleId === undefined ? undefined : poolingEntityId(event.chainId, cycleId),
    commitmentSeriesId: seriesId,
    commitmentSeriesEntityId:
      seriesId === undefined ? undefined : poolingEntityId(event.chainId, seriesId),
    garden: pool.registrationSeen ? pool.garden : existing.garden,
    gardenId: pool.registrationSeen ? pool.gardenId : existing.gardenId,
    creator: normalizeAddress(value<string>(event, "creator")),
    recordedBy: normalizeAddress(value<string>(event, "recordedBy")),
    payerGarden,
    payerGardenId: payerGarden,
    direction,
    commitmentType: commitmentKind(value<bigint>(event, "commitmentType")),
    state: existing.lifecycleBlockNumber === undefined ? initialState : existing.state,
    claimType: commitmentClaimType(value<bigint>(event, "claimType")),
    claimMode: commitmentClaimMode(value<bigint>(event, "claimMode")),
    contributorPolicy: contributorPolicy(value<bigint>(event, "contributorPolicy")),
    domains: sortedUnique(value<readonly bigint[]>(event, "domains").map(Number)),
    requirementCount: value<readonly bigint[]>(event, "requirementActionUIDs").length,
    unitLabel: value<string>(event, "unitLabel"),
    targetUnits: value<bigint>(event, "targetUnits"),
    requiresAssessment: value<boolean>(event, "requiresAssessment"),
    dueDate: optionalBigint(event, "dueDate"),
    metadataCID: value<string>(event, "metadataCID"),
    needUID,
    counterCommitmentId,
    counterCommitmentEntityId:
      counterCommitmentId === undefined
        ? undefined
        : poolingEntityId(event.chainId, counterCommitmentId),
    declaredUnitValue: optionalBigint(event, "declaredUnitValue"),
    declaredValueBasis: value<string>(event, "declaredValueBasis") || existing.declaredValueBasis,
    lifecycleBlockNumber: existing.lifecycleBlockNumber ?? BigInt(event.block.number),
    lifecycleLogIndex: existing.lifecycleLogIndex ?? event.logIndex,
    createdAt: existing.createdAt ?? event.block.timestamp,
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  };
  context.Commitment.set(created);
  await createRequirementRows(event, context, commitmentId);

  if (!pool.registrationSeen) context.CommitmentPool.set(pool);
  const countKey = direction === "OFFER" ? "commitmentsOffered" : "commitmentsRequested";
  context.CommitmentPool.set({
    ...pool,
    [countKey]: pool[countKey] + 1n,
    liveCommitmentCount: pool.liveCommitmentCount + 1n,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });

  if (cycleId !== undefined) {
    const cycle =
      (await context.CommitmentCycle.get(poolingEntityId(event.chainId, cycleId))) ??
      createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
    context.CommitmentCycle.set({
      ...cycle,
      liveCommitmentCount: cycle.liveCommitmentCount + 1n,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    });
  }

  if (seriesId !== undefined) {
    const series =
      (await context.CommitmentSeries.get(poolingEntityId(event.chainId, seriesId))) ??
      createSeries(event.chainId, seriesId, event.block.timestamp);
    context.CommitmentSeries.set({
      ...series,
      instanceCount: series.instanceCount + 1n,
      offeredCount: series.offeredCount + (direction === "OFFER" ? 1n : 0n),
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    if (cycleId !== undefined) {
      const summaryId = `${event.chainId}-${seriesId}-${cycleId}`;
      const summary =
        (await context.CommitmentSeriesCycleSummary.get(summaryId)) ??
        createSeriesCycleSummary(event.chainId, seriesId, cycleId, poolId, event.block.timestamp);
      context.CommitmentSeriesCycleSummary.set({
        ...summary,
        instanceCount: summary.instanceCount + 1n,
        offeredCount: summary.offeredCount + (direction === "OFFER" ? 1n : 0n),
        updatedAt: Math.max(summary.updatedAt, event.block.timestamp),
      });
    }
  }

  if (needUID !== undefined) {
    const indexId = `${event.chainId}-${needUID.toLowerCase()}`;
    const needIndex = await context.NeedCommitmentIndex.get(indexId);
    context.NeedCommitmentIndex.set({
      id: indexId,
      chainId: event.chainId,
      needUID: needUID.toLowerCase(),
      commitmentEntityIds: sortedUnique([
        ...(needIndex?.commitmentEntityIds ?? []),
        poolingEntityId(event.chainId, commitmentId),
      ]),
      fulfilledCommitmentEntityIds: needIndex?.fulfilledCommitmentEntityIds ?? [],
      cycleEntityIds: needIndex?.cycleEntityIds ?? [],
      hypercertEntityIds: needIndex?.hypercertEntityIds ?? [],
      updatedAt: Math.max(needIndex?.updatedAt ?? 0, event.block.timestamp),
    });
  }

  if (counterCommitmentId !== undefined) {
    const indexId = poolingEntityId(event.chainId, counterCommitmentId);
    const counterIndex = await context.CommitmentCounterIndex.get(indexId);
    context.CommitmentCounterIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId: counterCommitmentId,
      commitmentEntityId: indexId,
      referencingCommitmentEntityIds: sortedUnique([
        ...(counterIndex?.referencingCommitmentEntityIds ?? []),
        poolingEntityId(event.chainId, commitmentId),
      ]),
      updatedAt: Math.max(counterIndex?.updatedAt ?? 0, event.block.timestamp),
    });
  }
  await drainPendingLifecycle(context, created);
}

export async function handleCommitmentTerms(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (event.eventName === "ConsiderationDeclared") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.considerationUpdateBlockNumber,
        commitment.considerationUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      considerationRail: considerationRail(value<bigint>(event, "rail")),
      considerationSource: normalizeAddress(value<string>(event, "source")),
      considerationToken: normalizeAddress(value<string>(event, "token")),
      considerationAmount: value<bigint>(event, "amount"),
      considerationUpdateBlockNumber: BigInt(event.block.number),
      considerationUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ValueDeclared") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.declaredValueUpdateBlockNumber,
        commitment.declaredValueUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      declaredUnitValue: value<bigint>(event, "declaredUnitValue"),
      declaredValueBasis: value<string>(event, "declaredValueBasis"),
      declaredValueUpdateBlockNumber: BigInt(event.block.number),
      declaredValueUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      commitment.confirmerRuleUpdateBlockNumber,
      commitment.confirmerRuleUpdateLogIndex
    )
  )
    return;
  context.Commitment.set({
    ...commitment,
    confirmers: sortedUnique(value<readonly string[]>(event, "confirmers").map(normalizeAddress)),
    confirmationThreshold: Number(value<bigint>(event, "threshold")),
    protocolFallbackEnabled: value<boolean>(event, "protocolFallbackEnabled"),
    confirmerRuleUpdateBlockNumber: BigInt(event.block.number),
    confirmerRuleUpdateLogIndex: event.logIndex,
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
}
