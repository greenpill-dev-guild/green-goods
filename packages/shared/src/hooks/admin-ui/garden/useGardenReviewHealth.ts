import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../../config/react-query";
import { type OverlayWork, resolveGardenWorkRows } from "../../../modules/work/local-status-overlay";
import { readGardenReviewFlow } from "../../../modules/work/work-list";
import type { Address, Work } from "../../../types/domain";
import { toCalendarDateKey } from "../../../utils/calendar-date";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { reportConnectivityFailure, useOnlineStatus } from "../../app/useOnlineStatus";
import { useCanvasSearchParams, useRouteItemClose } from "../../navigation/useCanvasSearchParams";
import { workVisibilityQuery } from "../../work/useWorkVisibility";
import { useCalendarNow } from "./useCalendarNow";

/** Review Health always charts the last eight weeks, whatever the tab's range (2026-11-19). */
export const REVIEW_HEALTH_WEEKS = 8;

export interface ReviewHealthWeek {
  /** The week's Monday at local midnight. */
  start: Date;
  /** Work submitted this week, oldest first. */
  submitted: Work[];
  /** Work whose first decision landed this week. */
  reviewed: Work[];
  /** False when the week's submissions could not all be read: its count is a minimum. */
  submittedComplete: boolean;
  /** False when the week's decisions could not all be read: its count is a minimum. */
  reviewedComplete: boolean;
  /** The week still under way. */
  isCurrent: boolean;
}

export type ReviewHealthReadState = "loading" | "ready" | "error" | "offline";
/** A week's two lists: what was sent that week, and what got its first decision. */
export type ReviewHealthList = "submitted" | "reviewed";

const NO_ROWS: never[] = [];

function mondayOf(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

/** Monday-first weeks on the reader's own device clock, the newest last. */
function weekStarts(now: Date): Date[] {
  const thisMonday = mondayOf(now);
  return Array.from(
    { length: REVIEW_HEALTH_WEEKS + 1 },
    // Calendar arithmetic, not 7 × 24 hours: a daylight-saving week is an hour longer or shorter.
    (_, index) =>
      new Date(
        thisMonday.getFullYear(),
        thisMonday.getMonth(),
        thisMonday.getDate() - 7 * (REVIEW_HEALTH_WEEKS - 1 - index)
      )
  );
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/**
 * Garden › Health's Review Health weeks: how much work each of the last eight weeks brought in,
 * and how much got its first decision. A submission counts in the week it was sent, a reviewed
 * work once, in the week of its first decision, however long before it was sent. A week the
 * reads could not cover in full says so, rather than showing a low number.
 */
export function useGardenReviewHealth(gardenId: Address | undefined, active: boolean) {
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const now = useCalendarNow();
  const starts = weekStarts(now);
  const from = seconds(starts[0]);
  const to = seconds(starts[REVIEW_HEALTH_WEEKS]);
  const enabled = active && Boolean(gardenId);

  const read = useQuery({
    queryKey: worksKeys.reviewFlow(gardenId ?? "", chainId, from, to),
    queryFn: async () => {
      // Disabled without a garden, so it is never missing when this runs.
      if (!gardenId) throw new Error("No garden to read");
      try {
        return await readGardenReviewFlow({
          garden: gardenId,
          chainId,
          from,
          to,
          visibility: await queryClient.fetchQuery(workVisibilityQuery(chainId)),
        });
      } catch (error) {
        void reportConnectivityFailure();
        throw error;
      }
    },
    enabled,
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  // Decisions made on this device, which the indexer may not report yet.
  const overlay = useQuery<OverlayWork[]>({
    queryKey: worksKeys.merged(gardenId ?? "", chainId),
    queryFn: () =>
      queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId ?? "", chainId)) ?? [],
    enabled: false,
  });

  const weeks = useMemo<ReviewHealthWeek[]>(() => {
    const weekStartsNow = weekStarts(now);
    const flow = read.data;
    const resolve = (rows: Parameters<typeof resolveGardenWorkRows>[0]["remote"]) =>
      resolveGardenWorkRows({ remote: rows, saved: undefined, overlay: overlay.data })
        .rows as Work[];
    const submitted = resolve(flow?.submitted ?? NO_ROWS);
    const reviewedWorks = resolve(flow?.reviewed.map((entry) => entry.work) ?? NO_ROWS);
    const firstDecided = new Map(
      (flow?.reviewed ?? []).map((entry) => [entry.work.id, entry.firstDecidedAt])
    );
    // Past the read's limit the latest submissions are missing, from the last one read on.
    const lastSubmitted = flow?.submitted.at(-1)?.createdAt ?? from;

    return weekStartsNow.slice(0, REVIEW_HEALTH_WEEKS).map((start, index) => {
      const weekFrom = seconds(start);
      const weekTo = seconds(weekStartsNow[index + 1]);
      const inWeek = (at: number | undefined) => at !== undefined && at >= weekFrom && at < weekTo;
      return {
        start,
        submitted: submitted.filter((work) => inWeek(work.createdAt)),
        reviewed: reviewedWorks.filter((work) => inWeek(firstDecided.get(work.id))),
        submittedComplete: (flow?.submittedComplete ?? true) || weekTo <= lastSubmitted,
        reviewedComplete:
          (flow?.reviewedComplete ?? true) &&
          (flow?.reviewedReadFrom == null || flow.reviewedReadFrom <= weekFrom),
        isCurrent: index === REVIEW_HEALTH_WEEKS - 1,
      };
    });
  }, [from, now, overlay.data, read.data]);

  const state: ReviewHealthReadState = read.data
    ? "ready"
    : read.isError
      ? "error"
      : !isOnline || read.isPaused
        ? "offline"
        : "loading";

  // The open week lives in the URL, so a reload, a shared link and Back land on it.
  const { searchParams } = useCanvasSearchParams();
  const weekParam = active ? searchParams.get("week") : null;
  const openList: ReviewHealthList = searchParams.get("list") === "reviewed" ? "reviewed" : "submitted";
  const openWeek = weeks.find((week) => toCalendarDateKey(week.start) === weekParam) ?? null;
  const rangeParam = searchParams.get("range") ?? undefined;
  const weekHref = (week: ReviewHealthWeek, list: ReviewHealthList) =>
    adminRoutes.gardenHealth({
      gardenId,
      range: rangeParam,
      week: toCalendarDateKey(week.start),
      list,
    });
  const handleCloseWeek = useRouteItemClose(openWeek !== null, "week");

  return {
    weeks,
    state,
    isFetching: read.isFetching,
    retry: read.refetch,
    openWeek,
    openList,
    weekHref,
    handleCloseWeek,
  };
}

export type GardenReviewHealth = ReturnType<typeof useGardenReviewHealth>;
