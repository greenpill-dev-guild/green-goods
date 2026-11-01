import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
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
  type ReviewBatchOutcome,
  type ReviewDecision,
  reviewDomain,
  sendReviewBatch,
} from "../../modules/work/review-batch";
import {
  createReviewChain,
  reviewBudget,
  signaturesForReviews,
} from "../../modules/work/review-chain";
import {
  moveOnFromReviewHold,
  type ProvenReview,
  readReviewHold,
  type ReviewHold,
  type ReviewSettlement,
} from "../../modules/work/review-hold";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useHeldBatches } from "../garden/useHeldBatches";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useSafeMutation } from "../utils/useSafeMutation";
import { useProgressiveInvalidation } from "../utils/useTimeout";

type OverlayPatch = Partial<OverlayWork>;

/**
 * Send a list of reviewed decisions under as few signatures as the rail allows, and settle a send
 * whose outcome is unknown. One `multiAttest` call carries each group, so every wallet can send it.
 * Nothing here sends on its own: the records live in the batch journal, where no background sender
 * can reach them, and recovery does not depend on `available`, so a hold from an earlier send still
 * shows after batching is switched off.
 */
export function useBatchWorkApproval(
  gardenId: string,
  /** `onLanded` hears every decision proven on chain, from a send or from a later read. */
  options: { onLanded?: (workUIDs: readonly string[]) => void } = {}
) {
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
    options.onLanded?.(landed.map(({ workUID }) => workUID));
  };

  /**
   * Nothing went out, or the person moved on: the work waits again until the indexer says otherwise.
   * The cached row has to say so too, or it reads as decided until the next refetch.
   */
  const clearOverlay = (workUIDs: readonly string[]) => {
    const ids = new Set(workUIDs.map((workUID) => workUID.toLowerCase()));
    const now = Date.now();
    patchWorks((workId) =>
      ids.has(workId)
        ? {
            status: "pending",
            reviewFeedback: undefined,
            _isPending: false,
            _pendingUntilMs: now,
            _txHash: undefined,
          }
        : undefined
    );
  };

  const announceSent = (count: number) =>
    toastService.success({
      title: formatMessage({ id: "app.work.batch.sent" }, { count }),
      context: "batch approval",
    });

  const sendKey = batchKeys.reviewSend(account ?? "", chainId);
  const sendMutation = useMutation({
    mutationKey: sendKey,
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
      refreshWorks();
      if (failure) handleError(failure, { authMode: rail, gardenAddress });
      if (sent.length > 0) {
        announceSent(sent.length);
        track("batch_approval_success", {
          count: sent.length,
          auth_mode: rail,
          tx_hash: sent[0].transactionHash,
        });
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
  // The lock a single review shares. It hands a second caller the first call's promise, so anything
  // that isn't that same send has to check `isSending` before it starts.
  const send = useSafeMutation(sendMutation, "approval");
  const sending = useIsMutating({ mutationKey: sendKey }) > 0 || send.isPending;

  /** A send that ended without proof lets go of its decisions, whichever tab ended it. */
  const letGoOfUnproven = (settlement: ReviewSettlement) => {
    if (settlement.notLanded.length > 0) {
      clearOverlay(settlement.notLanded);
      refreshWorks();
    }
    return settlement;
  };

  const held = useHeldBatches<ReviewHold, ProvenReview>({
    domain,
    account,
    chainId,
    enabled: Boolean(batches && account) && !sending,
    read: async (shown) => letGoOfUnproven(await readReviewHold(batchInput(), shown)),
    moveOn: async (hold) => letGoOfUnproven(await moveOnFromReviewHold(batchInput(), hold)),
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
    isSending: sending,
    signaturesFor: signaturesForReviews,
    send: (decisions: readonly ReviewDecision[]) => send.mutateAsync(decisions),
  };
}
