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
 * failed is recognised on retry and only the unlanded call is sent again. This
 * module plans the steps and names the failures they stop on;
 * `pool-setup-verdicts.ts` judges them and the sequence hook runs them.
 *
 * @module modules/commitment-pooling/pool-setup
 */

import type { Hex } from "viem";

import type {
  CommitmentAllocationBps,
  CommitmentCycleTypeInput,
  CommitmentRecognitionPolicyBps,
} from "./pool-lifecycle";

export interface PoolChainPoolRead {
  state: number;
  charterCID: string;
  openSeasonCycleId: bigint;
  nonTerminalCycleCount: number;
}

export interface PoolChainCycleRead {
  state: number;
  poolId: bigint;
  /**
   * The two snapshots `openCycle` writes. Both read as zeroes until the cycle
   * opens and are immutable for the rest of its life (`CyclesLib.openCycle`),
   * so an Open cycle carrying other terms can never be corrected to these.
   */
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
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
  | "cycle-terms-mismatch"
  | "send-failed"
  | "not-confirmed"
  | "read-failed"
  | "seed-unconfirmed";

/**
 * The failures a retry can clear. Each of them leaves the chain able to say
 * what landed, so walking the same steps again sends only the unlanded call.
 *
 * `seed-unconfirmed` is deliberately absent. Seeding is the one write the
 * chain cannot recognise on its own — a cycle is named by the receipt, not by
 * any later read — so once a `seedCycle` outcome is unknown, sending it again
 * risks a second, orphaned cycle. That run fails closed and the steward
 * refetches the pool instead.
 *
 * `cycle-terms-mismatch` is absent for the opposite reason: the cycle is
 * already open on someone else's terms, and both snapshots are immutable, so
 * no repeat of the run can ever store the planned ones.
 */
const RETRIABLE_FAILURES = new Set<PoolSetupFailure>([
  "send-failed",
  "not-confirmed",
  "cycle-id-unknown",
  "read-failed",
]);

/** Whether repeating the run is safe. The console offers a retry only for these. */
export function isRetriablePoolSetupFailure(failure: PoolSetupFailure | null): boolean {
  return failure !== null && RETRIABLE_FAILURES.has(failure);
}

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

// The judging half lives beside this one for file-length reasons; it stays
// part of this module's surface so callers keep importing from one place.
export * from "./pool-setup-verdicts";
