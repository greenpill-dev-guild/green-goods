/**
 * Check marketplace approvals and provide mutation to grant them.
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 */
import { readMarketplaceSubmissionOutcome } from "../../modules/marketplace/pending";
import {
  marketplaceSubmissionScope,
  useMarketplacePendingStore,
  type MarketplacePendingSubmission,
} from "../../stores/useMarketplacePendingStore";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import {
  TransactionRevertedError,
  TransactionReplacementError,
} from "../../modules/transactions/types";
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
  isPending: boolean;
  checkPending: () => void;
  isChecking: boolean;
}

export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult {
  const steward = usePrimaryAddress();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const scope = marketplaceSubmissionScope(chainId, steward);
  const pending = useMarketplacePendingStore((state) => (scope ? state.pending[scope] : undefined));
  const store = useMarketplacePendingStore.getState;

  const { data, isLoading, error, refetch } = useQuery({
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

  const checkMutation = useMutation({
    mutationFn: async () => {
      if (!scope || pending?.kind !== "approval") return;
      const outcome = await readMarketplaceSubmissionOutcome(pending, sender, chainId);
      const refreshed = await refetch();
      if (outcome.status === "reverted" || (!refreshed.isError && refreshed.data?.[pending.step]))
        store().clear(scope, pending);
    },
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!steward || !sender)
        throw new Error(
          formatMessage({
            id: !steward ? "app.account.signInRequired" : "app.account.signerNotReady",
          })
        );
      if (!scope || !store().begin(scope)) return;
      try {
        await sender.assertOwnership?.(steward, chainId);
        const txs = await buildApprovalTransactions(steward, chainId);
        // The second approval starts only after the first has confirmed.
        for (const [step, call] of [
          ["exchangeApproved", txs.grantExchange],
          ["minterApproved", txs.approveMinter],
        ] as const) {
          if (!call) continue;
          const record: MarketplacePendingSubmission = { kind: "approval", step };
          try {
            const result = await sender.sendContractCall(
              { ...call, account: steward, chainId },
              {
                assertOwnership: () => sender.assertOwnership?.(steward, chainId),
                onBeforeBroadcast: async (reference) => {
                  store().checkpoint(scope, { ...record, reference });
                },
                onBroadcastReference: async (reference) => {
                  store().checkpoint(scope, { ...record, reference });
                },
              }
            );
            if (result.confirmation === "pending") {
              store().checkpoint(scope, {
                ...record,
                reference: { kind: "transaction", hash: result.hash },
              });
              return;
            }
            store().clear(scope);
          } catch (error) {
            if (
              error instanceof TransactionRevertedError ||
              error instanceof TransactionReplacementError ||
              (isCancelledTxError(error) && !store().pending[scope]?.reference)
            )
              store().clear(scope);
            throw error;
          }
        }
      } finally {
        store().finish(scope);
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
    error: (checkMutation.error ?? grantMutation.error ?? error) as Error | null,
    grantApprovals: () => {
      grantMutation.mutate();
    },
    isGranting: grantMutation.isPending,
    isPending: Boolean(pending) && !grantMutation.isPending,
    checkPending: () => checkMutation.mutate(),
    isChecking: checkMutation.isPending,
  };
}
