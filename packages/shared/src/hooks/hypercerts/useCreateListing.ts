/**
 * Create Listing Hook
 *
 * Two-phase listing creation:
 * 1. Build + sign EIP-712 maker ask order (gasless wallet popup)
 * 2. Register on-chain via HypercertsModule.listForYield()
 *
 * @module hooks/hypercerts/useCreateListing
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { type Address, encodeFunctionData } from "viem";
import { useWalletClient } from "wagmi";

import { DEFAULT_CHAIN_ID, createPublicClientForChain } from "../../config";
import { logger } from "../../modules/app/logger";
import { trackContractError } from "../../modules/app/error-tracking";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { toastService } from "../../components/Toast/toast.service";
import {
  buildMakerAsk,
  getOrderNonces,
  signMakerAsk,
  validateOrder,
} from "../../modules/marketplace";
import { HYPERCERTS_MODULE_ABI } from "./hypercert-abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import type { CreateListingParams } from "../../types/hypercerts";
import { useAuth } from "../auth/useAuth";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { queryInvalidation } from "../query-keys";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";

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
  const { smartAccountClient, smartAccountAddress, eoaAddress } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ListingStep>("idle");

  const mutation = useMutation({
    mutationFn: async (params: CreateListingParams) => {
      if (!gardenAddress) throw new Error("Garden address required");
      const signer = (smartAccountAddress || eoaAddress) as Address;
      if (!signer) throw new Error("Connect a wallet first");

      const contracts = getNetworkContracts(chainId);
      const moduleAddress = contracts.hypercertsModule as Address;
      if (!moduleAddress || moduleAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("HypercertsModule not deployed on this chain");
      }

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

      // Step 2: Sign EIP-712 (gasless wallet popup)
      setStep("signing");
      logger.info("[useCreateListing] Requesting EIP-712 signature", { signer, chainId });

      if (!walletClient) {
        throw new Error("Wallet client not available for signing");
      }
      const signature = await signMakerAsk(makerAsk, walletClient, chainId);

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

      const callData = encodeFunctionData({
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "listForYield",
        args: [gardenAddress, params.hypercertId, makerAskStruct, signature],
      });

      setStep("confirming");

      if (smartAccountClient) {
        const hash = await smartAccountClient.sendUserOperation({
          account: smartAccountClient.account,
          calls: [{ to: moduleAddress, data: callData, value: 0n }],
        });
        await smartAccountClient.getUserOperationReceipt({ hash });
      } else if (walletClient) {
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
      const displayMessage = parsed.isKnown
        ? message
        : "Failed to create listing. Please try again.";
      const displayTitle = parsed.isKnown ? title : "Listing failed";

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
    error: mutation.error as Error | null,
    reset,
  };
}
