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

import { useMemo } from "react";

import type { Address } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";
import { useGardens } from "../blockchain/useBaseLists";
import { useNeedsReview } from "./useNeedsReview";

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
 * It counts the same works the Work Dashboard lists under Needs review, including a
 * review this device just made, so the arrival nudge never asks for a review the
 * dashboard already shows as done.
 *
 * Readiness honesty (do not weaken): `ready` needs every garden read to have
 * succeeded and every work's status to be known. A failed read, or a work whose
 * approvals could not be read, is NOT ready — a swallowed outage must never become a
 * confident "all caught up". The count is computed only behind `ready`.
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
  const needsReview = useNeedsReview(stewardGardenIds, address);

  return useMemo(() => {
    const ready = !isSteward || needsReview.ready;
    if (!isSteward || !ready) return { count: 0, ready, isSteward };
    return { count: needsReview.works.length, ready, isSteward };
  }, [isSteward, needsReview.ready, needsReview.works]);
}
