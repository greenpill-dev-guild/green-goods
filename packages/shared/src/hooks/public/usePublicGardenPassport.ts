import { useQuery } from "@tanstack/react-query";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { isPublicPassportPublished } from "../../config/public-record-visibility";
import { publicKeys } from "../../config/query-keys/public";
import { STALE_TIME_RARE } from "../../config/query-keys/constants";
import { getPublicGardenPassport } from "../../modules/commitment-pooling/data-public-passport";
import type { PublicGardenPassportRecord } from "../../modules/commitment-pooling/public-passport-types";
import type { Address } from "../../types/domain";

export interface UsePublicGardenPassportOptions {
  chainId?: number;
}

export interface PublicGardenPassportState {
  /**
   * Whether this garden's stewards agreed to publish a passport. When they have not, nothing is
   * read: an unpublished passport is not a loading, empty or failed one.
   */
  published: boolean;
  passport: PublicGardenPassportRecord | undefined;
  isPending: boolean;
  /** The passport could not be read at all. Its sections report their own failed sources. */
  isError: boolean;
  refetch: () => void;
}

/** One garden's passport for the public website, read only when the garden publishes one. */
export function usePublicGardenPassport(
  gardenAddress: Address | undefined,
  options: UsePublicGardenPassportOptions = {}
): PublicGardenPassportState {
  const chainId = options.chainId ?? DEFAULT_CHAIN_ID;
  const published =
    gardenAddress !== undefined && isPublicPassportPublished(chainId, gardenAddress);
  const query = useQuery({
    queryKey: publicKeys.gardenPassport(gardenAddress, chainId),
    enabled: published,
    queryFn: () => getPublicGardenPassport(chainId, gardenAddress as Address),
    staleTime: STALE_TIME_RARE,
  });
  return {
    published,
    passport: query.data,
    isPending: published && query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
