import type { CommitmentUnitSummary } from "envio";

import { exactLabelHash, poolingEntityId } from "./commitment-pool-projections";
import type { PoolingContext } from "./commitment-pool-runtime";

type UnitSummaryDeltas = {
  readonly expected?: bigint;
  readonly approved?: bigint;
  readonly fulfilled?: bigint;
  readonly open?: bigint;
};

export async function applyUnitSummaryDeltas(
  context: PoolingContext,
  chainId: number,
  poolId: bigint,
  cycleId: bigint | undefined,
  unitLabel: string,
  timestamp: number,
  deltas: UnitSummaryDeltas
): Promise<void> {
  const labelHash = exactLabelHash(unitLabel);
  const scopes: ReadonlyArray<{
    scope: CommitmentUnitSummary["scope"];
    scopeId: bigint;
    cycleId: bigint | undefined;
  }> = [
    { scope: "POOL", scopeId: poolId, cycleId: undefined },
    ...(cycleId === undefined ? [] : [{ scope: "CYCLE" as const, scopeId: cycleId, cycleId }]),
  ];
  for (const scope of scopes) {
    const id = `${chainId}-${scope.scope}-${scope.scopeId}-${labelHash}`;
    const existing = await context.CommitmentUnitSummary.get(id);
    context.CommitmentUnitSummary.set({
      id,
      chainId,
      scope: scope.scope,
      scopeId: scope.scopeId,
      poolId,
      poolEntityId: poolingEntityId(chainId, poolId),
      cycleId: scope.cycleId,
      cycleEntityId:
        scope.cycleId === undefined ? undefined : poolingEntityId(chainId, scope.cycleId),
      unitLabel,
      unitLabelHash: labelHash,
      expectedUnits: (existing?.expectedUnits ?? 0n) + (deltas.expected ?? 0n),
      approvedUnits: (existing?.approvedUnits ?? 0n) + (deltas.approved ?? 0n),
      fulfilledUnits: (existing?.fulfilledUnits ?? 0n) + (deltas.fulfilled ?? 0n),
      openUnits: (existing?.openUnits ?? 0n) + (deltas.open ?? 0n),
      updatedAt: Math.max(existing?.updatedAt ?? 0, timestamp),
    });
  }
}
