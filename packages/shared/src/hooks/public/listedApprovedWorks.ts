/**
 * The approved work of the gardens the website lists, read once per page.
 *
 * The garden archive, the headline counters and the impact ledger each need
 * the same read: every Work in the listed gardens, then the decisions for
 * those works. Each is its own query, so without a shared entry `/impact`
 * would send that read three times. Going through the query cache sends it
 * once for all of them, and again only once it is stale.
 *
 * @module hooks/public/listedApprovedWorks
 */

import type { QueryClient } from "@tanstack/react-query";

import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { publicKeys } from "../../config/query-keys/public";
import { logger } from "../../modules/app/logger";
import { getWorks } from "../../modules/data/eas";
import { type ApprovedWorks, readApprovedWorks } from "../../modules/work/work-list";

/**
 * Approved work of `gardenIds`. A works read that fails leaves the result
 * empty and `partial`, the same as a decision that could not be read, so a
 * caller never has to tell the two apart.
 */
export function fetchListedApprovedWorks(
  queryClient: QueryClient,
  gardenIds: string[],
  chainId: number
): Promise<ApprovedWorks> {
  return queryClient.fetchQuery({
    queryKey: publicKeys.approvedWorks(chainId, gardenIds),
    queryFn: async (): Promise<ApprovedWorks> => {
      if (gardenIds.length === 0) return { works: [], partial: false };
      try {
        return await readApprovedWorks(await getWorks(gardenIds, chainId), chainId);
      } catch (error) {
        logger.warn("[fetchListedApprovedWorks] EAS works fetch failed", { error });
        return { works: [], partial: true };
      }
    },
    staleTime: STALE_TIME_RARE,
  });
}
