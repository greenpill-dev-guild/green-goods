import { useCallback, useMemo } from "react";
import type { Work } from "../../../types/domain";
import {
  REVIEW_WAITING_BANDS,
  type ReviewQueueSummary,
  type ReviewWaitingBand,
  reviewWaitingBandOf,
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

  const bandWorks = useMemo(() => {
    if (!waitingBand) return works;
    const now = Date.now();
    return works.filter(
      (work) =>
        work.status === "pending" && reviewWaitingBandOf(work.createdAt, now) === waitingBand
    );
  }, [waitingBand, works]);

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
    handleWorkScopeChange,
    handleWaitingBandChange,
  };
}
