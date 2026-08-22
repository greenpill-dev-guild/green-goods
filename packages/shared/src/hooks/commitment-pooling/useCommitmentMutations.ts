import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";

import { queryKeys } from "../../config/query-keys";
import { getOntologyChainMaturity } from "../../ontology/query";
import type { DeclaredConsiderationInput } from "../../modules/commitment-pooling/jobs";
import { pinCommitmentReason } from "../../modules/commitment-pooling/reasons";
import { isDemoPoolingActive } from "../../modules/commitment-pooling/demo/demo-mode";
import { selectCommitmentPoolingAvailability } from "../../modules/commitment-pooling/selectors";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { CommitmentPoolingModuleABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

export type CommitmentOnlineAction =
  | "acceptClaim"
  | "declineClaim"
  | "acceptExchange"
  | "joinCommitment"
  | "leaveCommitment"
  | "addContributor"
  | "removeContributor"
  | "setContributorRequirement"
  | "attachAssessment"
  | "markReadyForConfirmation"
  | "confirmFulfillmentAsFallback"
  | "cancelCommitment"
  | "expireCommitment"
  | "raiseDispute"
  | "resolveDispute"
  | "setDeclaredConsideration"
  | "setDeclaredValue"
  | "setConfirmerRule"
  | "updateCommitmentSeriesMetadata"
  | "restCommitmentSeries"
  | "resumeCommitmentSeries"
  | "retireCommitmentSeries";

/**
 * The contract call, with every reason already a CID. What `argsFor` encodes.
 */
export type CommitmentMutationCall =
  | { action: "acceptClaim"; commitmentId: bigint; claimant: Address }
  | { action: "declineClaim"; commitmentId: bigint; claimant: Address; reasonCID: string }
  | { action: "acceptExchange"; commitmentId: bigint }
  | { action: "joinCommitment" | "leaveCommitment" | "expireCommitment"; commitmentId: bigint }
  | { action: "addContributor" | "removeContributor"; commitmentId: bigint; contributor: Address }
  | {
      action: "setContributorRequirement";
      commitmentId: bigint;
      contributor: Address;
      requirementIndex: number;
      assigned: boolean;
    }
  | { action: "attachAssessment"; commitmentId: bigint; assessmentUID: Hex }
  | { action: "markReadyForConfirmation"; commitmentId: bigint; reason: string }
  | { action: "confirmFulfillmentAsFallback"; commitmentId: bigint; reason: string }
  | { action: "cancelCommitment" | "raiseDispute"; commitmentId: bigint; reasonCID: string }
  | { action: "resolveDispute"; commitmentId: bigint; resolution: number; reasonCID: string }
  | {
      action: "setDeclaredConsideration";
      commitmentId: bigint;
      consideration: DeclaredConsiderationInput;
    }
  | {
      action: "setDeclaredValue";
      commitmentId: bigint;
      declaredUnitValue: bigint;
      declaredValueBasis: string;
    }
  | {
      action: "setConfirmerRule";
      commitmentId: bigint;
      confirmers: Address[];
      threshold: number;
      protocolFallbackEnabled: boolean;
    }
  | { action: "updateCommitmentSeriesMetadata"; seriesId: bigint; metadataCID: string }
  | {
      action: "restCommitmentSeries" | "resumeCommitmentSeries" | "retireCommitmentSeries";
      seriesId: bigint;
    };

/**
 * The same acts with the reason still in the member's words. The hook pins the
 * reason and sends the CID, so no surface ever holds a CID or, worse, sends the
 * text in its place. A caller that already has a CID uses the call shape.
 */
export type CommitmentReasonedMutationInput =
  | {
      action: "cancelCommitment" | "raiseDispute";
      commitmentId: bigint;
      reason: string;
      /** For upload tracking only; the call itself is commitment-scoped. */
      gardenAddress?: Address | null;
    }
  | {
      action: "resolveDispute";
      commitmentId: bigint;
      resolution: number;
      reason: string;
      gardenAddress?: Address | null;
    }
  | {
      action: "declineClaim";
      commitmentId: bigint;
      claimant: Address;
      reason: string;
      gardenAddress?: Address | null;
    };

export type CommitmentMutationInput = CommitmentMutationCall | CommitmentReasonedMutationInput;

/**
 * Only the acts whose ABI takes a `reasonCID`. `markReadyForConfirmation` and
 * `confirmFulfillmentAsFallback` take a plain `reason` string on chain and must
 * not be pinned.
 */
const CID_REASON_ACTIONS = new Set<CommitmentOnlineAction>([
  "cancelCommitment",
  "raiseDispute",
  "resolveDispute",
  "declineClaim",
]);

function carriesRawReason(
  input: CommitmentMutationInput
): input is CommitmentReasonedMutationInput {
  return CID_REASON_ACTIONS.has(input.action) && "reason" in input && !("reasonCID" in input);
}

/**
 * Resolve a reasoned input into its call. Pinning happens before any chain
 * work so a pin failure is reported as exactly that and nothing is sent.
 */
async function resolveCall(input: CommitmentMutationInput): Promise<CommitmentMutationCall> {
  if (!carriesRawReason(input)) return input;
  const { reason, gardenAddress, ...call } = input;
  const reasonCID = await pinCommitmentReason({ reason, gardenAddress, source: call.action });
  return { ...call, reasonCID } as CommitmentMutationCall;
}

function argsFor(input: CommitmentMutationCall): readonly unknown[] {
  switch (input.action) {
    case "acceptClaim":
      return [input.commitmentId, input.claimant];
    case "declineClaim":
      return [input.commitmentId, input.claimant, input.reasonCID];
    case "acceptExchange":
    case "joinCommitment":
    case "leaveCommitment":
    case "expireCommitment":
      return [input.commitmentId];
    case "addContributor":
    case "removeContributor":
      return [input.commitmentId, input.contributor];
    case "setContributorRequirement":
      return [input.commitmentId, input.contributor, input.requirementIndex, input.assigned];
    case "attachAssessment":
      return [input.commitmentId, input.assessmentUID];
    case "markReadyForConfirmation":
    case "confirmFulfillmentAsFallback":
      return [input.commitmentId, input.reason];
    case "cancelCommitment":
    case "raiseDispute":
      return [input.commitmentId, input.reasonCID];
    case "resolveDispute":
      return [input.commitmentId, input.resolution, input.reasonCID];
    case "setDeclaredConsideration":
      return [input.commitmentId, input.consideration];
    case "setDeclaredValue":
      return [input.commitmentId, input.declaredUnitValue, input.declaredValueBasis];
    case "setConfirmerRule":
      return [input.commitmentId, input.confirmers, input.threshold, input.protocolFallbackEnabled];
    case "updateCommitmentSeriesMetadata":
      return [input.seriesId, input.metadataCID];
    case "restCommitmentSeries":
    case "resumeCommitmentSeries":
    case "retireCommitmentSeries":
      return [input.seriesId];
  }
}

export function useCommitmentMutation(options: { chainId?: number } = {}) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useCommitmentMutation",
    toastContext: "commitment update",
  });

  return useMutation({
    mutationFn: async (input: CommitmentMutationInput) => {
      if (!sender) throw new Error("Transaction sender is unavailable");
      // The reads are fixtures in demo mode but the sender is real, so an act
      // composed against a fixture id must not reach the deployed module.
      if (isDemoPoolingActive()) {
        throw new Error("Commitment Pooling is in demo mode; this act is not sent");
      }
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
      const result = await sender.sendContractCall({
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: call.action,
        args: argsFor(call),
        chainId,
      });
      return result.hash;
    },
    onSuccess: async (_hash, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.commitmentPooling.all(chainId) });
      if ("commitmentId" in input) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.commitmentPooling.commitment(chainId, input.commitmentId),
        });
      }
      if ("seriesId" in input) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.commitmentPooling.series(chainId, input.seriesId),
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
