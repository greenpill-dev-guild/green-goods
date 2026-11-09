/**
 * Check marketplace approvals and provide mutation to grant them.
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 * On a listed rail both go under one signature, and land together or not at all.
 */
import {
  clearMarketplacePendingAfterWalletReview,
  readMarketplaceSubmissionOutcome,
} from "../../modules/marketplace/pending";
import {
  type MarketplaceApprovalStep,
  marketplaceSubmissionScope,
  useMarketplacePendingStore,
  type MarketplacePendingSubmission,
  type MarketplaceSubmissionReference,
} from "../../stores/useMarketplacePendingStore";
import { refusedForWalletNetwork } from "../../utils/errors/wallet-network-refusal";
import { isCancelledTxError } from "../../utils/errors/tx-error-classifier";
import {
  type ContractCall,
  TransactionRevertedError,
  TransactionReplacementError,
  type TxResult,
} from "../../modules/transactions/types";
import { verifyByReading } from "../../modules/transactions/batch-hold";
import {
  BatchConfirmationPendingError,
  type BatchBudget,
} from "../../modules/transactions/batch-types";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { logger } from "../../modules/app/logger";
import {
  buildApprovalTransactions,
  checkMarketplaceApprovals,
  type MarketplaceApprovals,
  marketplaceApprovalBudget,
} from "../../modules/marketplace/approvals";
import { type AdminState, useAdminStore } from "../../stores/useAdminStore";
import { useUser } from "../auth/useUser";
import { useAtomicBatchRoute } from "../blockchain/useAtomicBatchRoute";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useIntl } from "react-intl";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { batchKeys } from "../../config/query-keys/garden";
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
  confirmWalletCancellation: (confirmedInWallet: boolean) => Promise<void>;
  isClearing: boolean;
  /** The approvals a send with an unknown outcome carries. */
  pendingSteps: MarketplaceApprovalStep[];
  pendingReference: string | null;
  /** How many signatures granting what is missing takes, or null until that can be said. */
  signatures: number | null;
}

interface ApprovalSend {
  step: MarketplaceApprovalStep;
  call: ContractCall;
}

const NOT_BATCHABLE = new Set(["batch-budget-exceeded", "batch-atomic-unavailable"]);

export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult {
  const { primaryAddress: steward, passkeyAccountProfile } = useUser();
  const sender = useTransactionSender();
  const { formatMessage } = useIntl();
  const chainId = useAdminStore((state: AdminState) => state.selectedChainId) || DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const scope = marketplaceSubmissionScope(chainId, steward);
  const pending = useMarketplacePendingStore((state) => (scope ? state.pending[scope] : undefined));
  const store = useMarketplacePendingStore.getState;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: marketplaceKeys.approvals(steward ?? "", chainId),
    queryFn: steward
      ? () => {
          logger.debug("[useMarketplaceApprovals] Checking approvals", { steward, chainId });
          return checkMarketplaceApprovals(steward, chainId);
        }
      : skipToken,
    staleTime: STALE_TIME_RARE,
  });

  const isFullyApproved = Boolean(data?.exchangeApproved && data?.minterApproved);
  const route = useAtomicBatchRoute({
    action: "marketplace-approvals",
    sender,
    account: steward,
    passkeyProfile: passkeyAccountProfile,
    chainId,
    budgeted: (rail) => Boolean(marketplaceApprovalBudget(rail, chainId)),
    enabled: Boolean(data) && !isFullyApproved,
  });
  const overCeilingsKey = batchKeys.overCeilings(
    "marketplace-approvals",
    steward ?? "",
    chainId,
    ""
  );
  const { data: overCeilings = false } = useQuery<boolean>({
    queryKey: overCeilingsKey,
    // Written by the send: nothing to fetch.
    queryFn: () => false,
    enabled: false,
  });
  const together = route.atomic && !overCeilings && Boolean(sender?.sendAtomicBatch);
  const missing = data ? Number(!data.exchangeApproved) + Number(!data.minterApproved) : 0;
  const signatures = !data || route.unread ? null : missing === 2 && together ? 1 : missing;

  const checkMutation = useMutation({
    mutationFn: async () => {
      if (!scope || pending?.kind !== "approval") return;
      const outcome = await readMarketplaceSubmissionOutcome(pending, sender, chainId);
      const refreshed = await refetch();
      if (
        outcome.status === "confirmed" ||
        outcome.status === "reverted" ||
        (!refreshed.isError && pending.steps.every((step) => refreshed.data?.[step]))
      )
        store().clear(scope, pending);
    },
  });

  /** Both approvals under one signature: they land together or not at all. */
  const grantTogether = async (
    pendingScope: string,
    account: NonNullable<typeof steward>,
    sends: readonly ApprovalSend[],
    budget: BatchBudget
  ) => {
    const record: Extract<MarketplacePendingSubmission, { kind: "approval" }> = {
      kind: "approval",
      steps: sends.map(({ step }) => step),
    };
    const checkpoint = (reference?: MarketplaceSubmissionReference) =>
      store().checkpoint(pendingScope, { ...record, reference });
    let landed: TxResult;
    try {
      landed = await sender!.sendAtomicBatch!(
        sends.map(({ call }) => call),
        {
          batchBudget: budget,
          assertOwnership: () => sender!.assertOwnership?.(account, chainId),
          onBeforeBroadcast: async (reference) => checkpoint(reference),
          onBroadcastReference: async (reference) => checkpoint(reference),
          // A passkey's operation reaches `onBroadcastReference`; a wallet's call ID only this.
          onBatchReference: async (reference) => {
            if (reference.kind === "wallet-calls") checkpoint(reference);
          },
          onNeverSent: () => store().clear(pendingScope),
        }
      );
    } catch (error) {
      // Sent, and nobody can say yet whether it landed: the record and its reference stay.
      if (error instanceof BatchConfirmationPendingError) return;
      // It was promised one signature, so going one approval at a time takes another press.
      if (error instanceof Error && NOT_BATCHABLE.has(error.message))
        queryClient.setQueryData(overCeilingsKey, true);
      if (
        error instanceof TransactionRevertedError ||
        error instanceof TransactionReplacementError ||
        ((isCancelledTxError(error) || refusedForWalletNetwork(error)) &&
          !store().pending[pendingScope]?.reference)
      )
        store().clear(pendingScope);
      throw error;
    }
    // The receipt says both calls ran; only the approval reads say what they granted. A node can
    // answer from before the receipt's block, so a miss is read again before it stands.
    const granted = await verifyByReading(
      async (step) =>
        (await checkMarketplaceApprovals(account, chainId))[step as MarketplaceApprovalStep]
    )({ account, chainId, itemIds: record.steps, receipts: [] }).catch(() => []);
    if (granted.length === record.steps.length) store().clear(pendingScope);
    // Until the chain shows both, the send stays pending under its receipt, which Check
    // Confirmation reads again.
    else checkpoint({ kind: "transaction", hash: landed.hash });
  };

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
        const sends = (
          [
            ["exchangeApproved", txs.grantExchange],
            ["minterApproved", txs.approveMinter],
          ] as const
        ).flatMap(([step, call]): ApprovalSend[] =>
          call ? [{ step, call: { ...call, account: steward, chainId } }] : []
        );
        const budget = route.rail ? marketplaceApprovalBudget(route.rail, chainId) : null;
        if (sends.length > 1 && together && budget) {
          await grantTogether(scope, steward, sends, budget);
          return;
        }
        // The second approval starts only after the first has confirmed.
        for (const { step, call } of sends) {
          const record: MarketplacePendingSubmission = { kind: "approval", steps: [step] };
          try {
            const result = await sender.sendContractCall(call, {
              assertOwnership: () => sender.assertOwnership?.(steward, chainId),
              onBeforeBroadcast: async (reference) => {
                store().checkpoint(scope, { ...record, reference });
              },
              onBroadcastReference: async (reference) => {
                store().checkpoint(scope, { ...record, reference });
              },
            });
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
              ((isCancelledTxError(error) || refusedForWalletNetwork(error)) &&
                !store().pending[scope]?.reference)
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

  const clearMutation = useMutation({
    mutationFn: async (confirmedInWallet: boolean) => {
      if (!scope || !pending || !steward || !sender) throw new Error("signer-not-ready");
      await clearMarketplacePendingAfterWalletReview(
        scope,
        pending,
        sender,
        steward,
        chainId,
        confirmedInWallet
      );
      grantMutation.reset();
      checkMutation.reset();
    },
  });

  const reference = pending?.reference;
  return {
    confirmWalletCancellation: (confirmedInWallet) => clearMutation.mutateAsync(confirmedInWallet),
    isClearing: clearMutation.isPending,
    pendingSteps: pending?.kind === "approval" ? pending.steps : [],
    pendingReference: reference ? ("hash" in reference ? reference.hash : reference.id) : null,
    approvals: data ?? null,
    isFullyApproved,
    isLoading,
    error: clearMutation.error
      ? new Error(formatMessage({ id: "app.account.pendingRecoveryUnavailable" }))
      : ((checkMutation.error ?? grantMutation.error ?? error) as Error | null),
    grantApprovals: () => {
      grantMutation.mutate();
    },
    isGranting: grantMutation.isPending,
    isPending: Boolean(pending) && !grantMutation.isPending,
    checkPending: () => checkMutation.mutate(),
    isChecking: checkMutation.isPending,
    signatures,
  };
}
