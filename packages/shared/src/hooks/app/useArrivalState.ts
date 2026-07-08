import { useMemo } from "react";
import { isAddressInList } from "../../utils/blockchain/address";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useGardens } from "../blockchain/useBaseLists";
import { isGardenMember, usePendingJoinsVersion } from "../garden/useJoinGarden";
import { useDrafts } from "../work/useDrafts";
import { usePendingReviewCount } from "../work/usePendingReviewCount";
import { useQueueStatistics } from "../work/useWorks";

/**
 * The single orientation the arrival system surfaces after the user lands on Home.
 * `none` means we are not yet confident enough to assert anything — show nothing.
 *
 * Note: there is intentionally no "in review" kind for the user's OWN work. It is computable
 * (useMyWorks + per-garden approvals), but the toast's one action would point at things the
 * user cannot act on — the Work Dashboard's Pending · My Submissions already carries it.
 * (The older reason — the job queue's `synced` count being transient — still holds for
 * queue-based detection; see modules/job-queue/index.ts.)
 *
 * Tenure (first-time vs returning) is deliberately NOT an axis: no global signal exists
 * (a localStorage marker only proves "first time on this device"), and every cell where
 * tenure would change the message resolves to the same best action. Copy stays tenure-neutral.
 *
 * Reviewer scope: `review`/`operatorClear` sense operator gardens only. Evaluator gardens
 * would need the on-chain isEvaluator multicall, whose failure mode is a silent empty
 * array — indistinguishable from "not an evaluator" — so it cannot honestly gate a claim.
 * `operatorClear` copy must therefore scope its claim to "your gardens".
 */
export type ArrivalKind =
  | "queue"
  | "draft"
  | "review"
  | "operatorClear"
  | "gardener"
  | "signedIn"
  | "none";

/**
 * Per-source readiness + signal. `ready` is the source's confidence (settled / success), kept
 * separate from the signal so the resolver can demand different confidence per priority.
 *
 * `queue` is derived from the local job queue (offline-safe IndexedDB): unsynced or failed work
 * waiting to reach the chain. `review` is network-backed (EAS works + approvals) and its
 * readiness gates ONLY the operator branch — gardeners and roleless users never wait on it.
 */
export interface ArrivalInputs {
  queue: { ready: boolean; hasPendingOrFailed: boolean };
  drafts: { ready: boolean; hasDraft: boolean };
  gardens: { ready: boolean; isOperator: boolean; isGardener: boolean };
  review: { ready: boolean; needsReviewCount: number };
}

/**
 * Resolve the single most useful arrival orientation from per-source readiness + signals.
 *
 * Priorities are processed TOP-DOWN, and an unready source short-circuits to `none` rather than
 * falling through. We cannot truthfully assert a lower-priority orientation while a higher-priority
 * source is still loading or errored — that lower toast might have been preempted once the higher
 * source resolves (e.g. show "draft" then discover failed-sync work). Staying silent until each
 * higher source is ready removes that priority inversion.
 *
 * Ordering is local truth above network truth: the offline-safe IndexedDB sources (queue, drafts)
 * must stay above anything network-backed, or offline users would lose those toasts to the
 * silence discipline. That is also why `review` sits below `draft` — an operator with both an
 * unfinished draft and submissions to review hears about their own device-local work first
 * (this session may be the only chance to recover it; review work is durable on-chain and
 * remains reachable via the Work Dashboard).
 */
export function resolveArrivalKind(inputs: ArrivalInputs): ArrivalKind {
  const { queue, drafts, gardens, review } = inputs;

  if (!queue.ready) return "none";
  if (queue.hasPendingOrFailed) return "queue";

  if (!drafts.ready) return "none";
  if (drafts.hasDraft) return "draft";

  if (!gardens.ready) return "none";
  if (gardens.isOperator) {
    // Review truth gates only operators: an operator claim ("N need review" / "all clear")
    // must be backed by settled works + approvals data, never asserted around an outage.
    if (!review.ready) return "none";
    if (review.needsReviewCount > 0) return "review";
    return "operatorClear";
  }
  if (gardens.isGardener) return "gardener";

  return "signedIn";
}

export interface ArrivalState {
  kind: ArrivalKind;
  /**
   * Garden ids the user belongs to (optimistic-join aware). Lets the client route a single-garden
   * member straight into their garden instead of the filtered list.
   */
  myGardenIds: string[];
  /** Backing value for the review toast's "{count}" copy. 0 unless kind === "review". */
  needsReviewCount: number;
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
  const review = usePendingReviewCount(primaryAddress ?? undefined);

  // One pass over gardens for role flags + routing ids. pendingJoinsVersion subscribes to
  // in-tab pending-join changes so this memo retriggers when a join confirms or expires
  // (matches providers/Work.tsx). Gardener-role detection is gardeners + pending joins only;
  // operator detection is the operators array (no optimistic-join path exists for operators).
  const membership = useMemo(() => {
    const myGardenIds: string[] = [];
    let isOperator = false;
    let isGardener = false;

    if (normalizedAddress) {
      for (const garden of gardensQuery.data ?? []) {
        const operatesGarden = isAddressInList(normalizedAddress, garden.operators);
        const gardensIn = isGardenMember(normalizedAddress, garden.gardeners, [], garden.id);
        if (operatesGarden) isOperator = true;
        if (gardensIn) isGardener = true;
        if (operatesGarden || gardensIn) myGardenIds.push(garden.id);
      }
    }

    return { myGardenIds, isOperator, isGardener };
  }, [normalizedAddress, gardensQuery.data, pendingJoinsVersion]);

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
        isOperator: membership.isOperator,
        isGardener: membership.isGardener,
      },
      review: {
        ready: review.ready,
        needsReviewCount: review.count,
      },
    });
  }, [
    normalizedAddress,
    queueQuery.isSuccess,
    queueQuery.data,
    draftsLoading,
    draftCount,
    gardensQuery.isSuccess,
    membership,
    review.ready,
    review.count,
  ]);

  return {
    kind,
    myGardenIds: membership.myGardenIds,
    needsReviewCount: kind === "review" ? review.count : 0,
  };
}
