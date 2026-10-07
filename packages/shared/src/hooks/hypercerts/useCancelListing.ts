/**
 * Cancel Listing Hook
 *
 * Cancel an active listing via HypercertsModule.delistFromYield(garden, orderId).
 *
 * @module hooks/hypercerts/useCancelListing
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { type Address } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { assertMarketplaceReady } from "../../utils/blockchain/contracts";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { HYPERCERTS_MODULE_ABI } from "../../utils/blockchain/hypercert-abis";
import {
  listingSubmissionKey,
  useListingSubmissionStore,
} from "../../stores/useListingSubmissionStore";
import { reconcileTransaction } from "../../modules/transactions/confirmation";
import type { TxResult } from "../../modules/transactions/types";
import { createPublicClientForChain } from "../../config/pimlico";

export interface UseCancelListingResult {
  cancelListing: (orderId: number) => Promise<void>;
  isCancelling: boolean;
  error: Error | null;
  pendingCancellation?: { orderId: number; result: TxResult };
  checkConfirmation: () => Promise<void>;
  isCheckingConfirmation: boolean;
}

export function useCancelListing(gardenAddress?: Address): UseCancelListingResult {
  const signer = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const scope =
    signer && gardenAddress ? listingSubmissionKey(signer, chainId, gardenAddress) : null;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const pendingCancellation = useListingSubmissionStore((state) =>
    scope ? state.cancellations[scope] : undefined
  );
  const [isCheckingConfirmation, setIsCheckingConfirmation] = useState(false);
  const [confirmationError, setConfirmationError] = useState<Error | null>(null);
  const refresh = () => {
    if (gardenAddress)
      for (const queryKey of queryInvalidation.onMarketplaceListingChanged(gardenAddress, chainId))
        void queryClient.invalidateQueries({ queryKey });
  };
  const checkConfirmation = async () => {
    if (!scope || !sender || !pendingCancellation || isCheckingConfirmation) return;
    setIsCheckingConfirmation(true);
    try {
      const outcome = await reconcileTransaction(sender, pendingCancellation.result, (hash) =>
        createPublicClientForChain(chainId).getTransactionReceipt({ hash })
      );
      if (
        activeScope.current !== scope ||
        useListingSubmissionStore.getState().cancellations[scope] !== pendingCancellation
      )
        return;
      if (outcome.status === "unresolved") return;
      useListingSubmissionStore.getState().clearCancellation(scope);
      if (outcome.status === "reverted")
        setConfirmationError(new Error(formatMessage({ id: "app.account.transactionReverted" })));
      refresh();
    } finally {
      setIsCheckingConfirmation(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (orderId: number) => {
      if (scope && useListingSubmissionStore.getState().cancellations[scope]) return;
      setConfirmationError(null);
      if (!gardenAddress) throw new Error("Garden address required");
      if (!signer || !sender)
        throw new Error(
          formatMessage({
            id: !signer ? "app.account.signInRequired" : "app.account.signerNotReady",
          })
        );
      await sender.assertOwnership?.(signer, chainId);

      const readiness = assertMarketplaceReady(chainId);
      const moduleAddress = readiness.addresses.hypercertsModule;

      logger.info("[useCancelListing] Cancelling listing", {
        gardenAddress,
        orderId,
        chainId,
      });

      const call = {
        address: moduleAddress,
        account: signer,
        chainId,
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "delistFromYield",
        args: [gardenAddress, BigInt(orderId)],
      };

      const result = await sender.sendContractCall(call, {
        assertOwnership: () => sender.assertOwnership?.(signer, chainId),
      });
      if (result.confirmation === "pending" && scope) {
        useListingSubmissionStore.getState().recordCancellation(scope, orderId, result);
        return;
      }

      logger.info("[useCancelListing] Listing cancelled", { gardenAddress, orderId });
    },
    onSuccess: () => {
      if (gardenAddress) {
        const keysToInvalidate = queryInvalidation.onMarketplaceListingChanged(
          gardenAddress,
          chainId
        );
        for (const key of keysToInvalidate) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
    onError: (error) => {
      logger.error("[useCancelListing] Failed to cancel listing", {
        gardenAddress,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return {
    cancelListing: (orderId) => mutation.mutateAsync(orderId),
    isCancelling: mutation.isPending || Boolean(pendingCancellation),
    pendingCancellation,
    checkConfirmation,
    isCheckingConfirmation,
    error: (mutation.error as Error | null) ?? confirmationError,
  };
}
