import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import {
  deriveGardenNotifications,
  type GardenNotification,
  gardenNotificationsScope,
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
import { useWorks } from "../work/useWorks";
import { useGardenPermissions } from "./useGardenPermissions";
import { useMyGardens } from "./useMyGardens";

export type { GardenNotification } from "../../modules/garden/notifications";

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
   * The work reads answered only in part: some decisions could not be read, or the week held
   * more than one read lists, so an approval may be missing or a decided submission still listed.
   */
  isIncomplete: boolean;
  /** Record that the member was shown every listed event, on this device. */
  markAllSeen: () => void;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * The bell's events for the signed-in account in one garden (`modules/garden/notifications`),
 * from the garden's works, the promises in its pool and, for whoever may decide them, the
 * take-up requests waiting there. Mount it once the garden is known; Home passes its active
 * garden. It reads the app's default chain, as the work list does. Of its own it writes only
 * this device's seen marks: nothing goes on chain or to the agent, and no read asks to sign.
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
  // Without a pool id these reads would cover every promise on the chain.
  const commitmentsRead = useCommitments({ chainId, poolId }, { enabled: poolId !== undefined });
  const takeUpsRead = usePoolClaimRequests(
    { chainId, poolId: poolId ?? 0n, state: "PENDING" },
    { enabled: canDecideTakeUps && poolId !== undefined }
  );

  const scope = gardenNotificationsScope(chainId, account, gardenId);
  const record = useGardenNotificationsSeenStore((state) =>
    scope ? state.seenByScope[scope] : undefined
  );
  const markSeen = useGardenNotificationsSeenStore((state) => state.markSeen);

  const { works } = workRead;
  const { data: activity } = activityRead;
  const { data: cachedCommitments } = commitmentsRead;
  const { data: cachedTakeUps } = takeUpsRead;
  const { notifications, newCount } = useMemo(() => {
    if (!account) return { notifications: [], newCount: 0 };
    // The page's rows carry this device's own decisions, so they win where both list a work.
    const onPage = new Set(works.map((work) => work.id));
    const thisWeek = activity
      ? resolveGardenWorkRows({ remote: activity.rows, saved: undefined, overlay: undefined }).rows
      : [];
    // A disabled read still answers from the cache, and a read with no pool id shares its key
    // with a chain-wide one, so only the rows of the garden's own pool count.
    const inPool = (candidatePoolId: bigint | null | undefined) =>
      poolId !== undefined && candidatePoolId === poolId;
    const now = nowInSeconds();
    const listed = deriveGardenNotifications({
      account,
      canReviewWork,
      canDecideTakeUps,
      works: [...works, ...thisWeek.filter((work) => !onPage.has(work.id))],
      commitments: (cachedCommitments ?? []).filter((commitment) => inPool(commitment.poolId)),
      takeUpRequests: (cachedTakeUps ?? []).filter((row) => inPool(row.commitment.poolId)),
    }).map((notification) => ({
      ...notification,
      isNew: isNotificationNew(notification, record, now),
    }));
    return { notifications: listed, newCount: listed.filter(({ isNew }) => isNew).length };
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
  ]);

  const markAllSeen = useCallback(() => {
    if (scope) markSeen(scope, notifications, nowInSeconds());
  }, [markSeen, notifications, scope]);

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
      workRead.refreshWarning || workRead.hasUnknownStatuses || activity?.complete === false,
    markAllSeen,
  };
}
