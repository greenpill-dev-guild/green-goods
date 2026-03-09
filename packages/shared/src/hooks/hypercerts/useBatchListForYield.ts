/**
 * Batch List For Yield Hook
 *
 * Batch list multiple hypercerts for yield in a single transaction.
 * Signs all maker asks sequentially, then calls HypercertsModule.batchListForYield().
 *
 * @module hooks/hypercerts/useBatchListForYield
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { useWalletClient } from "wagmi";

import { createPublicClientForChain, DEFAULT_CHAIN_ID } from "../../config";
import { logger } from "../../modules/app/logger";
import { isZeroAddress } from "../../utils/blockchain/address";
import {
  buildMakerAsk,
  type MakerAskOrder,
  signMakerAsk,
  validateOrder,
} from "../../modules/marketplace";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { CreateListingParams } from "../../types/hypercerts";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { useAuth } from "../auth/useAuth";
import { queryInvalidation } from "../query-keys";
import { HYPERCERTS_MODULE_ABI } from "./hypercert-abis";

export interface BatchProgress {
  total: number;
  signed: number;
  status: "idle" | "signing" | "submitting" | "confirming" | "done" | "error";
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
  const { smartAccountClient, smartAccountAddress, eoaAddress } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BatchProgress>(INITIAL_PROGRESS);

  const mutation = useMutation({
    mutationFn: async (listings: CreateListingParams[]) => {
      if (!gardenAddress) throw new Error("Garden address required");
      if (listings.length === 0) throw new Error("No listings to create");

      const signer = (smartAccountAddress || eoaAddress) as Address;
      if (!signer) throw new Error("Connect a wallet first");
      if (!walletClient) throw new Error("Wallet client not available for signing");

      const contracts = getNetworkContracts(chainId);
      const moduleAddress = contracts.hypercertsModule as Address;
      if (isZeroAddress(moduleAddress)) {
        throw new Error("HypercertsModule not deployed on this chain");
      }

      setProgress({ total: listings.length, signed: 0, status: "signing" });

      logger.info("[useBatchListForYield] Starting batch listing", {
        gardenAddress,
        count: listings.length,
        chainId,
      });

      // Build and sign all maker asks sequentially (each requires wallet popup)
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
        const makerAsk: MakerAskOrder = buildMakerAsk(params, signer, chainId);

        const validation = validateOrder(makerAsk, chainId);
        if (!validation.valid) {
          throw new Error(`Order #${i + 1} validation failed: ${validation.errors.join(", ")}`);
        }

        const signature = await signMakerAsk(makerAsk, walletClient, chainId);

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

      const callData = encodeFunctionData({
        abi: HYPERCERTS_MODULE_ABI,
        functionName: "batchListForYield",
        args: [gardenAddress, hypercertIds, makerAskStructs, signatures],
      });

      setProgress((prev) => ({ ...prev, status: "confirming" }));

      if (smartAccountClient) {
        const hash = await smartAccountClient.sendUserOperation({
          account: smartAccountClient.account,
          calls: [{ to: moduleAddress, data: callData, value: 0n }],
        });
        await smartAccountClient.getUserOperationReceipt({ hash });
      } else {
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
    setProgress(INITIAL_PROGRESS);
    mutation.reset();
  }, [mutation]);

  return {
    batchList: (listings) => mutation.mutateAsync(listings),
    isBatching: mutation.isPending,
    progress,
    error: mutation.error as Error | null,
    reset,
  };
}
