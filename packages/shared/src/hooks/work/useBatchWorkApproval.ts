import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { batchKeys } from "../../config/query-keys/garden";
import { approvalsKeys, workApprovalsKeys, worksKeys } from "../../config/query-keys/work";
import { track } from "../../modules/app/posthog";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import type { OverlayWork } from "../../modules/work/local-status-overlay";
import {
  moveOnFromReviewHold,
  type ProvenReview,
  readReviewHold,
  type ReviewBatchOutcome,
  type ReviewDecision,
  reviewDomain,
  type ReviewHold,
  sendReviewBatch,
} from "../../modules/work/review-batch";
import {
  createReviewChain,
  reviewBudget,
  signaturesForReviews,
} from "../../modules/work/review-chain";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useHeldBatches } from "../garden/useHeldBatches";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useProgressiveInvalidation } from "../utils/useTimeout";

type OverlayPatch = Partial<OverlayWork>;

/**
 * Send a list of reviewed decisions under as few signatures as the rail allows, and settle a send
 * whose outcome is unknown. One `multiAttest` call carries each group, so every wallet can send it.
 * Nothing here sends on its own: the records live in the batch journal, where no background sender
 * can reach them, and recovery does not depend on `available`, so a hold from an earlier send still
 * shows after batching is switched off.
 */
export function useBatchWorkApproval(gardenId: string) {
  const gardenAddress = gardenId as Address;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { formatMessage } = useIntl();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const handleError = createMutationErrorHandler({
    source: "useBatchWorkApproval",
    toastContext: "batch approval",
    formatMessage,
  });

  const batches = sender?.batches;
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const profile = rail === "wallet" ? "contract-call" : passkeyAccountProfile;
  const available = Boolean(
    batches &&
      account &&
      rail &&
      profile &&
      reviewBudget(rail, chainId) &&
      isBatchEnabled({ action: "bulk-reviews", rail, profile, chainId })
  );

  const domain = reviewDomain(gardenAddress);
  const holdKey = batchKeys.hold(domain, account ?? "", chainId);
  const batchInput = () => ({
    batches: batches!,
    chain: createReviewChain(chainId),
    gardenAddress,
    scope: { account: account!, chainId },
  });

  const refreshWorks = () => {
    void queryClient.invalidateQueries({ queryKey: worksKeys.online(gardenAddress, chainId) });
    void queryClient.invalidateQueries({ queryKey: worksKeys.merged(gardenAddress, chainId) });
    void queryClient.invalidateQueries({ queryKey: workApprovalsKeys.all });
    void queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
  };
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    refreshWorks,
    INDEXER_LAG_SCHEDULE_MS
  );

  const patchWorks = (patchFor: (workId: string) => OverlayPatch | undefined) => {
    const patched = (old: OverlayWork[] = []) =>
      old.map((work) => {
        const patch = patchFor(work.id.toLowerCase());
        return patch ? { ...work, ...patch } : work;
      });
    queryClient.setQueryData(worksKeys.merged(gardenAddress, chainId), patched);
    queryClient.setQueryData(worksKeys.online(gardenAddress, chainId), patched);
  };

  /** A proven decision outranks the indexer until the indexer reports it, with no deadline. */
  const markLanded = (landed: readonly { workUID: string; transactionHash?: string }[]) => {
    const byWork = new Map(landed.map((item) => [item.workUID.toLowerCase(), item]));
    patchWorks((workId) => {
      const item = byWork.get(workId);
      return (
        item && { _isPending: false, _pendingUntilMs: undefined, _txHash: item.transactionHash }
      );
    });
  };

  /** Nothing went out, or the person moved on: the indexer's answer is the only one left. */
  const clearOverlay = (workUIDs: readonly string[]) => {
    const ids = new Set(workUIDs.map((workUID) => workUID.toLowerCase()));
    const now = Date.now();
    patchWorks((workId) =>
      ids.has(workId) ? { _isPending: false, _pendingUntilMs: now, _txHash: undefined } : undefined
    );
  };

  const announceSent = (count: number) =>
    toastService.success({
      title: formatMessage({ id: "app.work.batch.sent" }, { count }),
      context: "batch approval",
    });

  const send = useMutation({
    onMutate: async (decisions: readonly ReviewDecision[]) => {
      await queryClient.cancelQueries({ queryKey: holdKey });
      await queryClient.cancelQueries({ queryKey: worksKeys.merged(gardenAddress, chainId) });
      await queryClient.cancelQueries({ queryKey: worksKeys.online(gardenAddress, chainId) });
      track("batch_approval_started", { count: decisions.length, auth_mode: rail });
      const decided = new Map(
        decisions.map(({ draft }) => [draft.workUID.toLowerCase(), draft] as const)
      );
      // No deadline: a decision stays pending until it is proven, moved on from, or known not sent.
      patchWorks((workId) => {
        const draft = decided.get(workId);
        return (
          draft && {
            status: draft.approved ? "approved" : "rejected",
            reviewFeedback: draft.feedback?.trim() || undefined,
            _isPending: true,
            _pendingUntilMs: undefined,
          }
        );
      });
    },
    mutationFn: async (decisions: readonly ReviewDecision[]): Promise<ReviewBatchOutcome> => {
      try {
        return await sendReviewBatch({
          ...batchInput(),
          rail: rail!,
          decisions,
          onLanded: markLanded,
        });
      } catch (failure) {
        return {
          sent: [],
          stale: [],
          refused: [],
          notSent: decisions.map(({ draft }) => draft.workUID),
          notBatchable: [],
          unknown: [],
          failure,
        };
      }
    },
    onSuccess: (outcome) => {
      const { sent, stale, refused, notSent, notBatchable, unknown, failure } = outcome;
      clearOverlay([
        ...stale,
        ...refused.map(({ workUID }) => workUID),
        ...notSent,
        ...notBatchable,
      ]);
      if (failure) handleError(failure, { authMode: rail, gardenAddress });
      if (sent.length > 0) {
        announceSent(sent.length);
        track("batch_approval_success", {
          count: sent.length,
          auth_mode: rail,
          tx_hash: sent[0].transactionHash,
        });
        refreshWorks();
        scheduleFollowUp();
      }
      if (unknown.length > 0 || refused.length > 0 || failure) {
        track("batch_approval_failed", {
          count: unknown.length + refused.length + notSent.length,
          unknown: unknown.length,
          auth_mode: rail,
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  const held = useHeldBatches<ReviewHold, ProvenReview>({
    domain,
    account,
    chainId,
    enabled: Boolean(batches && account) && !send.isPending,
    read: (shown) => readReviewHold(batchInput(), shown),
    moveOn: async (hold) => {
      const settlement = await moveOnFromReviewHold(batchInput(), hold);
      // A hold that ended let go of its decisions, unless a last read proved they landed.
      if (!settlement.hold) {
        const proven = new Set(settlement.saved.map(({ workUID }) => workUID));
        clearOverlay(hold.workUIDs.filter((workUID) => !proven.has(workUID)));
        refreshWorks();
      }
      return settlement;
    },
    onSaved: (saved) => {
      markLanded(saved);
      announceSent(saved.length);
      refreshWorks();
      scheduleFollowUp();
    },
    onError: (error) => handleError(error, { authMode: rail, gardenAddress }),
  });

  return {
    ...held,
    /** Who `hold` and `send` act for. A hold is theirs alone, so a list should not outlive a change. */
    account,
    available,
    isSending: send.isPending,
    signaturesFor: signaturesForReviews,
    send: (decisions: readonly ReviewDecision[]) => send.mutateAsync(decisions),
  };
}
