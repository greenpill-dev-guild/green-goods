/**
 * Pool setup chains
 *
 * Opening a pool for its first season is six ordered writes (`setPoolCharter`,
 * `setProviderOpenCommitmentCap`, `markPoolReady`, `seedCycle`, `openPool`,
 * `openCycle`); opening an existing Seeded season is two (`openPool`,
 * `openCycle`); a Campaign on an open pool is two more (`seedCycle`,
 * `openCycle`). Any of them can land partially, and the steward's question
 * after a failure is *what already landed* (uiux-spec C.51).
 *
 * This module answers that question from the chain. Each step carries a
 * predicate over the module's own reads (`getPool`, `getCycle`, the
 * register's cap, the `CycleSeeded` log of the seeding receipt), never over
 * what the app remembers sending, so a write that was mined but reported as
 * failed is recognised on retry and only the unlanded call is sent again. The
 * sequence hook runs the steps; this module plans them and judges them.
 *
 * @module modules/commitment-pooling/pool-setup
 */

import type { Hex } from "viem";

import type {
  CommitmentAllocationBps,
  CommitmentCycleTypeInput,
  CommitmentPoolMutationCall,
  CommitmentRecognitionPolicyBps,
} from "./pool-lifecycle";

/** `ICommitmentPoolingModule.PoolState`, by code. */
export const POOL_STATE_CODE = {
  NONE: 0,
  NOT_READY: 1,
  READY: 2,
  OPEN: 3,
  PAUSED: 4,
  CLOSED: 5,
  COMPOSTED: 6,
} as const;

/** `ICommitmentPoolingModule.CycleState`, by code. */
export const CYCLE_STATE_CODE = {
  NONE: 0,
  SEEDED: 1,
  OPEN: 2,
  RECONCILED: 3,
  COMPOSTED: 4,
  CANCELLED: 5,
} as const;

export interface PoolChainPoolRead {
  state: number;
  charterCID: string;
  openSeasonCycleId: bigint;
  nonTerminalCycleCount: number;
}

export interface PoolChainCycleRead {
  state: number;
  poolId: bigint;
}

/** What the sequence reads from the chain. The default reads the module. */
export interface PoolChainReader {
  readPool(poolId: bigint): Promise<PoolChainPoolRead>;
  readProviderCap(poolId: bigint): Promise<bigint>;
  readCycle(cycleId: bigint): Promise<PoolChainCycleRead>;
  /** The `CycleSeeded` id in a seeding receipt, or null when the log is absent. */
  readSeededCycleId(hash: Hex, poolId: bigint): Promise<bigint | null>;
}

export type PoolSetupAction =
  | "setPoolCharter"
  | "setProviderOpenCommitmentCap"
  | "markPoolReady"
  | "seedCycle"
  | "openPool"
  | "openCycle";

export interface PoolSetupCycleInput {
  cycleType: CommitmentCycleTypeInput;
  startTime: bigint;
  endTime: bigint;
  metadataCID: string;
}

export type PoolSetupStep =
  | { action: "setPoolCharter"; poolId: bigint; charterCID: string }
  | { action: "setProviderOpenCommitmentCap"; poolId: bigint; cap: bigint }
  | { action: "markPoolReady"; poolId: bigint }
  | {
      action: "seedCycle";
      poolId: bigint;
      cycle: PoolSetupCycleInput;
      /**
       * First-run only: a pool that already holds a Seeded or Open cycle was
       * set up before, so seeding again would leave a second season behind.
       * The step refuses and the console offers the open-existing path.
       */
      refuseIfPoolHasLiveCycle?: boolean;
    }
  | { action: "openPool"; poolId: bigint }
  | {
      action: "openCycle";
      poolId: bigint;
      /** A known id, or the one seeded earlier in the same run. */
      cycleId: bigint | "seeded";
      allocation: CommitmentAllocationBps;
      recognitionPolicy: CommitmentRecognitionPolicyBps;
    };

/** Why a run stopped, beyond the error it carries. */
export type PoolSetupFailure =
  | "unavailable"
  | "no-sender"
  | "invalid-split"
  | "existing-cycle"
  | "pool-closed"
  | "pool-paused"
  | "cycle-id-unknown"
  | "cycle-terminal"
  | "send-failed"
  | "not-confirmed";

export function firstRunSetupSteps(plan: {
  poolId: bigint;
  charterCID: string;
  cap: bigint;
  cycle: PoolSetupCycleInput;
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): PoolSetupStep[] {
  return [
    { action: "setPoolCharter", poolId: plan.poolId, charterCID: plan.charterCID },
    { action: "setProviderOpenCommitmentCap", poolId: plan.poolId, cap: plan.cap },
    { action: "markPoolReady", poolId: plan.poolId },
    { action: "seedCycle", poolId: plan.poolId, cycle: plan.cycle, refuseIfPoolHasLiveCycle: true },
    { action: "openPool", poolId: plan.poolId },
    {
      action: "openCycle",
      poolId: plan.poolId,
      cycleId: "seeded",
      allocation: plan.allocation,
      recognitionPolicy: plan.recognitionPolicy,
    },
  ];
}

/** Open a season that is already Seeded: `openPool` (skipped when open) then `openCycle`. */
export function openSeasonSteps(plan: {
  poolId: bigint;
  cycleId: bigint;
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): PoolSetupStep[] {
  return [
    { action: "openPool", poolId: plan.poolId },
    {
      action: "openCycle",
      poolId: plan.poolId,
      cycleId: plan.cycleId,
      allocation: plan.allocation,
      recognitionPolicy: plan.recognitionPolicy,
    },
  ];
}

/**
 * A new season on a pool that is already set up: `seedCycle`, `openPool` (skipped
 * when the pool is already open, as after a finished season), then `openCycle`.
 */
export function newSeasonSteps(plan: {
  poolId: bigint;
  cycle: PoolSetupCycleInput;
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): PoolSetupStep[] {
  return [
    { action: "seedCycle", poolId: plan.poolId, cycle: plan.cycle },
    { action: "openPool", poolId: plan.poolId },
    {
      action: "openCycle",
      poolId: plan.poolId,
      cycleId: "seeded",
      allocation: plan.allocation,
      recognitionPolicy: plan.recognitionPolicy,
    },
  ];
}

/** A Campaign beside the open season: `seedCycle` then `openCycle`. */
export function campaignSteps(plan: {
  poolId: bigint;
  cycle: PoolSetupCycleInput;
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): PoolSetupStep[] {
  return [
    { action: "seedCycle", poolId: plan.poolId, cycle: plan.cycle },
    {
      action: "openCycle",
      poolId: plan.poolId,
      cycleId: "seeded",
      allocation: plan.allocation,
      recognitionPolicy: plan.recognitionPolicy,
    },
  ];
}

export interface PoolSetupRunContext {
  /** The id seeded earlier in this run, once the receipt has named it. */
  cycleId: bigint | null;
}

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
export function resolveStepCycleId(
  step: Extract<PoolSetupStep, { action: "openCycle" }>,
  context: PoolSetupRunContext
): bigint | null {
  return step.cycleId === "seeded" ? context.cycleId : step.cycleId;
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
      if (cycle.state === CYCLE_STATE_CODE.OPEN) return { landed: true };
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
