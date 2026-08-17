import {
  createCycle,
  cursorWins,
  exactLabelHash,
  poolingEntityId,
} from "./commitment-pool-projections";
import { withCycleChild } from "./commitment-pool-pool-reconciliation";
import {
  getPool,
  optionalBigint,
  type PoolingContext,
  type RuntimeEvent,
  value,
} from "./commitment-pool-runtime";
import { applyUnitSummaryDeltas } from "./commitment-pool-unit-summary";
import { normalizeAddress } from "./shared";

export async function handleRegistryEvent(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  if (event.eventName === "ProviderOpenCommitmentCapUpdated") {
    const poolId = value<bigint>(event, "poolId");
    const pool = await getPool(event, context, poolId);
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        pool.providerCapUpdateBlockNumber,
        pool.providerCapUpdateLogIndex
      )
    )
      return;
    context.CommitmentPool.set({
      ...pool,
      providerOpenCommitmentCap: value<bigint>(event, "cap"),
      providerCapUpdateBlockNumber: BigInt(event.block.number),
      providerCapUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ClassRegistered") {
    const classId = value<bigint>(event, "classId");
    const id = poolingEntityId(event.chainId, classId);
    if (await context.CommitmentClass.get(id)) return;
    const poolId = value<bigint>(event, "poolId");
    const cycleId = optionalBigint(event, "cycleId");
    const unitLabel = value<string>(event, "unitLabel");
    context.CommitmentClass.set({
      id,
      chainId: event.chainId,
      classId,
      poolId,
      poolEntityId: poolingEntityId(event.chainId, poolId),
      cycleId,
      cycleEntityId: cycleId === undefined ? undefined : poolingEntityId(event.chainId, cycleId),
      unitLabel,
      unitLabelHash: exactLabelHash(unitLabel),
      quota: value<bigint>(event, "quota"),
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    const pool = await getPool(event, context, poolId);
    if (cycleId === undefined) {
      context.CommitmentPool.set(pool);
    } else {
      const cycleEntityId = poolingEntityId(event.chainId, cycleId);
      const cycle =
        (await context.CommitmentCycle.get(cycleEntityId)) ??
        createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
      context.CommitmentCycle.set({
        ...cycle,
        garden: pool.registrationSeen ? pool.garden : cycle.garden,
        gardenId: pool.registrationSeen ? pool.gardenId : cycle.gardenId,
        updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
      });
      context.CommitmentPool.set(withCycleChild(pool, cycleEntityId));
    }
    await applyUnitSummaryDeltas(
      context,
      event.chainId,
      poolId,
      cycleId,
      unitLabel,
      event.block.timestamp,
      {}
    );
    return;
  }
  if (!event.eventName.startsWith("Units")) return;
  const poolId = value<bigint>(event, "poolId");
  const cycleId = optionalBigint(event, "cycleId");
  const unitLabel = value<string>(event, "unitLabel");
  const units = value<bigint>(event, "units");
  const countDelta = event.eventName === "UnitsCommitted" ? 1n : -1n;
  await applyUnitSummaryDeltas(
    context,
    event.chainId,
    poolId,
    cycleId,
    unitLabel,
    event.block.timestamp,
    {
      expected: event.eventName === "UnitsCommitted" ? units : 0n,
      fulfilled: event.eventName === "UnitsFulfilled" ? units : 0n,
      open: event.eventName === "UnitsCommitted" ? units : -units,
    }
  );

  const pool = await getPool(event, context, poolId);
  context.CommitmentPool.set({
    ...pool,
    openCommitmentCount: pool.openCommitmentCount + countDelta,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
  if (cycleId !== undefined) {
    const cycleIdValue = poolingEntityId(event.chainId, cycleId);
    const cycle =
      (await context.CommitmentCycle.get(cycleIdValue)) ??
      createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
    context.CommitmentCycle.set({
      ...cycle,
      openCommitmentCount: cycle.openCommitmentCount + countDelta,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    });
  }
  const account = normalizeAddress(value<string>(event, "account"));
  const exposureId = `${event.chainId}-${poolId}-${account}`;
  const exposure = await context.CommitmentProviderExposure.get(exposureId);
  context.CommitmentProviderExposure.set({
    id: exposureId,
    chainId: event.chainId,
    poolId,
    poolEntityId: poolingEntityId(event.chainId, poolId),
    provider: account,
    openCommitmentCount: (exposure?.openCommitmentCount ?? 0n) + countDelta,
    updatedAt: Math.max(exposure?.updatedAt ?? 0, event.block.timestamp),
  });
}
