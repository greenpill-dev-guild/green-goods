import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import type { OverlayWork } from "../../modules/work/local-status-overlay";
import {
  REVIEW_BATCH_STORAGE_KEY,
  reviewBatchScope,
  type StagedReview,
  type StagedReviewNote,
  useReviewBatchStore,
} from "../../stores/useReviewBatchStore";
import type { Address, Work, WorkApprovalDraft } from "../../types/domain";
import { parseAndFormatError } from "../../utils/errors/contract-errors";
import { useUser } from "../auth/useUser";
import { useWindowEvent } from "../utils/useEventListener";
import { useBatchWorkApproval } from "./useBatchWorkApproval";

const NO_REVIEWS: Record<string, StagedReview> = {};

/**
 * The reviews a steward has decided and not yet sent in one garden. A decision lives in one place
 * at a time: on this device until it goes out, then in the batch journal until it settles, so
 * whatever a hold names leaves this list. Staging signs nothing, and every send rechecks the chain.
 *
 * `works` is the garden's list where a screen has it: a work someone has since decided leaves too.
 */
export function useReviewBatch(gardenId: string, options: { works?: readonly Work[] } = {}) {
  const { works } = options;
  const gardenAddress = gardenId as Address;
  const { formatMessage } = useIntl();
  const { primaryAddress: account } = useUser();
  const scope = account ? reviewBatchScope(DEFAULT_CHAIN_ID, account, gardenAddress) : "";
  const stored = useReviewBatchStore((state) => state.reviewsByScope[scope]) ?? NO_REVIEWS;
  const stageIn = useReviewBatchStore((state) => state.stage);
  const unstageIn = useReviewBatchStore((state) => state.unstage);
  const noteIn = useReviewBatchStore((state) => state.note);

  const batch = useBatchWorkApproval(gardenId, {
    onLanded: (workUIDs) => unstageIn(scope, workUIDs),
  });
  const { available, hold, isSending } = batch;
  const [sendSize, setSendSize] = useState(0);

  // Another tab's list, so this tab's next write doesn't overwrite it.
  useWindowEvent("storage", (event) => {
    if (event.key === REVIEW_BATCH_STORAGE_KEY) void useReviewBatchStore.persist.rehydrate();
  });

  const heldIds = useMemo(
    () => new Set(hold?.workUIDs.map((workUID) => workUID.toLowerCase())),
    [hold]
  );
  useEffect(() => {
    if (hold) unstageIn(scope, hold.workUIDs);
  }, [hold, scope, unstageIn]);

  const announceDecided = useCallback(
    (count: number) =>
      toastService.info({
        title: formatMessage({ id: "app.work.batch.alreadyDecided" }, { count }),
        context: "batch approval",
      }),
    [formatMessage]
  );

  useEffect(() => {
    if (!works || isSending) return;
    const decided = works
      .filter((work) => {
        const { status, _isPending } = work as OverlayWork;
        const isDecided = status === "approved" || status === "rejected";
        return isDecided && !_isPending && stored[work.id.toLowerCase()];
      })
      .map(({ id }) => id);
    if (decided.length === 0) return;
    unstageIn(scope, decided);
    announceDecided(decided.length);
  }, [works, stored, isSending, scope, unstageIn, announceDecided]);

  const reviews = useMemo(
    () =>
      Object.entries(stored)
        .filter(([key]) => !heldIds.has(key))
        .map(([, review]) => review),
    [stored, heldIds]
  );
  const approvals = reviews.filter(({ draft }) => draft.approved).length;
  const blocked = reviews.filter(({ refusal, notBatchable }) => refusal || notBatchable);

  const describeRefusal = (reason: string) => {
    const { message, parsed } = parseAndFormatError(reason);
    return parsed.messageKey
      ? formatMessage({ id: parsed.messageKey, defaultMessage: parsed.message })
      : message;
  };

  const send = async () => {
    if (!available || reviews.length === 0 || isSending) return;
    setSendSize(batch.signaturesFor(reviews.length));
    const { stale, unknown, refused, notBatchable } = await batch.send(
      reviews.map(({ draft }) => ({ draft, gardenAddress }))
    );
    unstageIn(scope, [...stale, ...unknown]);
    if (stale.length > 0) announceDecided(stale.length);
    const notes = new Map<string, StagedReviewNote>(
      refused.map(({ workUID, reason }) => [workUID, { refusal: describeRefusal(reason) }])
    );
    for (const workUID of notBatchable) notes.set(workUID, { notBatchable: true });
    noteIn(scope, notes);
  };

  const decidedOnChain = hold?.onChain.filter(({ decided }) => decided).length ?? 0;
  return {
    /**
     * Whether this account can add to the list and send it here. What's already on the list stays in
     * view without it, with a wallet reconnecting or a rail taken off, so no form can decide a waiting
     * work a second way. Recovery doesn't depend on it either.
     */
    available,
    /** The reviews a send takes, in the order they were decided. */
    reviews,
    approvals,
    rejections: reviews.length - approvals,
    signatures: batch.signaturesFor(reviews.length),
    /** Which signature a send in flight is on, of `sendSize`. Each group's landing moves it on. */
    signatureStep: sendSize - batch.signaturesFor(reviews.length) + 1,
    sendSize,
    /** Reviews the last send could not take. The list won't go until they change or come out. */
    blockedCount: blocked.length,
    isSending,
    isSettlingHold: batch.isSettlingHold,
    reviewFor: (workId: string): StagedReview | undefined =>
      heldIds.has(workId.toLowerCase()) ? undefined : stored[workId.toLowerCase()],
    /** Its last send is unknown, so nothing may go for this work until that settles. */
    isHeld: (workId: string) => heldIds.has(workId.toLowerCase()),
    stage: (draft: WorkApprovalDraft) => stageIn(scope, draft),
    unstage: (workId: string) => unstageIn(scope, [workId]),
    unstageBlocked: () =>
      unstageIn(
        scope,
        blocked.map(({ draft }) => draft.workUID)
      ),
    send,
    /** What a screen shows while held. Spread it onto `TxHoldFeedback`. */
    holdFeedback: hold
      ? {
          title: formatMessage({ id: "app.work.batch.hold.title" }),
          message: formatMessage({ id: "app.work.batch.hold.body" }),
          detail: formatMessage(
            { id: "app.work.batch.hold.recorded" },
            { decided: decidedOnChain, total: hold.workUIDs.length }
          ),
          hasUnreadValues: hold.onChain.length < hold.workUIDs.length,
          isSettling: batch.isSettlingHold,
          isBusy: isSending,
          onCheckAgain: () => void batch.checkAgain(),
          onMoveOn: () => void batch.moveOn(),
        }
      : null,
  };
}

export type ReviewBatch = ReturnType<typeof useReviewBatch>;
