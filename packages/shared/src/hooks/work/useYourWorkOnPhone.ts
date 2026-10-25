/**
 * useYourWorkOnPhone Hook
 *
 * The reader's Your Work still on this phone, in the active garden's scope (DL-061 as DL-129
 * amends it): their own work the queue holds, reviews they made here on their way, work drafts
 * and unsent proof. Home's Continue lists these. They are read the way Your Work › Pending reads
 * them and scoped by the active garden's one rule (`useActiveGarden().inScope`), the one the Your
 * Work badge counts by, so the three show the same items.
 *
 * @module hooks/work/useYourWorkOnPhone
 */

import { useCallback, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import {
  selectYourWorkOnPhone,
  type YourWorkOnPhoneItems,
} from "../../modules/work/your-work-on-phone";
import type { Work } from "../../types/domain";
import { extractClientWorkId } from "../../utils/work/deduplication";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useUser } from "../auth/useUser";
import { type PendingProof, usePendingProof } from "../client-ui/commitment/usePendingProof";
import { useCommitmentQueueState } from "../commitment-pooling/useCommitmentQueueState";
import { useActiveGarden } from "../garden/useActiveGarden";
import { type DraftWithImages, useDrafts } from "./useDrafts";
import { useMyWorks } from "./useMyWorks";
import { useNeedsReview } from "./useNeedsReview";
import { type WorkUploads, useWorkUploads } from "./useWorkUploads";

const NO_GARDENS: string[] = [];

export interface YourWorkOnPhone extends YourWorkOnPhoneItems<DraftWithImages, PendingProof> {
  /** A review's queued upload, for its row: its job, where it stands and when it was saved. */
  decisionFor: WorkUploads["decisionFor"];
  /** Work a promise counts through a link queued on this phone. */
  isLinked: (work: Work) => boolean;
  /** Everything listed: what the Your Work badge counts in the active garden. */
  count: number;
  /** A read that could add to the list has not answered yet. */
  isLoading: boolean;
  /** A read that could add to the list failed, so the list may be missing items. */
  isError: boolean;
  /** The failure is this phone's queue: trying again needs no connection. */
  queueUnreadable: boolean;
  /** Read everything again. */
  refetch: () => void;
}

export function useYourWorkOnPhone(): YourWorkOnPhone {
  const { user } = useUser();
  const { gardenId, inScope } = useActiveGarden();
  // The queue and the proof drafts are kept under the primary address.
  const viewer = usePrimaryAddress();
  const myWorks = useMyWorks({ includeOffline: true });
  const { drafts, isLoading: isLoadingDrafts, refetchDrafts } = useDrafts();
  const proofs = usePendingProof({ chainId: DEFAULT_CHAIN_ID, viewer });
  const queue = useCommitmentQueueState(viewer);
  const uploads = useWorkUploads();
  // A review made here is listed with its work, which the garden's own list holds. The active
  // garden's list is read only while such a review waits; otherwise nothing here could come from it.
  const reviewsWait = uploads.waitingDecisionWorkIds.size > 0;
  const needsReview = useNeedsReview(reviewsWait && gardenId ? [gardenId] : NO_GARDENS, user?.id);

  const items = useMemo(
    () =>
      selectYourWorkOnPhone({
        inScope,
        viewer: user?.id,
        works: myWorks.data ?? [],
        decidedHere: needsReview.decidedHere,
        waitingDecisionWorkIds: uploads.waitingDecisionWorkIds,
        drafts,
        proofs: proofs.items,
      }),
    [
      inScope,
      user?.id,
      myWorks.data,
      needsReview.decidedHere,
      uploads.waitingDecisionWorkIds,
      drafts,
      proofs.items,
    ]
  );

  // Queued work names its client id in its metadata; a queued link names the same id.
  const { linkedWorkIds } = queue;
  const isLinked = useCallback(
    (work: Work) => {
      const clientWorkId = extractClientWorkId(work.metadata);
      return (
        linkedWorkIds.has(work.id) || (clientWorkId !== null && linkedWorkIds.has(clientWorkId))
      );
    },
    [linkedWorkIds]
  );

  const { refresh: refreshQueue } = queue;
  const { refetch: refetchMyWorks } = myWorks;
  const { refetch: refetchNeedsReview } = needsReview;
  const refetch = useCallback(() => {
    refreshQueue();
    void refetchMyWorks();
    void refetchDrafts();
    if (reviewsWait) void refetchNeedsReview();
  }, [refreshQueue, refetchMyWorks, refetchDrafts, refetchNeedsReview, reviewsWait]);

  const queueUnreadable = proofs.isUnavailable;
  return {
    ...items,
    decisionFor: uploads.decisionFor,
    isLinked,
    count:
      items.submissions.length + items.decisions.length + items.drafts.length + items.proofs.length,
    isLoading: isLoadingDrafts || myWorks.isLoading || (reviewsWait && needsReview.isLoading),
    // The record's read of the reader's work is left out: what is on this phone comes from the
    // queue, which that read failing does not touch.
    isError: queueUnreadable || (reviewsWait && needsReview.isError),
    queueUnreadable,
    refetch,
  };
}
