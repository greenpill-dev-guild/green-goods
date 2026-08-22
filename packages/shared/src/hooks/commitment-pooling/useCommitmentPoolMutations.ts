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
import {
  type CommitmentPoolAction,
  type CommitmentPoolMutationCall,
  type CommitmentPoolMutationInput,
  type CommitmentPoolReasonedMutationInput,
  commitmentPoolCallArgs,
} from "../../modules/commitment-pooling/pool-lifecycle";
import { pinCommitmentReason } from "../../modules/commitment-pooling/reasons";
import { selectCommitmentPoolingAvailability } from "../../modules/commitment-pooling/selectors";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

export type {
  CommitmentAllocationBps,
  CommitmentCycleTypeInput,
  CommitmentPoolAction,
  CommitmentPoolMutationCall,
  CommitmentPoolMutationInput,
  CommitmentPoolReasonedMutationInput,
  CommitmentRecognitionPolicyBps,
} from "../../modules/commitment-pooling/pool-lifecycle";
export {
  ALLOCATION_BPS_TOTAL,
  assertCycleSplit,
  commitmentPoolCallArgs,
  DEFAULT_ALLOCATION_BPS,
  DEFAULT_RECOGNITION_POLICY_BPS,
  isValidCycleSplit,
} from "../../modules/commitment-pooling/pool-lifecycle";

/** Only the acts whose ABI takes a `reasonCID`. */
const CID_REASON_ACTIONS = new Set<CommitmentPoolAction>(["pausePool", "cancelCycle"]);

function carriesRawReason(
  input: CommitmentPoolMutationInput
): input is CommitmentPoolReasonedMutationInput {
  return CID_REASON_ACTIONS.has(input.action) && "reason" in input && !("reasonCID" in input);
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

/**
 * The module a pool write goes to, once the chain is known to serve pooling.
 * Shared with the setup sequence so both refuse the same way.
 */
export function resolveCommitmentPoolingModule(chainId: number): Address {
  const availability = selectCommitmentPoolingAvailability(
    getOntologyChainMaturity("entity:commitment-pool", chainId)
  );
  if (availability.status !== "available") {
    throw new Error("Commitment Pooling is unavailable on this chain");
  }
  const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
  if (isZeroAddress(moduleAddress)) {
    throw new Error("Commitment Pooling is not deployed on this chain");
  }
  return moduleAddress;
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
      const moduleAddress = resolveCommitmentPoolingModule(chainId);
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
