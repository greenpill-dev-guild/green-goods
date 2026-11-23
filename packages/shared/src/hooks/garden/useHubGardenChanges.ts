import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { gardensKeys } from "../../config/query-keys/garden";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getGardenRoleChanges } from "../../modules/data/garden-member-history";
import {
  deriveHubGardenChanges,
  type HubGardenChange,
  type PromiseDecision,
} from "../../modules/garden/hub-changes";
import {
  gardenNotificationsScope,
  isNotificationNew,
  NEW_NOTIFICATION_WINDOW_SECONDS,
  type SeenNotification,
} from "../../modules/garden/notifications";
import { readGardenActivity } from "../../modules/work/work-list";
import { useGardenNotificationsSeenStore } from "../../stores/useGardenNotificationsSeenStore";
import type { Address, Garden } from "../../types/domain";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { getPromiseDecisions } from "../../modules/commitment-pooling/data-activity";
import { useCommitmentPools, useCommitments } from "../commitment-pooling/useCommitmentPooling";
import { useHasRole } from "../roles/useHasRole";
import { workVisibilityQuery } from "../work/useWorkVisibility";
import { useGardenPermissions } from "./useGardenPermissions";
import { useJoinRequestCount } from "./useJoinRequestCount";

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** One change in the Hub's bell, and whether this device has shown it yet. */
export type HubGardenChangeRow = HubGardenChange & { isNew: boolean };

/**
 * The Hub bell's "Since your last visit" for one garden (PRD-1536, decided 22 November 2026):
 * people asking to join and joining, roles given and taken away, and the decisions other
 * stewards made on work and promises, each listed only for whoever can act on it. What is new is
 * kept on this device, in the installed app's seen store under a Hub scope of its own (DL-133),
 * so a first visit shows the last 7 days. Nothing is dismissed by hand: a change is listed until
 * it has been shown here.
 */
export function useHubGardenChanges(garden: Garden | undefined) {
  const chainId = garden?.chainId || DEFAULT_CHAIN_ID;
  const gardenId = garden?.id;
  const queryClient = useQueryClient();
  const account = usePrimaryAddress();
  const permissions = useGardenPermissions();
  // Answering join requests, changing roles and reviewing work all follow Garden management.
  const canManage = garden ? permissions.canManageGarden(garden) : false;
  const stewardRead = useHasRole(
    gardenId as Address | undefined,
    (account ?? undefined) as Address | undefined,
    "steward",
    chainId
  );
  const canDecidePromises = stewardRead.hasRole;

  const joinRequestRead = useJoinRequestCount(gardenId ?? "", {
    enabled: canManage && Boolean(gardenId),
    kind: "garden_membership",
  });
  const roleRead = useQuery({
    queryKey: gardensKeys.roleChanges(gardenId, chainId),
    queryFn: ({ signal }) =>
      getGardenRoleChanges({ garden: gardenId as Address, chainId }, undefined, signal),
    enabled: canManage && Boolean(gardenId),
    staleTime: 30_000,
    retry: false,
  });
  // The installed app's bell reads the same week, so both share one cache entry.
  const activityRead = useQuery({
    queryKey: worksKeys.activity(gardenId ?? "", chainId),
    queryFn: async () =>
      readGardenActivity({
        garden: gardenId ?? "",
        chainId,
        since: nowInSeconds() - NEW_NOTIFICATION_WINDOW_SECONDS,
        visibility: await queryClient.fetchQuery(workVisibilityQuery(chainId)),
      }),
    enabled: canManage && Boolean(gardenId),
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  const poolsRead = useCommitmentPools({ chainId, garden: gardenId as Address });
  const poolId = poolsRead.pools[0]?.poolId;
  const readsPromises = canDecidePromises && poolId !== undefined;
  // The pool's promises, the Promises tab's own read; without the pool's id it would read every
  // promise on the chain, so it waits for it.
  const promisesRead = useCommitments({ chainId, poolId }, { enabled: readsPromises });
  const promiseIds = useMemo(
    () => (promisesRead.data ?? []).map((commitment) => commitment.id).sort(),
    [promisesRead.data]
  );
  // A decision event carries no pool, so the pool's decisions are read by its promises.
  const promiseRead = useQuery({
    queryKey: gardensKeys.promiseDecisions(gardenId, chainId, promiseIds),
    queryFn: () =>
      getPromiseDecisions({
        chainId,
        commitmentEntityIds: promiseIds,
        since: nowInSeconds() - NEW_NOTIFICATION_WINDOW_SECONDS,
      }),
    enabled: readsPromises && promiseIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  const scope = gardenNotificationsScope(chainId, account, gardenId);
  const hubScope = scope ? `hub:${scope}` : null;
  const record = useGardenNotificationsSeenStore((state) =>
    hubScope ? state.seenByScope[hubScope] : undefined
  );
  const joinRequestsRecord = useGardenNotificationsSeenStore((state) =>
    hubScope ? state.joinRequestsByScope[hubScope] : undefined
  );
  const noteJoinRequests = useGardenNotificationsSeenStore((state) => state.noteJoinRequests);
  const writeSeen = useGardenNotificationsSeenStore((state) => state.markSeen);
  const joinRequestsWaiting = joinRequestRead.waiting;
  useEffect(() => {
    if (hubScope && joinRequestsWaiting !== undefined) {
      noteJoinRequests(hubScope, joinRequestsWaiting, nowInSeconds());
    }
  }, [hubScope, joinRequestsWaiting, noteJoinRequests]);

  // Newness is judged against the moment the sheet opened, so a list does not empty itself
  // while it is on screen.
  const [now] = useState(nowInSeconds);
  const { data: roleChanges } = roleRead;
  const { data: activity } = activityRead;
  const { data: promiseDecisionRows } = promiseRead;
  const changes = useMemo<HubGardenChangeRow[]>(() => {
    if (!account) return [];
    const since = now - NEW_NOTIFICATION_WINDOW_SECONDS;
    const promiseDecisions: PromiseDecision[] = (promiseDecisionRows ?? []).filter(
      (decision) => decision.at > since
    );
    return deriveHubGardenChanges({
      account,
      canManageMembers: canManage,
      canReviewWork: canManage,
      canDecidePromises,
      joinRequests: joinRequestsWaiting ? joinRequestsRecord : undefined,
      roleChanges: (roleChanges ?? [])
        .map((change) => ({ ...change, at: Math.floor(change.at / 1000) }))
        .filter((change) => change.at > since),
      activity: activity?.rows ?? [],
      promiseDecisions,
    }).map((change) => ({ ...change, isNew: isNotificationNew(change, record, now) }));
  }, [
    account,
    activity,
    canDecidePromises,
    canManage,
    joinRequestsRecord,
    joinRequestsWaiting,
    now,
    promiseDecisionRows,
    record,
    roleChanges,
  ]);

  const markSeen = useCallback(
    (shown: readonly SeenNotification[]) => {
      if (hubScope && shown.length > 0) writeSeen(hubScope, shown, nowInSeconds());
    },
    [hubScope, writeSeen]
  );

  return {
    /** The window's changes, newest first, each new or already shown on this device. */
    changes,
    /** Who may answer join requests and review work here: the attention counts follow it. */
    canManage,
    /** The garden's waiting join requests, when this browser holds the grant to count them. */
    joinRequestsWaiting: canManage ? joinRequestsWaiting : undefined,
    isLoading: roleRead.isLoading || activityRead.isLoading,
    /** A read failed, so some changes may be missing. */
    isError: roleRead.isError || activityRead.isError || promiseRead.isError,
    /** Count these changes as shown on this device: they leave the list from the next visit. */
    markSeen,
  };
}
