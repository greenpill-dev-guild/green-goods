/**
 * usePoolCharter Hook
 *
 * Resolves the sentence behind a pool's `charterCID`: what this pool is for.
 * The record carries only the CID; the pool card reads the words.
 *
 * Immutable at its CID, cached forever, and never an error for the caller: a
 * charter that cannot be read leaves the card standing with its state and
 * counts, and says the words are unavailable rather than absent.
 *
 * @module hooks/commitment-pooling/usePoolCharter
 */

import { useQuery } from "@tanstack/react-query";

import { getJsonByHash } from "../../modules/data/ipfs/resolve";
import { isResolvableMetadataCID } from "../../modules/commitment-pooling/metadata";
import {
  type PoolCharterV1,
  parsePoolCharter,
} from "../../modules/commitment-pooling/pool-charter";

const IMMUTABLE = Number.POSITIVE_INFINITY;

export function usePoolCharter(cid: string | null | undefined): {
  charter: PoolCharterV1 | null;
  isLoading: boolean;
  /** The CID exists but its document could not be read or held no purpose. */
  isUnavailable: boolean;
} {
  const resolvable = isResolvableMetadataCID(cid);
  const query = useQuery({
    // Chain-free like the metadata key: the same CID is the same bytes everywhere.
    queryKey: [
      "greengoods",
      "commitment-pooling",
      "pool-charter",
      resolvable ? cid.trim() : null,
    ] as const,
    queryFn: async () => parsePoolCharter(await getJsonByHash((cid as string).trim())),
    enabled: resolvable,
    staleTime: IMMUTABLE,
    gcTime: IMMUTABLE,
    retry: 1,
  });
  return {
    charter: query.data ?? null,
    isLoading: resolvable && query.isLoading,
    isUnavailable: resolvable && !query.isLoading && (query.isError || query.data === null),
  };
}
