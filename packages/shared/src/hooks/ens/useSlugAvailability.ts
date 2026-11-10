/**
 * Slug Availability Hook
 *
 * Debounced RPC check for ENS slug availability across the L2 cache and L1 receiver.
 * A slug that fails the format check (`slugSchema`) is never sent.
 *
 * @module hooks/ens/useSlugAvailability
 */

import { skipToken, useQuery } from "@tanstack/react-query";
import { zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { STALE_TIME_FAST } from "../../config/query-keys/constants";
import { ensKeys } from "../../config/query-keys/identity";
import { logger } from "../../modules/app/logger";
import { createClients, getNetworkContracts } from "../../utils/blockchain/contracts";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import { isSlugAvailableAcrossChains } from "./availability";
import { slugSchema } from "../../modules/ens/slug";

/** Whether a slug can still be claimed. Throws when the chain cannot be asked. */
export async function readSlugAvailability(slug: string): Promise<boolean> {
  const ensAddress = getNetworkContracts(DEFAULT_CHAIN_ID).greenGoodsENS;
  const { publicClient } = createClients(DEFAULT_CHAIN_ID);
  return isSlugAvailableAcrossChains({
    slug,
    ensAddress,
    publicClient,
    chainId: DEFAULT_CHAIN_ID,
  });
}

/**
 * `data` is only ever the chain's answer. When the chain cannot be asked, the query fails
 * instead, so a check that never ran does not read as a taken name. Create Garden's submit
 * asks again, and the mint has the final say.
 */
export function useSlugAvailability(slug: string | undefined) {
  const debouncedSlug = useDebouncedValue(slug, 300);
  const ensAddress = getNetworkContracts(DEFAULT_CHAIN_ID).greenGoodsENS;
  // Ask only about a well-formed slug, and only where an ENS module is deployed.
  const slugToCheck =
    debouncedSlug &&
    ensAddress !== zeroAddress &&
    slugSchema.safeParse({ slug: debouncedSlug }).success
      ? debouncedSlug
      : undefined;

  return useQuery<boolean>({
    queryKey: ensKeys.availability(debouncedSlug ?? ""),
    queryFn: slugToCheck
      ? async () => {
          try {
            return await readSlugAvailability(slugToCheck);
          } catch (error) {
            logger.warn("Slug availability check failed", { slug: slugToCheck, error });
            throw error;
          }
        }
      : skipToken,
    staleTime: STALE_TIME_FAST, // 5s -- names can be claimed quickly
    retry: false, // Don't retry RPC failures — debounced input will re-trigger
  });
}
