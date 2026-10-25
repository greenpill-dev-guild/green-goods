import { useCallback, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isPoolSteward } from "../../modules/commitment-pooling/steward-selectors";
import {
  deriveGardenNotifications,
  type GardenNotification,
  gardenNotificationsScope,
  isNotificationNew,
} from "../../modules/garden/notifications";
import { useGardenNotificationsSeenStore } from "../../stores/useGardenNotificationsSeenStore";
import type { Address } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCommitmentPools, useCommitments } from "../commitment-pooling/useCommitmentPooling";
import { usePoolClaimRequests } from "../commitment-pooling/usePoolClaimRequests";
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
  /** Record that the member was shown every listed event, on this device. */
  markAllSeen: () => void;
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/**
 * The bell's events for the signed-in account in one garden (`modules/garden/notifications`),
 * from the garden's work list, the promises in its pool and, for whoever may decide them, the
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
  // Each steward event follows the predicate that gates its act on the phone: the work page's
  // review (`canManageGarden`) and the claim panel's decision (`isPoolSteward`).
  const canReviewWork = mine ? permissions.canManageGarden(mine.garden) : false;
  const canDecideTakeUps = mine ? isPoolSteward(mine.membership.roles) : false;

  // Read as the installed app's other work screens read it, so they share one projection and
  // the bell never writes the cockpit's merged rows, which those screens take as overlays.
  const workRead = useWorks(gardenId, { offline: true });
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
  const { data: cachedCommitments } = commitmentsRead;
  const { data: cachedTakeUps } = takeUpsRead;
  const { notifications, newCount } = useMemo(() => {
    if (!account) return { notifications: [], newCount: 0 };
    // A disabled read still answers from the cache, and a read with no pool id shares its key
    // with a chain-wide one, so only the rows of the garden's own pool count.
    const inPool = (candidatePoolId: bigint | null | undefined) =>
      poolId !== undefined && candidatePoolId === poolId;
    const now = nowInSeconds();
    const listed = deriveGardenNotifications({
      account,
      canReviewWork,
      canDecideTakeUps,
      works,
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
      workRead.isLoading ||
      poolsRead.isLoading ||
      commitmentsRead.isLoading ||
      takeUpsRead.isLoading,
    isError:
      myGardens.isError ||
      workRead.isError ||
      poolsRead.isError ||
      commitmentsRead.isError ||
      takeUpsRead.isError,
    markAllSeen,
  };
}
