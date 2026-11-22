import { useCallback, useMemo } from "react";
import type { Work } from "../../../types/domain";
import {
  REVIEW_WAITING_BANDS,
  type ReviewQueueSummary,
  type ReviewWaitingBand,
  reviewWaitingBandOf,
  toMs,
} from "../../../utils/garden-detail";
import type { WorkDayKey } from "../garden/workCalendar";
import type { ReviewWorkScope } from "./review.utils";

export interface ReviewWaitingBandChip {
  id: ReviewWaitingBand;
  /** Pending work in the band; a minimum when the bands are not complete. */
  count: number;
}

/**
 * The Work tab's status and waiting-time choice. Pending and Approved scope the list, and a
 * waiting-time band narrows pending work to how long it has waited. The bands count the same
 * pending work as the header's "waiting over a week", from the garden's own queue, so the last
 * two add up to it. A band's list needs every pending submission, so it reads the garden's whole
 * history as oldest first does. Age is information, never an alarm (DL-044).
 */
export function useReviewWaitingBands({
  works,
  workScope,
  workDay,
  waitingBand,
  reviewQueue,
  updateSearch,
}: {
  works: Work[];
  workScope: ReviewWorkScope;
  workDay: WorkDayKey | null;
  /** The band in the URL; null unless the tab shows pending work with no day. */
  waitingBand: ReviewWaitingBand | null;
  reviewQueue: Pick<ReviewQueueSummary, "waitingByBand" | "waitingByBandComplete">;
  updateSearch: (updates: Record<string, string | undefined>, replace?: boolean) => void;
}) {
  const waitingBands = useMemo<ReviewWaitingBandChip[]>(
    () => REVIEW_WAITING_BANDS.map(({ id }) => ({ id, count: reviewQueue.waitingByBand[id] })),
    [reviewQueue.waitingByBand]
  );

  // One clock per render for the list and its reads, as the counts take theirs each render, so a
  // work crossing a band's edge leaves the list when it leaves the count.
  const now = Date.now();
  const bandWorks = waitingBand
    ? works.filter(
        (work) =>
          work.status === "pending" && reviewWaitingBandOf(work.createdAt, now) === waitingBand
      )
    : works;
  // Pages arrive newest first, so once the loaded work reaches past the band's far edge every
  // work of the band is in. The oldest band has no far edge and reads the whole history.
  const farEdge =
    REVIEW_WAITING_BANDS[REVIEW_WAITING_BANDS.findIndex((band) => band.id === waitingBand) + 1];
  const oldestLoaded = works.reduce(
    (oldest, work) => Math.min(oldest, toMs(work.createdAt)),
    Number.POSITIVE_INFINITY
  );
  const needsOlderWork = waitingBand !== null && (!farEdge || now - oldestLoaded < farEdge.fromMs);

  const handleWorkScopeChange = useCallback(
    (nextScope: ReviewWorkScope) => {
      // On a day, a chip narrows the day's list and pressing it again shows every status.
      const dayScope = nextScope === workScope ? undefined : nextScope;
      updateSearch({
        scope: workDay ? dayScope : nextScope === "approved" ? nextScope : undefined,
        // A band narrows pending work only, so Approved leaves it.
        waiting: nextScope === "approved" ? undefined : (waitingBand ?? undefined),
      });
    },
    [updateSearch, waitingBand, workDay, workScope]
  );

  // Choosing a band shows pending work; choosing the chosen one again clears it.
  const handleWaitingBandChange = useCallback(
    (band: ReviewWaitingBand) =>
      updateSearch({ scope: undefined, waiting: band === waitingBand ? undefined : band }),
    [updateSearch, waitingBand]
  );

  return {
    waitingBand,
    waitingBands,
    waitingBandsComplete: reviewQueue.waitingByBandComplete,
    /** The works the Work tab lists: narrowed to the band when one is chosen. */
    bandWorks,
    /** The chosen band may hold work older than the loaded pages, so read on. */
    needsOlderWork,
    handleWorkScopeChange,
    handleWaitingBandChange,
  };
}
