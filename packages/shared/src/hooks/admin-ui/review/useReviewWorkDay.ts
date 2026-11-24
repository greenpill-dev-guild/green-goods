import { useCallback, useMemo } from "react";
import type { Address } from "../../../types/domain";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { useGardenWorkRange } from "../../work/useGardenWorkRange";
import { useCalendarNow } from "../garden/useCalendarNow";
import {
  dateOfDay,
  monthOfDate,
  monthOfDay,
  type WorkDayKey,
  workDayRange,
} from "../garden/workCalendar";
import type { ReviewWorkScope } from "./review.utils";

/**
 * Review's Work tab narrowed to one calendar day, as Garden › Activity's calendar opens it.
 * The tab's own list holds the garden's newest page, so a day further back is read on its
 * own: every submission of that day, whatever its status, which is what the calendar counted.
 */
export function useReviewWorkDay({
  gardenId,
  day,
  workScope,
  updateSearch,
}: {
  gardenId: Address | undefined;
  /** The day in the URL, or null when the tab shows its usual queue. */
  day: WorkDayKey | null;
  workScope: ReviewWorkScope;
  updateSearch: (updates: Record<string, string | undefined>, replace?: boolean) => void;
}) {
  const range = useMemo(() => (day ? workDayRange(day) : null), [day]);
  const read = useGardenWorkRange(day ? gardenId : undefined, range);
  const now = useCalendarNow();

  // Leaving the day lands on the tab's usual scopes, where "all" does not exist.
  const handleClearWorkDay = useCallback(
    () =>
      updateSearch(
        { day: undefined, scope: workScope === "approved" ? "approved" : undefined },
        false
      ),
    [updateSearch, workScope]
  );

  // On a day, no scope is every status: the list that holds works whose status is unread.
  const handleShowWholeDay = useCallback(() => updateSearch({ scope: undefined }), [updateSearch]);

  const workDayCalendarHref = useMemo(() => {
    if (!day) return null;
    const month = monthOfDay(day);
    return adminRoutes.gardenActivity({
      gardenId,
      month: month === monthOfDate(now) ? undefined : month,
    });
  }, [day, gardenId, now]);

  return {
    workDay: day,
    /** The day at local midnight, for a locale-formatted label. */
    workDayDate: useMemo(() => (day ? dateOfDay(day) : null), [day]),
    /** The day's submissions, every status. Empty while the tab shows its usual queue. */
    workDayWorks: read.works,
    /** The day's works whose status could not be read: status unread, never Pending. */
    workDayUnknownIds: read.unknownIds,
    /**
     * Whether the day's statuses are current: read, and the latest read neither failed nor waits
     * offline over an earlier copy. Until then no work of the day can be decided from the day.
     */
    workDayStatusKnown: day === null || (read.hasRead && !read.isError && !read.isPaused),
    workDayLoading: day !== null && read.isLoading,
    /** The day could not be read, so its list is unknown, not empty. */
    workDayUnread: day !== null && !read.hasRead && (read.isError || read.isPaused),
    /** False when the day holds more work than one read lists. */
    workDayComplete: read.complete,
    /** Reads the day again, for Review's refresh while a day is open. */
    refreshWorkDay: read.refetch,
    workDayFetching: day !== null && read.isFetching,
    /** Garden › Activity on the day's month. */
    workDayCalendarHref,
    handleClearWorkDay,
    /** Shows the day's every status. Undefined while the tab shows its usual queue. */
    handleShowWholeDay: day ? handleShowWholeDay : undefined,
  };
}
