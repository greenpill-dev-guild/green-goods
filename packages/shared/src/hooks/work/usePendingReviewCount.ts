/**
 * usePendingReviewCount Hook
 *
 * Truth-gated count of submissions awaiting review in the gardens the given address
 * operates. Backs the arrival orientation's "review" / "operatorClear" states, so its
 * readiness contract is strict: `ready` is true only when the claim (count, including
 * count = 0) is actually backed by settled data.
 *
 * Scope is deliberately operator gardens only (from indexer-backed `garden.operators`).
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
  /** Submissions in operator gardens not reviewed by anyone and not self-authored. */
  count: number;
  /**
   * Whether `count` is a backed claim. For non-operators this is vacuously true (there is
   * nothing to know). Readiness here covers ONLY the review data — callers must gate on
   * gardens readiness separately (the arrival resolver checks gardens.ready first).
   */
  ready: boolean;
  /** Address appears in some garden's operators array. */
  isOperator: boolean;
}

/**
 * Resolve how many submissions await review across the address's operator gardens.
 *
 * Readiness honesty (do not weaken):
 * - `isSuccess` on both queries, never `!isLoading` — a disabled/just-enabled query is
 *   `pending` + not fetching, so `!isLoading` reads "ready" with empty arrays on the
 *   exact render where the operator garden set flips non-empty.
 * - A per-garden works fetch failure (failedGardenIds) is NOT ready — a swallowed outage
 *   must never become a confident "all caught up".
 * - No `initialData`/`placeholderData` on the approvals query — either would fake
 *   `isSuccess` across a key flip.
 * - The count is computed only behind `ready`, never from loading-default arrays.
 */
export function usePendingReviewCount(address: Address | undefined): PendingReviewCountState {
  const gardensQuery = useGardens();

  const operatorGardenIds = useMemo(
    () =>
      address
        ? (gardensQuery.data ?? [])
            .filter((garden) => isAddressInList(address, garden.operators))
            .map((garden) => garden.id)
        : [],
    [address, gardensQuery.data]
  );
  const isOperator = operatorGardenIds.length > 0;

  const {
    data: works,
    failedGardenIds,
    isSuccess: worksSettled,
  } = useReviewerWorks(operatorGardenIds, address);

  const worksTrustworthy = worksSettled && failedGardenIds.length === 0;

  // Recipients = gardens ∪ candidate works' gardeners: covers both shipped approval
  // recipient conventions (PWA attests to the garden, the agent bot to the gardener).
  const approvalRecipients = useMemo(
    () => collectApprovalRecipientsForWorks(operatorGardenIds, works),
    [operatorGardenIds, works]
  );

  const approvalsQuery = useQuery({
    queryKey: queryKeys.approvals.forWorkReview(approvalRecipients),
    queryFn: () => fetchApprovalsByRecipients(approvalRecipients),
    enabled: isOperator && worksTrustworthy && works.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  return useMemo(() => {
    const ready =
      !isOperator || (worksTrustworthy && (works.length === 0 || approvalsQuery.isSuccess));

    if (!isOperator || !ready) {
      return { count: 0, ready, isOperator };
    }

    const approvedUIDs = collectApprovedWorkUIDs(approvalsQuery.data ?? []);
    return {
      count: filterPendingNeedsReview(works, approvedUIDs, address).length,
      ready,
      isOperator,
    };
  }, [isOperator, worksTrustworthy, works, approvalsQuery.isSuccess, approvalsQuery.data, address]);
}
