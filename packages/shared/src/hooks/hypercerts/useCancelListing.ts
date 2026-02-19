/**
 * Cancel Listing Hook
 *
 * Cancel an active listing via HypercertsModule.delistFromYield(garden, orderId).
 *
 * @module hooks/hypercerts/useCancelListing
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useWalletClient } from "wagmi";

import { DEFAULT_CHAIN_ID, createPublicClientForChain } from "../../config";
import { logger } from "../../modules/app/logger";
import { HYPERCERTS_MODULE_ABI } from "./hypercert-abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { useAuth } from "../auth/useAuth";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { queryInvalidation } from "../query-keys";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";

export interface UseCancelListingResult {
  cancelListing: (orderId: number) => Promise<void>;
  isCancelling: boolean;
  error: Error | null;
}

export function useCancelListing(gardenAddress?: Address): UseCancelListingResult {
  const { smartAccountClient, smartAccountAddress, eoaAddress } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (orderId: number) => {
      if (!gardenAddress) throw new Error("Garden address required");
      const signer = (smartAccountAddress || eoaAddress) as Address;
      if (!signer) throw new Error("Connect a wallet first");

      const contracts = getNetworkContracts(chainId);
      const moduleAddress = contracts.hypercertsModule as Address;
      if (!moduleAddress || moduleAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("HypercertsModule not deployed on this chain");
      }

      logger.info("[useCancelListing] Cancelling listing", {
        gardenAddress,
        orderId,
        chainId,
      });

      const callData = encodeFunctionData({
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "delistFromYield",
        args: [gardenAddress, BigInt(orderId)],
      });

      if (smartAccountClient) {
        const hash = await smartAccountClient.sendUserOperation({
          account: smartAccountClient.account,
          calls: [{ to: moduleAddress, data: callData, value: 0n }],
        });
        await smartAccountClient.getUserOperationReceipt({ hash });
      } else if (walletClient) {
        const publicClient = createPublicClientForChain(chainId);
        const txHash = await walletClient.sendTransaction({
          to: moduleAddress,
          data: callData,
          account: signer,
        });
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: TX_RECEIPT_TIMEOUT_MS,
        });
      } else {
        throw new Error("No wallet available for transaction");
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
    isCancelling: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
