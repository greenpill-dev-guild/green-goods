/**
 * Check marketplace approvals and provide mutation to grant them.
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 */
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import {
  buildApprovalTransactions,
  checkMarketplaceApprovals,
  type MarketplaceApprovals,
} from "../../modules/marketplace/approvals";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import type { Address } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import { marketplaceKeys } from "../../config/query-keys/hypercert";

export interface UseMarketplaceApprovalsResult {
  approvals: MarketplaceApprovals | null;
  isFullyApproved: boolean;
  isLoading: boolean;
  error: Error | null;
  grantApprovals: () => void;
  isGranting: boolean;
}

export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult {
  const steward = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: marketplaceKeys.approvals(steward ?? ("" as Address), chainId),
    queryFn: steward
      ? () => {
          logger.debug("[useMarketplaceApprovals] Checking approvals", { steward, chainId });
          return checkMarketplaceApprovals(steward, chainId);
        }
      : skipToken,
    staleTime: STALE_TIME_RARE,
  });

  const isFullyApproved = Boolean(data?.exchangeApproved && data?.minterApproved);

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!steward || !sender)
        throw new Error(
          formatMessage({
            id: !steward ? "app.account.signInRequired" : "app.account.signerNotReady",
          })
        );
      await sender.assertOwnership?.(steward, chainId);

      const txs = await buildApprovalTransactions(steward, chainId);

      // The second approval starts only after the first has confirmed.
      for (const call of [txs.grantExchange, txs.approveMinter]) {
        if (!call) continue;
        const result = await sender.sendContractCall(
          { ...call, account: steward, chainId },
          { assertOwnership: () => sender.assertOwnership?.(steward, chainId) }
        );
        if (result.confirmation === "pending")
          throw new Error(formatMessage({ id: "app.account.transactionPending" }));
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
        steward,
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
