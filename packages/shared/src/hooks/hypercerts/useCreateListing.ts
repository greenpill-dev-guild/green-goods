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
import { useCallback, useEffect, useRef, useState } from "react";
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
import { assertMarketplaceReady, getNetworkContracts } from "../../utils/blockchain/contracts";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { sendCheckpointedCall } from "../../modules/transactions/confirmation";
import type { TxResult } from "../../modules/transactions/types";
import {
  listingSubmissionKey,
  useListingSubmissionStore,
} from "../../stores/useListingSubmissionStore";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import {
  HYPERCERTS_MODULE_ABI,
  MARKETPLACE_ADAPTER_ABI,
} from "../../utils/blockchain/hypercert-abis";

export type ListingStep =
  | "idle"
  | "building"
  | "signing"
  | "registering"
  | "confirming"
  | "pending"
  | "done"
  | "error";

export interface UseCreateListingResult {
  createListing: (params: CreateListingParams) => Promise<void>;
  step: ListingStep;
  isCreating: boolean;
  error: Error | null;
  reset: () => void;
  checkConfirmation: () => Promise<void>;
}

export function useCreateListing(gardenAddress?: Address): UseCreateListingResult {
  const signer = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ListingStep>("idle");
  const [confirmationError, setConfirmationError] = useState<Error | null>(null);

  const scope =
    signer && gardenAddress ? listingSubmissionKey(signer, chainId, gardenAddress) : null;
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const pending = useListingSubmissionStore((state) => (scope ? state.pending[scope] : undefined));
  const [isChecking, setIsChecking] = useState(false);
  const sending = useRef(false);

  const refreshListings = useCallback(
    (garden: Address, onChain: number) => {
      for (const queryKey of queryInvalidation.onMarketplaceListingChanged(garden, onChain)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient]
  );

  const checkConfirmation = useCallback(async () => {
    if (!scope || !pending || !sender || isChecking || sending.current) return;
    setIsChecking(true);
    refreshListings(pending.garden, pending.chainId);
    try {
      const outcome = await sender.reconcileBroadcast?.(
        pending.result.broadcastReference ?? {
          kind: "transaction",
          hash: pending.result.hash,
          chainId: pending.chainId,
        }
      );
      const isCurrent = () =>
        activeScope.current === scope &&
        useListingSubmissionStore.getState().pending[scope] === pending;
      if (!isCurrent()) return;
      if (outcome?.status === "confirmed") {
        useListingSubmissionStore.getState().clear(scope);
        setStep("done");
      } else if (outcome?.status === "reverted") {
        useListingSubmissionStore.getState().clear(scope);
        setConfirmationError(new Error(formatMessage({ id: "app.listing.stepError" })));
        setStep("error");
      } else {
        // The registered signature identifies this exact signed order even when
        // the wallet only returned an off-chain proposal ID.
        const client = createPublicClientForChain(pending.chainId);
        const address = getNetworkContracts(pending.chainId).marketplaceAdapter;
        const orderId = await client.readContract({
          address,
          abi: MARKETPLACE_ADAPTER_ABI,
          functionName: "activeOrders",
          args: [BigInt(pending.hypercertId), pending.currency],
        });
        if (orderId > 0n) {
          const order = await client.readContract({
            address,
            abi: MARKETPLACE_ADAPTER_ABI,
            functionName: "orders",
            args: [orderId],
          });
          if (isCurrent() && order[2].toLowerCase() === pending.signature.toLowerCase()) {
            useListingSubmissionStore.getState().clear(scope);
            setStep("done");
          }
        }
      }
      refreshListings(pending.garden, pending.chainId);
    } catch {
      // A failed read says nothing about execution; keep the submission pending.
    } finally {
      setIsChecking(false);
    }
  }, [scope, pending, sender, isChecking, refreshListings, formatMessage]);

  const mutation = useMutation({
    onMutate: () => {
      sending.current = true;
    },
    onSettled: () => {
      sending.current = false;
    },
    mutationFn: async (params: CreateListingParams) => {
      if (scope && useListingSubmissionStore.getState().pending[scope]) return;
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

      const clearCheckpoint = (result: TxResult) => {
        if (
          scope &&
          useListingSubmissionStore.getState().pending[scope]?.result.hash ===
            (result.broadcastReference?.hash ?? result.hash)
        )
          useListingSubmissionStore.getState().clear(scope);
      };
      const result = await sendCheckpointedCall(
        sender,
        call,
        (result) => {
          useListingSubmissionStore.getState().record({
            account: signer,
            result,
            chainId,
            garden: gardenAddress,
            signature,
            hypercertId: params.hypercertId.toString(),
            currency: params.currency,
          });
        },
        clearCheckpoint,
        { assertOwnership: () => sender.assertOwnership?.(signer, chainId) }
      );
      if (result.confirmation === "pending") {
        useListingSubmissionStore.getState().record({
          account: signer,
          result,
          chainId,
          garden: gardenAddress,
          signature,
          hypercertId: params.hypercertId.toString(),
          currency: params.currency,
        });
        if (activeScope.current === scope) setStep("pending");
        toastService.info({
          title: formatMessage({ id: "app.account.transactionSubmitted" }),
          message: formatMessage({ id: "app.account.transactionPending" }),
        });
        return;
      }

      clearCheckpoint(result);
      if (activeScope.current === scope) setStep("done");
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
      if (activeScope.current !== scope) return;
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
    if (scope && useListingSubmissionStore.getState().pending[scope]) return;
    setStep("idle");
    setConfirmationError(null);
    mutation.reset();
  }, [mutation, scope]);

  const previousScope = useRef(scope);
  useEffect(() => {
    if (previousScope.current === scope) return;
    previousScope.current = scope;
    setStep("idle");
    setConfirmationError(null);
    mutation.reset();
  }, [scope, mutation]);

  return {
    createListing: (params) => mutation.mutateAsync(params),
    step: pending ? "pending" : step,
    isCreating: mutation.isPending || Boolean(pending) || isChecking,
    error: (mutation.error as Error | null) ?? confirmationError,
    checkConfirmation,
    reset,
  };
}
