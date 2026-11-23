import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../../config/react-query";
import {
  isConfirmedLocalDecision,
  isIndexedWork,
  type OverlayWork,
  resolveGardenWorkRows,
} from "../../../modules/work/local-status-overlay";
import { readGardenReviewFlow } from "../../../modules/work/work-list";
import { isWorkVisible } from "../../../modules/work/work-visibility";
import type { Address, Work } from "../../../types/domain";
import { toCalendarDateKey } from "../../../utils/calendar-date";
import { adminRoutes } from "../../../utils/navigation/admin-routes";
import { reportConnectivityFailure, useOnlineStatus } from "../../app/useOnlineStatus";
import { useCanvasSearchParams, useRouteItemClose } from "../../navigation/useCanvasSearchParams";
import { workVisibilityQuery } from "../../work/useWorkVisibility";
import { useCalendarNow } from "./useCalendarNow";

/** Review Health always charts the last eight weeks, whatever the tab's range (2026-11-19). */
const REVIEW_HEALTH_WEEKS = 8;

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
  /** False on a chain that records no review decisions: the week has no reviewed count. */
  reviewedAvailable: boolean;
  /** The week still under way. */
  isCurrent: boolean;
}

export type ReviewHealthReadState = "loading" | "ready" | "error" | "offline";
/** A week's two lists: what was sent that week, and what got its first decision. */
export type ReviewHealthList = "submitted" | "reviewed";

const NO_ROWS: never[] = [];
const NO_TIMES: number[] = [];

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
      // A decision this device saw confirmed rereads the weeks, so it is named here: the read
      // tells one the index already holds from one it does not hold yet.
      const decidedHere = (
        queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId, chainId)) ?? []
      )
        .filter(isConfirmedLocalDecision)
        .map((work) => work.id);
      try {
        return await readGardenReviewFlow({
          garden: gardenId,
          chainId,
          from,
          to,
          visibility: await queryClient.fetchQuery(workVisibilityQuery(chainId)),
          decidedHere,
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
  // The garden's works as this device last resolved them, decisions and sends it saw confirmed
  // included, which the indexer may not report yet.
  const overlay = useQuery<OverlayWork[]>({
    queryKey: worksKeys.merged(gardenId ?? "", chainId),
    queryFn: () =>
      queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId ?? "", chainId)) ?? [],
    enabled: false,
  });
  const visibility = useQuery({ ...workVisibilityQuery(chainId), enabled });

  const weeks = useMemo<ReviewHealthWeek[]>(() => {
    const weekStartsNow = weekStarts(now);
    const flow = read.data;
    const resolve = (rows: Parameters<typeof resolveGardenWorkRows>[0]["remote"]) =>
      resolveGardenWorkRows({ remote: rows, saved: undefined, overlay: overlay.data })
        .rows as Work[];
    const listed = new Set((flow?.submitted ?? []).map((row) => row.id.toLowerCase()));
    // Work this device sent and saw confirmed, which the Review queue lists before the index
    // does. A weeks read that already lists it counts it there instead.
    const sentHere = flow
      ? (overlay.data ?? []).filter(
          (work) =>
            isIndexedWork(work) &&
            work.createdAt >= from &&
            work.createdAt < to &&
            !listed.has(work.id.toLowerCase()) &&
            (!visibility.data || isWorkVisible(work.id, visibility.data))
        )
      : NO_ROWS;
    const submitted = [...resolve(flow?.submitted ?? NO_ROWS), ...(sentHere as Work[])];
    const reviewedWorks = resolve(flow?.reviewed.map((entry) => entry.work) ?? NO_ROWS);
    const firstDecided = new Map(
      (flow?.reviewed ?? []).map((entry) => [entry.work.id, entry.firstDecidedAt])
    );
    // Decisions this device saw confirmed that the index does not hold yet landed just now.
    const decidedNow = resolve(flow?.decidedUnindexed ?? NO_ROWS);
    const reviewedAvailable = flow?.reviewedAvailable ?? true;
    // A submission left out as malformed leaves its week short; one with no readable time,
    // every week.
    const droppedAt = flow?.submittedDroppedAt ?? NO_TIMES;
    // Past the read's limit the latest submissions are missing, from the last one read on.
    // Past the decision read's limit, the period's decisions before this moment are missing.
    const decisionsCutAt = flow?.reviewedReadFrom ?? null;
    const lastSubmitted = (flow?.submitted ?? []).reduce(
      (latest, row) => Math.max(latest, row.createdAt),
      from
    );

    return weekStartsNow.slice(0, REVIEW_HEALTH_WEEKS).map((start, index) => {
      const weekFrom = seconds(start);
      const weekTo = seconds(weekStartsNow[index + 1]);
      const inWeek = (at: number | undefined) => at !== undefined && at >= weekFrom && at < weekTo;
      const isCurrent = index === REVIEW_HEALTH_WEEKS - 1;
      return {
        start,
        submitted: submitted.filter((work) => inWeek(work.createdAt)),
        reviewed: reviewedAvailable
          ? [
              ...reviewedWorks.filter((work) => inWeek(firstDecided.get(work.id))),
              ...(isCurrent ? decidedNow : NO_ROWS),
            ]
          : NO_ROWS,
        submittedComplete:
          ((flow?.submittedComplete ?? true) || weekTo <= lastSubmitted) &&
          !droppedAt.some((at) => Number.isNaN(at) || inWeek(at)),
        reviewedComplete:
          (flow?.reviewedComplete ?? true) &&
          (decisionsCutAt === null || decisionsCutAt <= weekFrom),
        reviewedAvailable,
        isCurrent,
      };
    });
  }, [from, to, now, overlay.data, read.data, visibility.data]);

  const offline = !isOnline || read.isPaused;
  const state: ReviewHealthReadState = read.data
    ? "ready"
    : read.isError
      ? "error"
      : offline
        ? "offline"
        : "loading";
  // Weeks read before going offline: shown, but as the last read.
  const stale = Boolean(read.data) && offline;
  // Weeks read before a refresh failed online: shown as the last read, with a way to retry.
  const refreshFailed = Boolean(read.data) && read.isError && !offline;

  // The open week lives in the URL, so a reload, a shared link and Back land on it.
  const { searchParams } = useCanvasSearchParams();
  const weekParam = active ? searchParams.get("week") : null;
  const openList: ReviewHealthList =
    searchParams.get("list") === "reviewed" ? "reviewed" : "submitted";
  // Not before the weeks are read: an unread week would read as a quiet one.
  const openWeek =
    state === "ready"
      ? (weeks.find((week) => toCalendarDateKey(week.start) === weekParam) ?? null)
      : null;
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
    /** Offline: the weeks shown are the last successful read, not a current one. */
    stale,
    /** Online, a reread failed: the weeks shown are the last successful read. */
    refreshFailed,
    /** False on a chain that records no review decisions: there are no reviewed counts. */
    reviewedAvailable: read.data?.reviewedAvailable ?? true,
    isFetching: read.isFetching,
    retry: read.refetch,
    openWeek,
    openList,
    weekHref,
    handleCloseWeek,
  };
}

export type GardenReviewHealth = ReturnType<typeof useGardenReviewHealth>;
