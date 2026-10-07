/**
 * Create Listing Hook
 *
 * Two-phase listing creation:
 * 1. Build + sign EIP-712 maker ask order (account signature prompt)
 * 2. Register on-chain via HypercertsModule.listForYield()
 *
 * @module hooks/hypercerts/useCreateListing
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { type Address } from "viem";
import { toastService } from "../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { createPublicClientForChain } from "../../config/pimlico";
import { trackContractError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { getOrderNonces } from "../../modules/marketplace/client";
import { buildMakerAsk, signMakerAsk, validateOrder } from "../../modules/marketplace/signing";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { CreateListingParams } from "../../types/hypercerts";
import { assertMarketplaceReady } from "../../utils/blockchain/contracts";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { TransactionConfirmationPendingError } from "../../modules/transactions/types";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { HYPERCERTS_MODULE_ABI } from "../../utils/blockchain/hypercert-abis";

export type ListingStep =
  | "idle"
  | "building"
  | "signing"
  | "registering"
  | "confirming"
  | "done"
  | "error";

export interface UseCreateListingResult {
  createListing: (params: CreateListingParams) => Promise<void>;
  step: ListingStep;
  isCreating: boolean;
  error: Error | null;
  reset: () => void;
}

export function useCreateListing(gardenAddress?: Address): UseCreateListingResult {
  const signer = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ListingStep>("idle");

  const mutation = useMutation({
    mutationFn: async (params: CreateListingParams) => {
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

      // Step 1: Build the maker ask order (with on-chain nonces)
      setStep("building");
      logger.info("[useCreateListing] Building maker ask", {
        gardenAddress,
        hypercertId: params.hypercertId.toString(),
        chainId,
      });

      const publicClient = createPublicClientForChain(chainId);
      const nonces = await getOrderNonces(signer, chainId, publicClient);
      const makerAsk = buildMakerAsk(params, signer, chainId, nonces);

      // Validate order before signing
      const validation = validateOrder(makerAsk, chainId);
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.errors.join(", ")}`);
      }

      // Step 2: Sign EIP-712 (account signature prompt)
      setStep("signing");
      logger.info("[useCreateListing] Requesting EIP-712 signature", { signer, chainId });

      const signature = await signMakerAsk(makerAsk, sender, chainId);

      // Step 3: Register on-chain via HypercertsModule.listForYield()
      setStep("registering");
      logger.info("[useCreateListing] Registering order on-chain", {
        gardenAddress,
        hypercertId: params.hypercertId.toString(),
      });

      // Build the maker ask struct for the contract call
      // viem requires named struct fields matching ABI component names
      const makerAskStruct = {
        quoteType: makerAsk.quoteType,
        globalNonce: makerAsk.globalNonce,
        subsetNonce: makerAsk.subsetNonce,
        orderNonce: makerAsk.orderNonce,
        strategyId: makerAsk.strategyId,
        collectionType: makerAsk.collectionType,
        collection: makerAsk.collection,
        currency: makerAsk.currency,
        signer: makerAsk.signer,
        startTime: makerAsk.startTime,
        endTime: makerAsk.endTime,
        price: makerAsk.price,
        itemIds: makerAsk.itemIds,
        amounts: makerAsk.amounts,
        additionalParameters: makerAsk.additionalParameters,
      };

      const call = {
        address: moduleAddress,
        account: signer,
        chainId,
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "listForYield",
        args: [gardenAddress, params.hypercertId, makerAskStruct, signature],
      };

      setStep("confirming");

      const result = await sender.sendContractCall(call, {
        assertOwnership: () => sender.assertOwnership?.(signer, chainId),
      });
      if (result.confirmation === "pending") throw new TransactionConfirmationPendingError();

      setStep("done");
      logger.info("[useCreateListing] Listing created successfully", {
        gardenAddress,
        hypercertId: params.hypercertId.toString(),
      });
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
      setStep("error");

      const { title, message, parsed } = parseAndFormatError(error);
      const displayMessage =
        error instanceof TransactionConfirmationPendingError
          ? formatMessage({ id: "app.account.transactionPending" })
          : parsed.isKnown
            ? message
            : "Failed to create listing. Please try again.";
      const displayTitle =
        error instanceof TransactionConfirmationPendingError
          ? formatMessage({ id: "app.account.transactionSubmitted" })
          : parsed.isKnown
            ? title
            : "Listing failed";

      logger.error("[useCreateListing] Failed to create listing", {
        gardenAddress,
        chainId,
        error: error instanceof Error ? error.message : String(error),
        parsedError: parsed.name,
      });

      trackContractError(error, {
        source: "useCreateListing",
        gardenAddress,
        metadata: { chainId },
      });

      toastService.error({ title: displayTitle, message: displayMessage });
    },
  });

  const reset = useCallback(() => {
    setStep("idle");
    mutation.reset();
  }, [mutation]);

  return {
    createListing: (params) => mutation.mutateAsync(params),
    step,
    isCreating: mutation.isPending,
    error:
      mutation.error instanceof TransactionConfirmationPendingError
        ? new Error(formatMessage({ id: "app.account.transactionPending" }))
        : (mutation.error as Error | null),
    reset,
  };
}
