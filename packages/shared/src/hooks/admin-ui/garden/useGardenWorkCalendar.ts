import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Address, Work } from "../../../types/domain";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import {
  pushRouteItem,
  useCanvasSearchParams,
  useRouteItemClose,
} from "../../navigation/useCanvasSearchParams";
import { useGardenWorkRange } from "../../work/useGardenWorkRange";
import { useCalendarNow } from "./useCalendarNow";
import {
  addMonths,
  buildWorkCalendar,
  dateOfMonth,
  monthOfDate,
  monthOfDay,
  parseWorkDay,
  parseWorkMonth,
  type WorkCalendarDay,
  type WorkCalendarStatus,
  type WorkDayKey,
  workCalendarStatus,
  workMonthRange,
} from "./workCalendar";

/**
 * What the month's read can say: still reading, read, could not be read, or waiting for a
 * connection. "ready" with `complete` false is a month too busy to read in full.
 */
export type WorkCalendarReadState = "loading" | "ready" | "error" | "offline";

/**
 * Garden › Activity's month calendar: every submission of the month in the URL, by the day it
 * was sent, with the day whose list is open. The month and the open day live in the URL so a
 * reload, a shared link and Back from Review all land on the same calendar.
 */
export function useGardenWorkCalendar({
  gardenId,
  active,
}: {
  gardenId: Address | undefined;
  /** False off the Activity tab, where nothing is read. */
  active: boolean;
}) {
  const navigate = useNavigate();
  const { searchParams, updateSearch } = useCanvasSearchParams();
  // One "today" per local day: steady while a month is read, moving on once the day turns.
  const now = useCalendarNow();
  const requestedDay = active ? parseWorkDay(searchParams.get("day"), now) : null;
  const monthValue = searchParams.get("month");
  // A day link without a month opens that day's month, so it holds across midnight too.
  const month =
    monthValue === null && requestedDay
      ? monthOfDay(requestedDay)
      : parseWorkMonth(monthValue, now);
  const currentMonth = monthOfDate(now);
  const openDayKey = requestedDay && monthOfDay(requestedDay) === month ? requestedDay : null;
  const range = useMemo(() => workMonthRange(month), [month]);
  const read = useGardenWorkRange(active ? gardenId : undefined, active ? range : null);

  const calendar = useMemo(
    () => buildWorkCalendar(read.works, read.unknownIds, month, now, read.readThrough),
    [read.works, read.unknownIds, month, now, read.readThrough]
  );
  const openDay: WorkCalendarDay | null = useMemo(
    () =>
      openDayKey ? (calendar.weeks.flat().find((cell) => cell.day === openDayKey) ?? null) : null,
    [calendar, openDayKey]
  );

  // A month read before going offline keeps its grid, but says it is the last read, not today's.
  const state: WorkCalendarReadState = read.hasRead
    ? "ready"
    : read.isError
      ? "error"
      : read.isPaused
        ? "offline"
        : "loading";
  const stale = read.hasRead && read.isPaused;
  // Online, a month on screen whose reread failed keeps its grid and says it is the last read.
  const refreshFailed = read.hasRead && read.isError && !read.isPaused;

  const showMonth = useCallback(
    (next: string) =>
      // The current month is the default, so it stays out of the URL.
      updateSearch({ month: next === currentMonth ? undefined : next, day: undefined }),
    [currentMonth, updateSearch]
  );
  const showPreviousMonth = useCallback(() => showMonth(addMonths(month, -1)), [month, showMonth]);
  const showNextMonth = useCallback(() => showMonth(addMonths(month, 1)), [month, showMonth]);
  const showCurrentMonth = useCallback(() => showMonth(currentMonth), [currentMonth, showMonth]);

  const monthParam = month === currentMonth ? undefined : month;
  // The feed's range rides along, so the feed behind the dialog keeps the steward's choice.
  const rangeParam = searchParams.get("range") ?? undefined;
  const handleOpenDay = useCallback(
    (day: WorkDayKey) =>
      pushRouteItem(
        navigate,
        adminRoutes.gardenActivity({ gardenId, month: monthParam, day, range: rangeParam })
      ),
    [gardenId, monthParam, navigate, rangeParam]
  );
  const handleCloseDay = useRouteItemClose(openDayKey !== null, "day");
  const { unknownIds } = read;
  const statusOf = useCallback(
    (work: Work): WorkCalendarStatus => workCalendarStatus(work, unknownIds),
    [unknownIds]
  );

  return {
    month,
    /** The month's first day at local midnight, for a locale-formatted label. */
    monthDate: useMemo(() => dateOfMonth(month), [month]),
    weeks: calendar.weeks,
    counts: calendar.counts,
    daysWithWork: calendar.daysWithWork,
    state,
    /** A month read earlier, shown while offline: its statuses may have moved on since. */
    stale,
    /** A month read earlier whose reread failed while online: the grid is the last read. */
    refreshFailed,
    /** False when the month holds more work than one read lists: its counts are a minimum. */
    complete: read.complete,
    isFetching: read.isFetching,
    isCurrentMonth: month === currentMonth,
    showPreviousMonth,
    showNextMonth,
    showCurrentMonth,
    retry: read.refetch,
    openDay,
    /** A submission's status as the calendar counted it. */
    statusOf,
    handleOpenDay,
    handleCloseDay,
    /** Review's Work tab for the open day: every status, same garden. */
    openDayWorkHref: openDayKey ? adminRoutes.reviewWork({ gardenId, day: openDayKey }) : null,
  };
}

export type GardenWorkCalendar = ReturnType<typeof useGardenWorkCalendar>;
