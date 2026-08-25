/**
 * Pool setup verdicts
 *
 * The judging half of `pool-setup`: whether a planned step has already taken
 * effect on chain, and which contract call it sends once its cycle id is
 * known. Every answer comes from the module's own reads, never from what the
 * app remembers sending, so a write that was mined but reported as failed is
 * recognised on retry. Split from the planning half, which is at its
 * source-structure cap.
 *
 * @module modules/commitment-pooling/pool-setup-verdicts
 */

import type { CommitmentPoolMutationCall } from "./pool-lifecycle";
// Types only: `pool-setup` re-exports this module, so a value import here
// would close a cycle and leave these state codes uninitialised at load.
import type {
  PoolChainCycleRead,
  PoolChainReader,
  PoolSetupFailure,
  PoolSetupRunContext,
  PoolSetupStep,
} from "./pool-setup";

/** `ICommitmentPoolingModule.PoolState`, by code. */
const POOL_STATE_CODE = {
  NONE: 0,
  NOT_READY: 1,
  READY: 2,
  OPEN: 3,
  PAUSED: 4,
  CLOSED: 5,
  COMPOSTED: 6,
} as const;

/** `ICommitmentPoolingModule.CycleState`, by code. */
const CYCLE_STATE_CODE = {
  NONE: 0,
  SEEDED: 1,
  OPEN: 2,
  RECONCILED: 3,
  COMPOSTED: 4,
  CANCELLED: 5,
} as const;

export type PoolStepVerdict = { landed: boolean; refused?: PoolSetupFailure };

const POOL_STATES_AT_LEAST_READY = new Set<number>([
  POOL_STATE_CODE.READY,
  POOL_STATE_CODE.OPEN,
  POOL_STATE_CODE.PAUSED,
]);
const POOL_STATES_FINISHED = new Set<number>([POOL_STATE_CODE.CLOSED, POOL_STATE_CODE.COMPOSTED]);
const CYCLE_STATES_TERMINAL = new Set<number>([
  CYCLE_STATE_CODE.RECONCILED,
  CYCLE_STATE_CODE.COMPOSTED,
  CYCLE_STATE_CODE.CANCELLED,
]);

/** The cycle an `openCycle` step targets, once known. */
function resolveStepCycleId(
  step: Extract<PoolSetupStep, { action: "openCycle" }>,
  context: PoolSetupRunContext
): bigint | null {
  return step.cycleId === "seeded" ? context.cycleId : step.cycleId;
}

/**
 * Whether an already-open cycle carries the terms this run planned. Open alone
 * does not make an `openCycle` step landed: another steward may have opened the
 * same seeded cycle on a different split while this flow was up, and the
 * snapshots are fixed from that moment on.
 */
function cycleCarriesPlannedTerms(
  cycle: PoolChainCycleRead,
  step: Extract<PoolSetupStep, { action: "openCycle" }>
): boolean {
  const stored = cycle.allocation;
  const planned = step.allocation;
  const storedPolicy = cycle.recognitionPolicy;
  const plannedPolicy = step.recognitionPolicy;
  return (
    stored.gardeners === planned.gardeners &&
    stored.treasury === planned.treasury &&
    stored.operator === planned.operator &&
    stored.evaluator === planned.evaluator &&
    stored.community === planned.community &&
    stored.funder === planned.funder &&
    storedPolicy.equalParticipationBps === plannedPolicy.equalParticipationBps &&
    storedPolicy.verifiedContributionBps === plannedPolicy.verifiedContributionBps
  );
}

/**
 * Whether a step has already taken effect on chain. Asked before every send
 * and again after it, so the sequence's record of what landed is only ever
 * what the module reports.
 */
export async function judgeStep(
  step: PoolSetupStep,
  reader: PoolChainReader,
  context: PoolSetupRunContext
): Promise<PoolStepVerdict> {
  switch (step.action) {
    case "setPoolCharter": {
      const pool = await reader.readPool(step.poolId);
      return { landed: pool.charterCID === step.charterCID };
    }
    case "setProviderOpenCommitmentCap":
      return { landed: (await reader.readProviderCap(step.poolId)) === step.cap };
    case "markPoolReady": {
      const pool = await reader.readPool(step.poolId);
      if (POOL_STATES_FINISHED.has(pool.state)) return { landed: false, refused: "pool-closed" };
      return { landed: POOL_STATES_AT_LEAST_READY.has(pool.state) };
    }
    case "seedCycle": {
      if (context.cycleId !== null) {
        const cycle = await reader.readCycle(context.cycleId);
        return {
          landed: cycle.state === CYCLE_STATE_CODE.SEEDED || cycle.state === CYCLE_STATE_CODE.OPEN,
        };
      }
      if (step.refuseIfPoolHasLiveCycle) {
        const pool = await reader.readPool(step.poolId);
        if (pool.nonTerminalCycleCount > 0) return { landed: false, refused: "existing-cycle" };
      }
      return { landed: false };
    }
    case "openPool": {
      const pool = await reader.readPool(step.poolId);
      if (pool.state === POOL_STATE_CODE.OPEN) return { landed: true };
      if (pool.state === POOL_STATE_CODE.PAUSED) return { landed: false, refused: "pool-paused" };
      if (POOL_STATES_FINISHED.has(pool.state)) return { landed: false, refused: "pool-closed" };
      return { landed: false };
    }
    case "openCycle": {
      const cycleId = resolveStepCycleId(step, context);
      if (cycleId === null) return { landed: false, refused: "cycle-id-unknown" };
      const cycle = await reader.readCycle(cycleId);
      if (cycle.state === CYCLE_STATE_CODE.OPEN) {
        return cycleCarriesPlannedTerms(cycle, step)
          ? { landed: true }
          : { landed: false, refused: "cycle-terms-mismatch" };
      }
      if (CYCLE_STATES_TERMINAL.has(cycle.state))
        return { landed: false, refused: "cycle-terminal" };
      return { landed: false };
    }
  }
}

/** The contract call a step sends, once its cycle id is known. */
export function stepToCall(
  step: PoolSetupStep,
  context: PoolSetupRunContext
): CommitmentPoolMutationCall | null {
  switch (step.action) {
    case "setPoolCharter":
      return { action: "setPoolCharter", poolId: step.poolId, charterCID: step.charterCID };
    case "setProviderOpenCommitmentCap":
      return { action: "setProviderOpenCommitmentCap", poolId: step.poolId, cap: step.cap };
    case "markPoolReady":
      return { action: "markPoolReady", poolId: step.poolId };
    case "seedCycle":
      return { action: "seedCycle", poolId: step.poolId, ...step.cycle };
    case "openPool":
      return { action: "openPool", poolId: step.poolId };
    case "openCycle": {
      const cycleId = resolveStepCycleId(step, context);
      if (cycleId === null) return null;
      return {
        action: "openCycle",
        cycleId,
        allocation: step.allocation,
        recognitionPolicy: step.recognitionPolicy,
      };
    }
  }
}
