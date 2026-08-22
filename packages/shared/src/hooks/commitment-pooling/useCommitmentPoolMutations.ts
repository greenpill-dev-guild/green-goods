/**
 * useCommitmentPoolMutation Hook
 *
 * The steward's pool and cycle lifecycle acts, one hook for all fourteen. A
 * sibling of `useCommitmentMutation`, which covers every commitment-level act;
 * this one covers what happens to the pool and its seasons and campaigns:
 * charter, cap, ready, open, pause, resume, close, compost, reopen, seed,
 * open, close, compost, cancel.
 *
 * Two rules the contract enforces that the hook checks first, so a steward
 * learns them from the console rather than from a revert:
 *
 * - `openCycle` stores an allocation snapshot whose six shares must total
 *   exactly 10 000 bps, and a recognition policy whose two shares must too
 *   (`InvalidAllocation`, the Yield.sol `InvalidSplitRatio` precedent).
 * - `pausePool` and `cancelCycle` take a `reasonCID`. The hook pins the
 *   steward's words through `pinCommitmentReason` and sends the CID, the way
 *   every reasoned commitment act does, so no surface holds a CID or sends
 *   the sentence in its place.
 *
 * Ordered chains of these calls (first-run setup, opening a season) live in
 * `useCommitmentPoolSetupSequence`, which derives what landed from the chain
 * and retries only the unlanded call.
 *
 * @module hooks/commitment-pooling/useCommitmentPoolMutations
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../config/query-keys";
import { getOntologyChainMaturity } from "../../ontology/query";
import { pinCommitmentReason } from "../../modules/commitment-pooling/reasons";
import { selectCommitmentPoolingAvailability } from "../../modules/commitment-pooling/selectors";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

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
  operator: number;
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

/**
 * The contract call, with every reason already a CID. What `argsFor` encodes.
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
 * hook pins it and sends the CID.
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

/** Only the acts whose ABI takes a `reasonCID`. */
const CID_REASON_ACTIONS = new Set<CommitmentPoolAction>(["pausePool", "cancelCycle"]);

function carriesRawReason(
  input: CommitmentPoolMutationInput
): input is CommitmentPoolReasonedMutationInput {
  return CID_REASON_ACTIONS.has(input.action) && "reason" in input && !("reasonCID" in input);
}

function sumsToTotal(values: number[]): boolean {
  return (
    values.every((value) => Number.isInteger(value) && value >= 0) &&
    values.reduce((sum, value) => sum + value, 0) === ALLOCATION_BPS_TOTAL
  );
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
  const { allocation, recognitionPolicy } = input;
  if (
    !sumsToTotal([
      allocation.gardeners,
      allocation.treasury,
      allocation.operator,
      allocation.evaluator,
      allocation.community,
      allocation.funder,
    ])
  ) {
    throw new Error(
      `InvalidAllocation: the six allocation shares must total exactly ${ALLOCATION_BPS_TOTAL} bps`
    );
  }
  if (
    !sumsToTotal([
      recognitionPolicy.equalParticipationBps,
      recognitionPolicy.verifiedContributionBps,
    ])
  ) {
    throw new Error(
      `InvalidAllocation: the recognition policy must total exactly ${ALLOCATION_BPS_TOTAL} bps`
    );
  }
}

/**
 * Resolve a reasoned input into its call. Pinning happens before any chain
 * work so a pin failure is reported as exactly that and nothing is sent.
 */
async function resolveCall(
  input: CommitmentPoolMutationInput
): Promise<CommitmentPoolMutationCall> {
  if (!carriesRawReason(input)) return input;
  const { reason, gardenAddress, ...call } = input;
  const reasonCID = await pinCommitmentReason({ reason, gardenAddress, source: call.action });
  return { ...call, reasonCID } as CommitmentPoolMutationCall;
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

export function useCommitmentPoolMutation(options: { chainId?: number } = {}) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useCommitmentPoolMutation",
    toastContext: "pool update",
  });

  return useMutation({
    mutationFn: async (input: CommitmentPoolMutationInput) => {
      if (!sender) throw new Error("Transaction sender is unavailable");
      const availability = selectCommitmentPoolingAvailability(
        getOntologyChainMaturity("entity:commitment-pool", chainId)
      );
      if (availability.status !== "available") {
        throw new Error("Commitment Pooling is unavailable on this chain");
      }
      const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
      if (isZeroAddress(moduleAddress))
        throw new Error("Commitment Pooling is not deployed on this chain");
      const call = await resolveCall(input);
      // Encoded before the send so a refused split never reaches the wallet.
      const args = commitmentPoolCallArgs(call);
      const result = await sender.sendContractCall({
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: call.action,
        args,
        chainId,
      });
      return result.hash;
    },
    onSuccess: async (_hash, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.commitmentPooling.all(chainId) });
      if ("poolId" in input) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.commitmentPooling.pool(chainId, input.poolId),
        });
      }
      if ("cycleId" in input) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.commitmentPooling.cycle(chainId, input.cycleId),
        });
      }
    },
    onError: (error, input) => {
      const parsed = parseContractError(error);
      handleError(error, {
        metadata: {
          action: input.action,
          chainId,
          parsedErrorName: parsed.name,
        },
      });
    },
  });
}
