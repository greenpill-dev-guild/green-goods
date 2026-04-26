/**
 * Slug Availability Hook
 *
 * Debounced RPC check for ENS slug availability across the L2 cache and L1 receiver.
 * This is tier 2 of the three-tier validation:
 *   1. Sync Zod (instant) -- useSlugForm
 *   2. Debounced RPC (300ms) -- this hook
 *   3. On-submit recheck -- useENSClaim
 *
 * @module hooks/ens/useSlugAvailability
 */

import { useQuery } from "@tanstack/react-query";
import { type Address, zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_FAST } from "../../config/query-keys";
import { logger } from "../../modules/app/logger";
import { createClients, getNetworkContracts } from "../../utils/blockchain/contracts";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import { isSlugAvailableAcrossChains } from "./availability";
import { slugSchema } from "./useSlugForm";

export function useSlugAvailability(slug: string | undefined) {
  const debouncedSlug = useDebouncedValue(slug, 300);
  const isValidFormat = debouncedSlug
    ? slugSchema.safeParse({ slug: debouncedSlug }).success
    : false;

  const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
  const ensAddress = contracts.greenGoodsENS as Address;

  return useQuery<boolean>({
    queryKey: queryKeys.ens.availability(debouncedSlug ?? ""),
    queryFn: async () => {
      if (!debouncedSlug || !ensAddress || ensAddress === zeroAddress) return false;

      try {
        const { publicClient } = createClients(DEFAULT_CHAIN_ID);
        return isSlugAvailableAcrossChains({
          slug: debouncedSlug,
          ensAddress,
          publicClient,
          chainId: DEFAULT_CHAIN_ID,
        });
      } catch (error) {
        logger.warn("Slug availability check failed", { slug: debouncedSlug, error });
        return false; // Fail closed — treat as unavailable when RPC fails
      }
    },
    enabled: Boolean(debouncedSlug) && isValidFormat && ensAddress !== zeroAddress,
    staleTime: STALE_TIME_FAST, // 5s -- names can be claimed quickly
    retry: false, // Don't retry RPC failures — debounced input will re-trigger
  });
}
