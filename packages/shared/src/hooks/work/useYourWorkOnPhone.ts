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
  type GardenScope,
  selectQueuedDecisions,
  selectYourWorkOnPhone,
  type YourWorkOnPhoneItems,
} from "../../modules/work/your-work-on-phone";
import type { Address, Work } from "../../types/domain";
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

export interface QueuedDecisions {
  /** Works the reader reviewed on this phone whose review still waits to upload, newest first. */
  works: Work[];
  /** A garden those reviews name is still being read. */
  isLoading: boolean;
  /** A garden those reviews name could not be read, so a review may be missing. */
  isError: boolean;
  /** Read those gardens again. Resolves false when a read failed. */
  refetch: () => Promise<boolean>;
}

const NOTHING_TO_READ = async () => true;

/**
 * Reviews the reader made on this phone whose upload still waits, with the works they decide:
 * the decisions Your Work › Pending and Home's Continue list, whose jobs the Your Work badge
 * counts. Each garden a waiting review writes to is read the way its Work tab reads it, as long
 * as the active garden's scope shows that garden, whether or not the reader still reviews there:
 * a review queued for a garden the reader has left stays listed, as the badge counts it.
 */
export function useQueuedDecisions({
  uploads,
  inScope,
  reviewer,
}: {
  uploads: Pick<WorkUploads, "waitingDecisionWorkIds" | "waitingDecisionGardenIds">;
  inScope: GardenScope;
  reviewer: Address | undefined;
}): QueuedDecisions {
  const { waitingDecisionWorkIds, waitingDecisionGardenIds } = uploads;
  const gardens = useMemo(
    () => waitingDecisionGardenIds.filter((garden) => inScope([garden])),
    [waitingDecisionGardenIds, inScope]
  );
  const read = useNeedsReview(gardens, reviewer);
  const works = useMemo(
    () => selectQueuedDecisions({ inScope, decidedHere: read.decidedHere, waitingDecisionWorkIds }),
    [inScope, read.decidedHere, waitingDecisionWorkIds]
  );
  return {
    works,
    isLoading: read.isLoading,
    isError: read.isError,
    refetch: gardens.length > 0 ? read.refetch : NOTHING_TO_READ,
  };
}

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
  /** The failure is this phone's own queue or drafts: trying again needs no connection. */
  queueUnreadable: boolean;
  /** Read everything again. */
  refetch: () => void;
}

export function useYourWorkOnPhone(): YourWorkOnPhone {
  const { user } = useUser();
  const { inScope } = useActiveGarden();
  // The queue and the proof drafts are kept under the primary address.
  const viewer = usePrimaryAddress();
  const myWorks = useMyWorks({ includeOffline: true });
  const {
    drafts,
    isLoading: isLoadingDrafts,
    isError: draftsUnreadable,
    refetchDrafts,
  } = useDrafts();
  const proofs = usePendingProof({ chainId: DEFAULT_CHAIN_ID, viewer });
  const queue = useCommitmentQueueState(viewer);
  const uploads = useWorkUploads();
  const decisions = useQueuedDecisions({ uploads, inScope, reviewer: user?.id });

  const items = useMemo(
    () =>
      selectYourWorkOnPhone({
        inScope,
        viewer: user?.id,
        works: myWorks.data ?? [],
        drafts,
        proofs: proofs.items,
      }),
    [inScope, user?.id, myWorks.data, drafts, proofs.items]
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
  const { refetch: refetchUploads } = uploads;
  const { refetch: refetchMyWorks } = myWorks;
  const { refetch: refetchDecisions } = decisions;
  const refetch = useCallback(() => {
    refreshQueue();
    refetchUploads();
    void refetchMyWorks();
    void refetchDrafts();
    void refetchDecisions();
  }, [refreshQueue, refetchUploads, refetchMyWorks, refetchDrafts, refetchDecisions]);

  // Every read of this phone's queue: proof and promise acts, work and reviews to upload, queued
  // work. Until each answers, or when one fails, the list may be missing what only it holds.
  const queueUnreadable =
    proofs.isUnavailable || draftsUnreadable || uploads.isError || Boolean(myWorks.isErrorQueued);
  return {
    ...items,
    decisions: decisions.works,
    decisionFor: uploads.decisionFor,
    isLinked,
    count:
      items.submissions.length + decisions.works.length + items.drafts.length + items.proofs.length,
    // What is on this phone comes from the queue, so the record's read never holds the list.
    isLoading:
      isLoadingDrafts ||
      myWorks.isLoadingQueued ||
      uploads.isLoading ||
      queue.isLoading ||
      decisions.isLoading,
    // The record's read of the reader's work is left out: what is on this phone comes from the
    // queue, which that read failing does not touch.
    isError: queueUnreadable || decisions.isError,
    queueUnreadable,
    refetch,
  };
}
