/**
 * Pool and cycle lifecycle calls
 *
 * The vocabulary of the steward's pool acts: the fourteen lifecycle functions
 * of `ICommitmentPoolingModule`, the allocation structs `openCycle` stores,
 * and the encoding of each call's arguments. `useCommitmentPoolMutation`
 * sends single calls; `pool-setup` chains them. Both encode through here so
 * an argument order lives in one place.
 *
 * @module modules/commitment-pooling/pool-lifecycle
 */

import type { Address } from "../../types/domain";

export type CommitmentPoolAction =
  | "setPoolCharter"
  | "setProviderOpenCommitmentCap"
  | "markPoolReady"
  | "openPool"
  | "pausePool"
  | "resumePool"
  | "closePool"
  | "compostPool"
  | "reopenPool"
  | "seedCycle"
  | "openCycle"
  | "closeCycle"
  | "compostCycle"
  | "cancelCycle";

/** The chain's `CycleType` enum, by the vocabulary word the read model uses. */
export type CommitmentCycleTypeInput = "SEASON" | "CAMPAIGN";

const CYCLE_TYPE_CODE: Record<CommitmentCycleTypeInput, number> = { SEASON: 0, CAMPAIGN: 1 };

/** Six allocation classes in basis points; the on-chain `AllocationBps` struct. */
export interface CommitmentAllocationBps {
  gardeners: number;
  treasury: number;
  /** The on-chain name of the steward class; UI copy renders it as "steward". */
  steward: number;
  evaluator: number;
  community: number;
  funder: number;
}

/** Within the gardeners class; the on-chain `RecognitionPolicy` struct. */
export interface CommitmentRecognitionPolicyBps {
  equalParticipationBps: number;
  verifiedContributionBps: number;
}

/** Both structs must total exactly this many basis points. */
export const ALLOCATION_BPS_TOTAL = 10_000;

/** uiux-spec §6.10 Model 1, the default split. */
export const DEFAULT_ALLOCATION_BPS: CommitmentAllocationBps = {
  gardeners: 6000,
  treasury: 1500,
  steward: 1000,
  evaluator: 500,
  community: 500,
  funder: 500,
};

/** The protocol preset within the gardeners class (`RecognitionPolicy` doc). */
export const DEFAULT_RECOGNITION_POLICY_BPS: CommitmentRecognitionPolicyBps = {
  equalParticipationBps: 2000,
  verifiedContributionBps: 8000,
};

/**
 * The contract call, with every reason already a CID. What
 * `commitmentPoolCallArgs` encodes.
 */
export type CommitmentPoolMutationCall =
  | { action: "setPoolCharter"; poolId: bigint; charterCID: string }
  | { action: "setProviderOpenCommitmentCap"; poolId: bigint; cap: bigint }
  | {
      action: "markPoolReady" | "openPool" | "resumePool" | "closePool" | "compostPool";
      poolId: bigint;
    }
  | { action: "pausePool"; poolId: bigint; reasonCID: string }
  | { action: "reopenPool"; poolId: bigint; toOpen: boolean }
  | {
      action: "seedCycle";
      poolId: bigint;
      cycleType: CommitmentCycleTypeInput;
      /** Unix seconds, as the contract's `uint64`. */
      startTime: bigint;
      endTime: bigint;
      metadataCID: string;
    }
  | {
      action: "openCycle";
      cycleId: bigint;
      allocation: CommitmentAllocationBps;
      recognitionPolicy: CommitmentRecognitionPolicyBps;
    }
  | { action: "closeCycle" | "compostCycle"; cycleId: bigint }
  | { action: "cancelCycle"; cycleId: bigint; reasonCID: string };

/**
 * The two reasoned acts with the reason still in the steward's words. The
 * mutation hook pins it and sends the CID.
 */
export type CommitmentPoolReasonedMutationInput =
  | {
      action: "pausePool";
      poolId: bigint;
      reason: string;
      /** For upload tracking only; the call itself is pool-scoped. */
      gardenAddress?: Address | null;
    }
  | { action: "cancelCycle"; cycleId: bigint; reason: string; gardenAddress?: Address | null };

export type CommitmentPoolMutationInput =
  | CommitmentPoolMutationCall
  | CommitmentPoolReasonedMutationInput;

function sumsToTotal(values: number[]): boolean {
  return (
    values.every((value) => Number.isInteger(value) && value >= 0) &&
    values.reduce((sum, value) => sum + value, 0) === ALLOCATION_BPS_TOTAL
  );
}

/** Whether a split would pass the contract's `InvalidAllocation` check. */
export function isValidCycleSplit(input: {
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): { allocation: boolean; recognitionPolicy: boolean } {
  const { allocation, recognitionPolicy } = input;
  return {
    allocation: sumsToTotal([
      allocation.gardeners,
      allocation.treasury,
      allocation.steward,
      allocation.evaluator,
      allocation.community,
      allocation.funder,
    ]),
    recognitionPolicy: sumsToTotal([
      recognitionPolicy.equalParticipationBps,
      recognitionPolicy.verifiedContributionBps,
    ]),
  };
}

/**
 * The contract's `InvalidAllocation` check, run before anything is sent. A
 * split that does not total 10 000 bps is refused here with the same name, so
 * the console's "sum must equal 100 %" guard and the revert say one thing.
 */
export function assertCycleSplit(input: {
  allocation: CommitmentAllocationBps;
  recognitionPolicy: CommitmentRecognitionPolicyBps;
}): void {
  const valid = isValidCycleSplit(input);
  if (!valid.allocation) {
    throw new Error(
      `InvalidAllocation: the six allocation shares must total exactly ${ALLOCATION_BPS_TOTAL} bps`
    );
  }
  if (!valid.recognitionPolicy) {
    throw new Error(
      `InvalidAllocation: the recognition policy must total exactly ${ALLOCATION_BPS_TOTAL} bps`
    );
  }
}

export function commitmentPoolCallArgs(input: CommitmentPoolMutationCall): readonly unknown[] {
  switch (input.action) {
    case "setPoolCharter":
      return [input.poolId, input.charterCID];
    case "setProviderOpenCommitmentCap":
      return [input.poolId, input.cap];
    case "markPoolReady":
    case "openPool":
    case "resumePool":
    case "closePool":
    case "compostPool":
      return [input.poolId];
    case "pausePool":
      return [input.poolId, input.reasonCID];
    case "reopenPool":
      return [input.poolId, input.toOpen];
    case "seedCycle":
      return [
        input.poolId,
        CYCLE_TYPE_CODE[input.cycleType],
        input.startTime,
        input.endTime,
        input.metadataCID,
      ];
    case "openCycle":
      assertCycleSplit(input);
      return [input.cycleId, input.allocation, input.recognitionPolicy];
    case "closeCycle":
    case "compostCycle":
      return [input.cycleId];
    case "cancelCycle":
      return [input.cycleId, input.reasonCID];
  }
}
