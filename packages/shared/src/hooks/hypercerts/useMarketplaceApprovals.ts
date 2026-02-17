/**
 * Check marketplace approvals and provide mutation to grant them.
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useWalletClient } from "wagmi";

import { DEFAULT_CHAIN_ID } from "../../config";
import { logger } from "../../modules/app/logger";
import {
  checkMarketplaceApprovals,
  buildApprovalTransactions,
  type MarketplaceApprovals,
} from "../../modules/marketplace";
import { useAuth } from "../auth/useAuth";
import { useAdminStore, type AdminState } from "../../stores/useAdminStore";
import { queryKeys, queryInvalidation } from "../query-keys";

export interface UseMarketplaceApprovalsResult {
  approvals: MarketplaceApprovals | null;
  isFullyApproved: boolean;
  isLoading: boolean;
  error: Error | null;
  grantApprovals: () => Promise<void>;
  isGranting: boolean;
}

export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult {
  const { smartAccountAddress, eoaAddress, smartAccountClient } = useAuth();
  const { data: walletClient } = useWalletClient();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  const operator = (smartAccountAddress || eoaAddress) as Address | undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.marketplace.approvals(operator!, chainId),
    queryFn: () => {
      logger.debug("[useMarketplaceApprovals] Checking approvals", { operator, chainId });
      return checkMarketplaceApprovals(operator!, chainId);
    },
    enabled: Boolean(operator),
  });

  const isFullyApproved = Boolean(data?.exchangeApproved && data?.minterApproved);

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!operator) throw new Error("Connect a wallet first");

      const txs = await buildApprovalTransactions(operator, chainId);

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
          await walletClient.sendTransaction({
            to: txs.grantExchange.to,
            data: txs.grantExchange.data,
            account: operator,
          });
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
          await walletClient.sendTransaction({
            to: txs.approveMinter.to,
            data: txs.approveMinter.data,
            account: operator,
          });
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
    grantApprovals: () => grantMutation.mutateAsync(),
    isGranting: grantMutation.isPending,
  };
}
