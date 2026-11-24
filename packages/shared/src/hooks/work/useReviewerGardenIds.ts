/**
 * useReviewerGardenIds Hook
 *
 * The gardens whose work the account reviews: those it manages on the garden's record, as a
 * steward or an owner (`canManageGarden`), the check work approval and Home's review duty use. An
 * evaluator alone reviews no work.
 *
 * @module hooks/work/useReviewerGardenIds
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { withoutHiddenGardens } from "../../config/garden-visibility";
import { getGardens } from "../../modules/data/greengoods";
import { DEFAULT_RETRY_COUNT, STALE_TIME_SLOW } from "../../config/query-keys/constants";
import { gardensKeys } from "../../config/query-keys/garden";
import { useGardenPermissions } from "../garden/useGardenPermissions";

interface UseReviewerGardenIdsResult {
  reviewerGardenIds: string[];
  /** The gardens are still being read, so which of them the account reviews is not known yet. */
  isLoading: boolean;
}

export function useReviewerGardenIds(): UseReviewerGardenIdsResult {
  const { canManageGarden } = useGardenPermissions();
  const { data: gardens = [], isLoading } = useQuery({
    queryKey: gardensKeys.byChain(DEFAULT_CHAIN_ID),
    queryFn: () => getGardens(),
    // The list useGardens reads; a restored copy can hold a garden hidden since.
    select: withoutHiddenGardens,
    staleTime: STALE_TIME_SLOW,
    retry: DEFAULT_RETRY_COUNT,
  });

  const reviewerGardenIds = useMemo(
    () => gardens.filter((garden) => canManageGarden(garden)).map((garden) => garden.id),
    [gardens, canManageGarden]
  );

  return { reviewerGardenIds, isLoading };
}
