/**
 * Cancel Listing Hook
 *
 * Cancel an active listing via HypercertsModule.delistFromYield(garden, orderId).
 *
 * @module hooks/hypercerts/useCancelListing
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface UseCancelListingResult {
  cancelListing: (orderId: number) => Promise<void>;
  isCancelling: boolean;
  error: Error | null;
}

export function useCancelListing(gardenAddress?: Address): UseCancelListingResult {
  const signer = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (orderId: number) => {
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
      if (result.confirmation === "pending")
        throw new Error(formatMessage({ id: "app.account.transactionPending" }));

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
    isCancelling: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
