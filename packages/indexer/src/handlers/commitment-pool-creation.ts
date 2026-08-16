import type { Commitment } from "envio";

import {
  commitmentClaimMode,
  commitmentClaimType,
  commitmentDirection,
  commitmentKind,
  considerationRail,
  contributorPolicy,
  createCycle,
  createRequirement,
  createSeries,
  cursorWins,
  poolingEntityId,
  sortedUnique,
} from "./commitment-pool-projections";
import { withCommitmentChild } from "./commitment-pool-pool-reconciliation";
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
import { applyUnitSummaryDeltas } from "./commitment-pool-unit-summary";
import { reconcileCommitmentHypercerts } from "./hypercert-allocations";
import { normalizeAddress, ZERO_ADDRESS } from "./shared";

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
    const existing =
      (await context.CommitmentRequirement.get(entityId)) ??
      createRequirement(event.chainId, commitmentId, index, event.block.timestamp);
    context.CommitmentRequirement.set({
      ...existing,
      creationSeen: true,
      domain: Number(domains[index] ?? 0n),
      actionUID: actionUIDs[index] ?? 0n,
      requiredCount: Number(requiredCounts[index] ?? 0n),
      createdAt: existing.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
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
  const normalizedPayerGarden = normalizeAddress(value<string>(event, "payerGarden"));
  const payerGarden = normalizedPayerGarden === ZERO_ADDRESS ? undefined : normalizedPayerGarden;
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
    declaredUnitValue:
      existing.declaredValueUpdateBlockNumber === undefined
        ? optionalBigint(event, "declaredUnitValue")
        : existing.declaredUnitValue,
    declaredValueBasis:
      existing.declaredValueUpdateBlockNumber === undefined
        ? value<string>(event, "declaredValueBasis") || existing.declaredValueBasis
        : existing.declaredValueBasis,
    lifecycleBlockNumber: existing.lifecycleBlockNumber ?? BigInt(event.block.number),
    lifecycleLogIndex: existing.lifecycleLogIndex ?? event.logIndex,
    createdAt: existing.createdAt ?? event.block.timestamp,
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  };
  const materialized: Commitment = {
    ...created,
    pendingApprovedUnitDelta: 0n,
    pendingWorkApprovedCountDelta: 0n,
  };
  context.Commitment.set(materialized);
  await createRequirementRows(event, context, commitmentId);

  const countKey = direction === "OFFER" ? "commitmentsOffered" : "commitmentsRequested";
  context.CommitmentPool.set({
    ...withCommitmentChild(pool, created.id),
    [countKey]: pool[countKey] + 1n,
    liveCommitmentCount: pool.liveCommitmentCount + 1n,
    workLinkedCount: pool.workLinkedCount + BigInt(existing.workUIDs.length),
    workApprovedCount:
      pool.workApprovedCount + existing.pendingWorkApprovedCountDelta < 0n
        ? 0n
        : pool.workApprovedCount + existing.pendingWorkApprovedCountDelta,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
  if (existing.pendingApprovedUnitDelta !== 0n) {
    await applyUnitSummaryDeltas(
      context,
      event.chainId,
      poolId,
      cycleId,
      materialized.unitLabel ?? value<string>(event, "unitLabel"),
      event.block.timestamp,
      { approved: existing.pendingApprovedUnitDelta }
    );
  }

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
      cycleEntityIds:
        cycleId === undefined
          ? (needIndex?.cycleEntityIds ?? [])
          : sortedUnique([
              ...(needIndex?.cycleEntityIds ?? []),
              poolingEntityId(event.chainId, cycleId),
            ]),
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
  const reconciled = await drainPendingLifecycle(context, materialized);
  await reconcileCommitmentHypercerts(context, reconciled, event.block.timestamp);
}

export async function handleCommitmentTerms(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (event.eventName === "ConsiderationDeclared") {
    const declarationWins = cursorWins(
      event.block.number,
      event.logIndex,
      commitment.considerationUpdateBlockNumber,
      commitment.considerationUpdateLogIndex
    );
    if (!declarationWins) {
      if (commitment.considerationRail === undefined) {
        context.Commitment.set({
          ...commitment,
          considerationRail: considerationRail(value<bigint>(event, "rail")),
          updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
        });
      }
      return;
    }
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
  const thresholdWins = cursorWins(
    event.block.number,
    event.logIndex,
    commitment.confirmerRuleUpdateBlockNumber,
    commitment.confirmerRuleUpdateLogIndex
  );
  const authorityWins = cursorWins(
    event.block.number,
    event.logIndex,
    commitment.confirmerAuthorityUpdateBlockNumber,
    commitment.confirmerAuthorityUpdateLogIndex
  );
  if (!thresholdWins && !authorityWins) return;
  context.Commitment.set({
    ...commitment,
    confirmers: authorityWins
      ? sortedUnique(value<readonly string[]>(event, "confirmers").map(normalizeAddress))
      : commitment.confirmers,
    confirmationThreshold: thresholdWins
      ? Number(value<bigint>(event, "threshold"))
      : commitment.confirmationThreshold,
    protocolFallbackEnabled: authorityWins
      ? value<boolean>(event, "protocolFallbackEnabled")
      : commitment.protocolFallbackEnabled,
    confirmerRuleUpdateBlockNumber: thresholdWins
      ? BigInt(event.block.number)
      : commitment.confirmerRuleUpdateBlockNumber,
    confirmerRuleUpdateLogIndex: thresholdWins
      ? event.logIndex
      : commitment.confirmerRuleUpdateLogIndex,
    confirmerAuthorityUpdateBlockNumber: authorityWins
      ? BigInt(event.block.number)
      : commitment.confirmerAuthorityUpdateBlockNumber,
    confirmerAuthorityUpdateLogIndex: authorityWins
      ? event.logIndex
      : commitment.confirmerAuthorityUpdateLogIndex,
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
}
