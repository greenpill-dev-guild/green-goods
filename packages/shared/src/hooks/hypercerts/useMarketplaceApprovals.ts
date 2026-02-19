/**
 * Check marketplace approvals and provide mutation to grant them.
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 */
import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import type { Address } from "../../types/domain";
import { useWalletClient } from "wagmi";

import { DEFAULT_CHAIN_ID, createPublicClientForChain } from "../../config";
import { logger } from "../../modules/app/logger";
import {
  checkMarketplaceApprovals,
  buildApprovalTransactions,
  type MarketplaceApprovals,
} from "../../modules/marketplace";
import { useAuth } from "../auth/useAuth";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { queryKeys, queryInvalidation, STALE_TIME_RARE } from "../query-keys";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";

export interface UseMarketplaceApprovalsResult {
  approvals: MarketplaceApprovals | null;
  isFullyApproved: boolean;
  isLoading: boolean;
  error: Error | null;
  grantApprovals: () => void;
  isGranting: boolean;
}

export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult {
  const { smartAccountAddress, eoaAddress, smartAccountClient } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  const operator = (smartAccountAddress || eoaAddress) as Address | undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.marketplace.approvals(operator ?? ("" as Address), chainId),
    queryFn: operator
      ? () => {
          logger.debug("[useMarketplaceApprovals] Checking approvals", { operator, chainId });
          return checkMarketplaceApprovals(operator, chainId);
        }
      : skipToken,
    staleTime: STALE_TIME_RARE,
  });

  const isFullyApproved = Boolean(data?.exchangeApproved && data?.minterApproved);

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!operator) throw new Error("Connect a wallet first");

      const txs = await buildApprovalTransactions(operator, chainId);

      const publicClient = createPublicClientForChain(chainId);

      // Execute approval transactions sequentially
      if (txs.grantExchange) {
        logger.info("[useMarketplaceApprovals] Granting exchange approval", { operator, chainId });
        if (smartAccountClient) {
          const hash = await smartAccountClient.sendUserOperation({
            account: smartAccountClient.account,
            calls: [{ to: txs.grantExchange.to, data: txs.grantExchange.data, value: 0n }],
          });
          await smartAccountClient.getUserOperationReceipt({ hash });
        } else if (walletClient) {
          const hash = await walletClient.sendTransaction({
            to: txs.grantExchange.to,
            data: txs.grantExchange.data,
            account: operator,
          });
          await publicClient.waitForTransactionReceipt({ hash, timeout: TX_RECEIPT_TIMEOUT_MS });
        }
      }

      if (txs.approveMinter) {
        logger.info("[useMarketplaceApprovals] Granting minter approval", { operator, chainId });
        if (smartAccountClient) {
          const hash = await smartAccountClient.sendUserOperation({
            account: smartAccountClient.account,
            calls: [{ to: txs.approveMinter.to, data: txs.approveMinter.data, value: 0n }],
          });
          await smartAccountClient.getUserOperationReceipt({ hash });
        } else if (walletClient) {
          const hash = await walletClient.sendTransaction({
            to: txs.approveMinter.to,
            data: txs.approveMinter.data,
            account: operator,
          });
          await publicClient.waitForTransactionReceipt({ hash, timeout: TX_RECEIPT_TIMEOUT_MS });
        }
      }
    },
    onSuccess: () => {
      const keysToInvalidate = queryInvalidation.invalidateMarketplace();
      for (const key of keysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error) => {
      logger.error("[useMarketplaceApprovals] Failed to grant approvals", {
        operator,
        chainId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return {
    approvals: data ?? null,
    isFullyApproved,
    isLoading,
    error: error as Error | null,
    grantApprovals: () => {
      grantMutation.mutate();
    },
    isGranting: grantMutation.isPending,
  };
}
