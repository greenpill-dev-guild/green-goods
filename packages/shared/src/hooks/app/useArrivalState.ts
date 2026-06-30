import { useMemo } from "react";

import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useGardens } from "../blockchain/useBaseLists";
import { isGardenMember, usePendingJoinsVersion } from "../garden/useJoinGarden";
import { useDrafts } from "../work/useDrafts";
import { useQueueStatistics } from "../work/useWorks";

/**
 * The single orientation the arrival system surfaces after the user lands on Home.
 * `none` means we are not yet confident enough to assert anything — show nothing.
 *
 * Note: there is intentionally no "in review" kind. "Awaiting operator approval" is an on-chain
 * concept that needs per-garden approval data to detect truthfully; the local job queue's `synced`
 * count is not it (a synced job is deleted in the same step it is marked synced — see
 * modules/job-queue/index.ts — so a lingering `synced` count means a failed-delete orphan, not a
 * work in review). Rather than surface a false "in review" message, we omit the state.
 */
export type ArrivalKind = "queue" | "draft" | "member" | "signedIn" | "none";

/**
 * Per-source readiness + signal. `ready` is the source's confidence (settled / success), kept
 * separate from the signal so the resolver can demand different confidence per priority.
 *
 * `queue` is derived from the local job queue (offline-safe IndexedDB): unsynced or failed work
 * waiting to reach the chain.
 */
export interface ArrivalInputs {
  queue: { ready: boolean; hasPendingOrFailed: boolean };
  drafts: { ready: boolean; hasDraft: boolean };
  gardens: { ready: boolean; hasMembership: boolean };
}

/**
 * Resolve the single most useful arrival orientation from per-source readiness + signals.
 *
 * Priorities are processed TOP-DOWN, and an unready source short-circuits to `none` rather than
 * falling through. We cannot truthfully assert a lower-priority orientation while a higher-priority
 * source is still loading or errored — that lower toast might have been preempted once the higher
 * source resolves (e.g. show "draft" then discover failed-sync work). Staying silent until each
 * higher source is ready removes that priority inversion. The offline-safe IndexedDB sources
 * (queue, drafts) resolve fast even offline; gardens is network/cache-backed, so an unconfirmed
 * gardens query correctly yields `none` (we can claim neither "member" nor "no membership").
 */
export function resolveArrivalKind(inputs: ArrivalInputs): ArrivalKind {
  const { queue, drafts, gardens } = inputs;

  if (!queue.ready) return "none";
  if (queue.hasPendingOrFailed) return "queue";

  if (!drafts.ready) return "none";
  if (drafts.hasDraft) return "draft";

  if (!gardens.ready) return "none";
  if (gardens.hasMembership) return "member";

  return "signedIn";
}

export interface ArrivalState {
  kind: ArrivalKind;
  /**
   * Garden ids the user belongs to (optimistic-join aware). Lets the client route a single-garden
   * member straight into their garden instead of the filtered list.
   */
  myGardenIds: string[];
}

/**
 * Sense the logged-in user's current state and resolve a single orientation kind for the
 * post-login arrival toast. The pure decision lives in {@link resolveArrivalKind}; this hook only
 * wires the existing data sources to {@link ArrivalInputs}.
 */
export function useArrivalState(): ArrivalState {
  const primaryAddress = usePrimaryAddress();
  const normalizedAddress = primaryAddress?.toLowerCase() ?? null;

  const gardensQuery = useGardens();
  const { draftCount, isLoading: draftsLoading } = useDrafts();
  const queueQuery = useQueueStatistics();
  const pendingJoinsVersion = usePendingJoinsVersion();

  // pendingJoinsVersion subscribes to in-tab pending-join changes so this memo retriggers when a
  // join confirms or expires (matches providers/Work.tsx).
  const myGardenIds = useMemo(
    () =>
      normalizedAddress
        ? (gardensQuery.data ?? [])
            .filter((garden) =>
              isGardenMember(normalizedAddress, garden.gardeners, garden.operators, garden.id)
            )
            .map((garden) => garden.id)
        : [],
    [normalizedAddress, gardensQuery.data, pendingJoinsVersion]
  );

  const kind = useMemo<ArrivalKind>(() => {
    if (!normalizedAddress) return "none";

    const queueStats = queueQuery.data;
    return resolveArrivalKind({
      queue: {
        ready: queueQuery.isSuccess,
        hasPendingOrFailed: (queueStats?.pending ?? 0) > 0 || (queueStats?.failed ?? 0) > 0,
      },
      drafts: {
        ready: !draftsLoading,
        hasDraft: draftCount > 0,
      },
      gardens: {
        ready: gardensQuery.isSuccess,
        hasMembership: myGardenIds.length > 0,
      },
    });
  }, [
    normalizedAddress,
    queueQuery.isSuccess,
    queueQuery.data,
    draftsLoading,
    draftCount,
    gardensQuery.isSuccess,
    myGardenIds,
  ]);

  return { kind, myGardenIds };
}
