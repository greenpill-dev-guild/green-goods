/**
 * Batch List For Yield Hook
 *
 * Batch list multiple hypercerts for yield in a single transaction.
 * Signs all maker asks sequentially, then calls HypercertsModule.batchListForYield().
 *
 * @module hooks/hypercerts/useBatchListForYield
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { type Address, type Hex } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { createPublicClientForChain } from "../../config/pimlico";
import { logger } from "../../modules/app/logger";
import { getOrderNonces } from "../../modules/marketplace/client";
import {
  buildMakerAsk,
  type MakerAskOrder,
  signMakerAsk,
  validateOrder,
} from "../../modules/marketplace/signing";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { CreateListingParams } from "../../types/hypercerts";
import { assertMarketplaceReady } from "../../utils/blockchain/contracts";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { HYPERCERTS_MODULE_ABI } from "../../utils/blockchain/hypercert-abis";

export interface BatchProgress {
  total: number;
  signed: number;
  status: "idle" | "signing" | "submitting" | "confirming" | "done" | "pending" | "error";
}

export interface UseBatchListForYieldResult {
  batchList: (listings: CreateListingParams[]) => Promise<void>;
  isBatching: boolean;
  progress: BatchProgress;
  error: Error | null;
  reset: () => void;
}

const INITIAL_PROGRESS: BatchProgress = { total: 0, signed: 0, status: "idle" };

export function useBatchListForYield(gardenAddress?: Address): UseBatchListForYieldResult {
  const signer = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BatchProgress>(INITIAL_PROGRESS);

  const pendingSubmission = useRef(false);

  const mutation = useMutation({
    mutationFn: async (listings: CreateListingParams[]) => {
      if (pendingSubmission.current) return;
      if (!gardenAddress) throw new Error("Garden address required");
      if (listings.length === 0) throw new Error("No listings to create");

      if (!signer || !sender)
        throw new Error(
          formatMessage({
            id: !signer ? "app.account.signInRequired" : "app.account.signerNotReady",
          })
        );
      await sender.assertOwnership?.(signer, chainId);

      const readiness = assertMarketplaceReady(chainId);
      const moduleAddress = readiness.addresses.hypercertsModule;

      setProgress({ total: listings.length, signed: 0, status: "signing" });

      logger.info("[useBatchListForYield] Starting batch listing", {
        gardenAddress,
        count: listings.length,
        chainId,
      });

      // Build and sign all maker asks sequentially (each uses the signed-in account)
      const hypercertIds: bigint[] = [];
      const makerAskStructs: Array<{
        quoteType: number;
        globalNonce: bigint;
        subsetNonce: bigint;
        orderNonce: bigint;
        strategyId: bigint;
        collectionType: number;
        collection: Address;
        currency: Address;
        signer: Address;
        startTime: bigint;
        endTime: bigint;
        price: bigint;
        itemIds: bigint[];
        amounts: bigint[];
        additionalParameters: Hex;
      }> = [];
      const signatures: Hex[] = [];

      for (let i = 0; i < listings.length; i++) {
        const params = listings[i];
        const nonces = await getOrderNonces(signer, chainId, createPublicClientForChain(chainId));
        const makerAsk: MakerAskOrder = buildMakerAsk(params, signer, chainId, nonces);

        const validation = validateOrder(makerAsk, chainId);
        if (!validation.valid) {
          throw new Error(`Order #${i + 1} validation failed: ${validation.errors.join(", ")}`);
        }

        const signature = await signMakerAsk(makerAsk, sender, chainId);

        hypercertIds.push(params.hypercertId);
        makerAskStructs.push({
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
        });
        signatures.push(signature);

        setProgress((prev) => ({ ...prev, signed: i + 1 }));
      }

      // Submit batch transaction
      setProgress((prev) => ({ ...prev, status: "submitting" }));

      const call = {
        address: moduleAddress,
        account: signer,
        chainId,
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "batchListForYield",
        args: [gardenAddress, hypercertIds, makerAskStructs, signatures],
      };

      setProgress((prev) => ({ ...prev, status: "confirming" }));

      const result = await sender.sendContractCall(call, {
        assertOwnership: () => sender.assertOwnership?.(signer, chainId),
      });
      if (result.confirmation === "pending") {
        pendingSubmission.current = true;
        setProgress((prev) => ({ ...prev, status: "pending" }));
        return;
      }

      setProgress((prev) => ({ ...prev, status: "done" }));
      logger.info("[useBatchListForYield] Batch listing complete", {
        gardenAddress,
        count: listings.length,
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
      setProgress((prev) => ({ ...prev, status: "error" }));
      logger.error("[useBatchListForYield] Batch listing failed", {
        gardenAddress,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const reset = useCallback(() => {
    if (pendingSubmission.current) return;
    setProgress(INITIAL_PROGRESS);
    mutation.reset();
  }, [mutation]);

  return {
    batchList: (listings) => mutation.mutateAsync(listings),
    isBatching: mutation.isPending || progress.status === "pending",
    progress,
    error: mutation.error as Error | null,
    reset,
  };
}
