/**
 * usePendingReviewCount Hook
 *
 * Truth-gated count of submissions awaiting review in the gardens the given address
 * operates. Backs the arrival orientation's "review" / "stewardClear" states, so its
 * readiness contract is strict: `ready` is true only when the claim (count, including
 * count = 0) is actually backed by settled data.
 *
 * Scope is deliberately steward gardens only (from indexer-backed `garden.stewards`).
 * Evaluator gardens would need the on-chain `isEvaluator` multicall, whose failure mode
 * is a silent empty array — indistinguishable from "not an evaluator" — so it cannot
 * honestly gate an arrival claim.
 *
 * @module hooks/work/usePendingReviewCount
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { DEFAULT_RETRY_COUNT, queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import type { Address } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";
import {
  collectApprovalRecipientsForWorks,
  collectApprovedWorkUIDs,
  filterPendingNeedsReview,
} from "../../utils/work/pending-review";
import { useGardens } from "../blockchain/useBaseLists";
import { fetchApprovalsByRecipients } from "./useAggregatedApprovals";
import { useReviewerWorks } from "./useReviewerWorks";

export interface PendingReviewCountState {
  /** Submissions in steward gardens not reviewed by anyone and not self-authored. */
  count: number;
  /**
   * Whether `count` is a backed claim. For non-stewards this is vacuously true (there is
   * nothing to know). Readiness here covers ONLY the review data — callers must gate on
   * gardens readiness separately (the arrival resolver checks gardens.ready first).
   */
  ready: boolean;
  /** Address appears in some garden's stewards array. */
  isSteward: boolean;
}

/**
 * Resolve how many submissions await review across the address's steward gardens.
 *
 * Readiness honesty (do not weaken):
 * - `isSuccess` on both queries, never `!isLoading` — a disabled/just-enabled query is
 *   `pending` + not fetching, so `!isLoading` reads "ready" with empty arrays on the
 *   exact render where the steward garden set flips non-empty.
 * - A per-garden works fetch failure (failedGardenIds) is NOT ready — a swallowed outage
 *   must never become a confident "all caught up".
 * - No `initialData`/`placeholderData` on the approvals query — either would fake
 *   `isSuccess` across a key flip.
 * - The count is computed only behind `ready`, never from loading-default arrays.
 */
export function usePendingReviewCount(address: Address | undefined): PendingReviewCountState {
  const gardensQuery = useGardens();

  const stewardGardenIds = useMemo(
    () =>
      address
        ? (gardensQuery.data ?? [])
            .filter((garden) => isAddressInList(address, garden.stewards))
            .map((garden) => garden.id)
        : [],
    [address, gardensQuery.data]
  );
  const isSteward = stewardGardenIds.length > 0;

  const {
    data: works,
    failedGardenIds,
    isSuccess: worksSettled,
  } = useReviewerWorks(stewardGardenIds, address);

  const worksTrustworthy = worksSettled && failedGardenIds.length === 0;

  // Recipients = gardens ∪ candidate works' gardeners: covers both shipped approval
  // recipient conventions (PWA attests to the garden, the agent bot to the gardener).
  const approvalRecipients = useMemo(
    () => collectApprovalRecipientsForWorks(stewardGardenIds, works),
    [stewardGardenIds, works]
  );

  const approvalsQuery = useQuery({
    queryKey: queryKeys.approvals.forWorkReview(approvalRecipients),
    queryFn: () => fetchApprovalsByRecipients(approvalRecipients),
    enabled: isSteward && worksTrustworthy && works.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  return useMemo(() => {
    const ready =
      !isSteward || (worksTrustworthy && (works.length === 0 || approvalsQuery.isSuccess));

    if (!isSteward || !ready) {
      return { count: 0, ready, isSteward };
    }

    const approvedUIDs = collectApprovedWorkUIDs(approvalsQuery.data ?? []);
    return {
      count: filterPendingNeedsReview(works, approvedUIDs, address).length,
      ready,
      isSteward,
    };
  }, [isSteward, worksTrustworthy, works, approvalsQuery.isSuccess, approvalsQuery.data, address]);
}
