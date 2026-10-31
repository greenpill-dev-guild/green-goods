import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import {
  deriveGardenNotifications,
  type GardenNotification as GardenNotificationEvent,
  gardenNotificationsScope,
  isNotificationCleared,
  isNotificationNew,
  NEW_NOTIFICATION_WINDOW_SECONDS,
} from "../../modules/garden/notifications";
import { resolveGardenWorkRows } from "../../modules/work/local-status-overlay";
import { readGardenActivity } from "../../modules/work/work-list";
import { useGardenNotificationsSeenStore } from "../../stores/useGardenNotificationsSeenStore";
import type { Address } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCommitmentPools, useCommitments } from "../commitment-pooling/useCommitmentPooling";
import { usePoolClaimRequests } from "../commitment-pooling/usePoolClaimRequests";
import { useHasRole } from "../roles/useHasRole";
import { useDocumentEvent } from "../utils/useEventListener";
import { useTimeout } from "../utils/useTimeout";
import { useWorks } from "../work/useWorks";
import { useGardenPermissions } from "./useGardenPermissions";
import { useMyGardens } from "./useMyGardens";

/**
 * One of the bell's events (`modules/garden/notifications`). A local alias rather than a
 * re-export: Storybook's module mock reads a re-export as a runtime import and fails on a type.
 */
export type GardenNotification = GardenNotificationEvent;

export interface GardenNotifications {
  /** The garden's events for the signed-in account, newest first, each new or seen here. */
  notifications: Array<GardenNotification & { isNew: boolean }>;
  /** What the bell's badge counts: the events this device has not shown yet. */
  newCount: number;
  /** A read has not answered yet, the account's roles included, so the list may still grow. */
  isLoading: boolean;
  /** A read failed, so the list may be missing events. */
  isError: boolean;
  /**
   * The work reads answered only in part: some decisions could not be read, the week held more
   * than one read lists, or a work's decisions disagree, so an approval may be missing or a
   * decided submission still listed.
   */
  isIncomplete: boolean;
  /**
   * Record that the member was shown every listed event, on this device, and recompute what is
   * new as of now: the sheet calls it as it opens.
   */
  markAllSeen: () => void;
  /**
   * Hide every listed event on this device and count it seen: the sheet's Clear All (DL-133).
   * A later event is new and listed as before.
   */
  clearAll: () => void;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** How long after an event leaves the week its newness is recomputed, past clock granularity. */
const WEEK_BOUNDARY_MARGIN_MS = 1_000;

/**
 * The bell's events for the signed-in account in one garden (`modules/garden/notifications`),
 * from the garden's works, the promises the account is party to and, for whoever may decide
 * them, the take-up requests waiting in the garden's pool. Mount it once the garden is known;
 * Home passes its active garden. It reads the app's default chain, as the work list does. Of its
 * own it writes only this device's seen marks: nothing goes on chain or to the agent, and no
 * read asks to sign.
 *
 * Newness is a question of the clock, so it is recomputed while the app stays mounted: when the
 * sheet opens, when the page becomes visible again, and when the next new event leaves the
 * week. A badge never outlives its event's week.
 */
export function useGardenNotifications(gardenId: string): GardenNotifications {
  const chainId = DEFAULT_CHAIN_ID;
  const account = usePrimaryAddress();
  const myGardens = useMyGardens(account, chainId);
  const permissions = useGardenPermissions();
  const mine = myGardens.gardens.find(
    ({ garden }) => garden.id.toLowerCase() === gardenId.toLowerCase()
  );
  // Each steward event follows the read that gates its act on the phone: the work page's review
  // (`canManageGarden`, from the garden's record) and the claim panel's decision, a live chain
  // read of the pool's garden (`stewardsPoolGarden`: the steward or owner hat).
  const canReviewWork = mine ? permissions.canManageGarden(mine.garden) : false;
  const stewardRead = useHasRole(
    gardenId as Address,
    (account ?? undefined) as Address | undefined,
    "steward",
    chainId
  );
  const canDecideTakeUps = stewardRead.hasRole;

  // The garden's page of works, read as the installed app's other work screens read it, so they
  // share one projection and the bell never writes the cockpit's merged rows, which those screens
  // take as overlays.
  const workRead = useWorks(gardenId, { offline: true });
  // The week's works and decisions, however far back each work began: the page holds only the
  // newest works, and an older one decided this week is as new as a fresh submission.
  const activityRead = useQuery({
    queryKey: worksKeys.activity(gardenId, chainId),
    queryFn: () =>
      readGardenActivity({
        garden: gardenId,
        chainId,
        since: nowInSeconds() - NEW_NOTIFICATION_WINDOW_SECONDS,
      }),
    enabled: Boolean(gardenId),
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  const poolsRead = useCommitmentPools({ chainId, garden: gardenId as Address });
  const poolId = poolsRead.pools[0]?.poolId;
  // The promises the account is party to, the Promises launcher's own read, so the key is
  // shared with it and the read never grows with the pool's history. It waits for the pool id,
  // since only the rows of the garden's pool count.
  const commitmentsRead = useCommitments(
    { chainId, account: (account ?? undefined) as Address | undefined },
    { enabled: poolId !== undefined && Boolean(account) }
  );
  // Without a pool id this read would cover every take-up request on the chain.
  const takeUpsRead = usePoolClaimRequests(
    { chainId, poolId: poolId ?? 0n, state: "PENDING" },
    { enabled: canDecideTakeUps && poolId !== undefined }
  );

  const scope = gardenNotificationsScope(chainId, account, gardenId);
  const record = useGardenNotificationsSeenStore((state) =>
    scope ? state.seenByScope[scope] : undefined
  );
  const markSeen = useGardenNotificationsSeenStore((state) => state.markSeen);
  const clearMarks = useGardenNotificationsSeenStore((state) => state.clearAll);

  // The moment newness is judged against. It moves when the sheet opens, when the page comes
  // back and when the next new event leaves the week; a render alone never moves it.
  const [now, setNow] = useState(nowInSeconds);
  const refreshNow = useCallback(() => setNow(nowInSeconds()), []);
  useDocumentEvent("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshNow();
  });

  const { works } = workRead;
  const { data: activity } = activityRead;
  const { data: cachedCommitments } = commitmentsRead;
  const { data: cachedTakeUps } = takeUpsRead;
  const { notifications, newCount, weekIncomplete } = useMemo(() => {
    if (!account) return { notifications: [], newCount: 0, weekIncomplete: false };
    // The page's rows carry this device's own decisions, so they win where both list a work.
    const onPage = new Set(works.map((work) => work.id));
    const week = activity
      ? resolveGardenWorkRows({ remote: activity.rows, saved: undefined, overlay: undefined })
      : null;
    // A work whose decisions disagree in one timestamp bucket has no known status: it is listed
    // neither as a submission nor as a decision, and the week is incomplete for it.
    const thisWeek = week
      ? week.rows.filter((work) => !onPage.has(work.id) && !week.unknownIds.has(work.id))
      : [];
    // A disabled read still answers from the cache, and the account's read spans every pool,
    // so only the rows of the garden's own pool count.
    const inPool = (candidatePoolId: bigint | null | undefined) =>
      poolId !== undefined && candidatePoolId === poolId;
    // An event cleared on this device stays out of the list (DL-133).
    const listed = deriveGardenNotifications({
      account,
      canReviewWork,
      canDecideTakeUps,
      works: [...works, ...thisWeek],
      commitments: (cachedCommitments ?? []).filter((commitment) => inPool(commitment.poolId)),
      takeUpRequests: (cachedTakeUps ?? []).filter((row) => inPool(row.commitment.poolId)),
    })
      .filter((notification) => !isNotificationCleared(notification, record))
      .map((notification) => ({
        ...notification,
        isNew: isNotificationNew(notification, record, now),
      }));
    return {
      notifications: listed,
      newCount: listed.filter(({ isNew }) => isNew).length,
      weekIncomplete: week !== null && week.unknownIds.size > 0,
    };
  }, [
    account,
    canReviewWork,
    canDecideTakeUps,
    works,
    activity,
    poolId,
    cachedCommitments,
    cachedTakeUps,
    record,
    now,
  ]);

  // The next new event to leave the week takes its newness with it, so a badge goes by itself.
  const { set: scheduleRefresh } = useTimeout();
  useEffect(() => {
    const leaving = notifications
      .filter(({ isNew }) => isNew)
      .map(({ at }) => at + NEW_NOTIFICATION_WINDOW_SECONDS);
    if (leaving.length === 0) return;
    const delayMs = Math.min(...leaving) * 1000 - Date.now() + WEEK_BOUNDARY_MARGIN_MS;
    return scheduleRefresh(refreshNow, Math.max(0, delayMs));
  }, [notifications, refreshNow, scheduleRefresh]);

  const markAllSeen = useCallback(() => {
    const at = nowInSeconds();
    setNow(at);
    if (scope) markSeen(scope, notifications, at);
  }, [markSeen, notifications, scope]);
  const clearAll = useCallback(() => {
    const at = nowInSeconds();
    setNow(at);
    if (scope) clearMarks(scope, notifications, at);
  }, [clearMarks, notifications, scope]);

  return {
    notifications,
    newCount,
    isLoading:
      (!myGardens.isLoaded && !myGardens.isError) ||
      stewardRead.isLoading ||
      workRead.isLoading ||
      activityRead.isLoading ||
      poolsRead.isLoading ||
      commitmentsRead.isLoading ||
      takeUpsRead.isLoading,
    isError:
      myGardens.isError ||
      Boolean(stewardRead.error) ||
      workRead.isError ||
      activityRead.isError ||
      poolsRead.isError ||
      commitmentsRead.isError ||
      takeUpsRead.isError,
    isIncomplete:
      workRead.refreshWarning ||
      workRead.hasUnknownStatuses ||
      activity?.complete === false ||
      weekIncomplete,
    markAllSeen,
    clearAll,
  };
}
