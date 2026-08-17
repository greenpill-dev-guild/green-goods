import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";

import { queryKeys } from "../../config/query-keys";
import { getOntologyChainMaturity } from "../../ontology/query";
import type { DeclaredConsiderationInput } from "../../modules/commitment-pooling/jobs";
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

export type CommitmentMutationInput =
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

function argsFor(input: CommitmentMutationInput): readonly unknown[] {
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
      const availability = selectCommitmentPoolingAvailability(
        getOntologyChainMaturity("entity:commitment-pool", chainId)
      );
      if (availability.status !== "available") {
        throw new Error("Commitment Pooling is unavailable on this chain");
      }
      const moduleAddress = getNetworkContracts(chainId).commitmentPoolingModule;
      if (isZeroAddress(moduleAddress))
        throw new Error("Commitment Pooling is not deployed on this chain");
      const result = await sender.sendContractCall({
        address: moduleAddress,
        abi: CommitmentPoolingModuleABI,
        functionName: input.action,
        args: argsFor(input),
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
