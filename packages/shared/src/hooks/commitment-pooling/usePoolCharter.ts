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
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { isResolvableMetadataCID } from "../../modules/commitment-pooling/metadata";
import {
  commitmentDocumentStore,
  type CommitmentDocumentStore,
} from "../../modules/commitment-pooling/document-store";
import {
  type PoolCharterV1,
  parsePoolCharter,
} from "../../modules/commitment-pooling/pool-charter";

const IMMUTABLE = Number.POSITIVE_INFINITY;

export interface PoolCharterResolution {
  charter: PoolCharterV1 | null;
  isLoading: boolean;
  /** The CID exists but its document could not be read or held no purpose. */
  isUnavailable: boolean;
}

export function usePoolCharter(
  cid: string | null | undefined,
  { documents = commitmentDocumentStore }: { documents?: CommitmentDocumentStore } = {}
): PoolCharterResolution {
  const resolvable = isResolvableMetadataCID(cid);
  const query = useQuery({
    queryKey: commitmentPoolingKeys.poolCharter(resolvable ? cid.trim() : null),
    queryFn: async () => parsePoolCharter(await documents.readJson((cid as string).trim())),
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
