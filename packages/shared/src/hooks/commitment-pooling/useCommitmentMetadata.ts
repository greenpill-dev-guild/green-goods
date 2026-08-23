/**
 * useCommitmentMetadata Hook
 *
 * Resolves the words behind a commitment's metadata CID.
 *
 * Each CID is its own query so the cache is shared across surfaces: the same
 * commitment appears in a garden's pool, in the member's own sheet and on its
 * detail screen, and it should cost one fetch rather than three. Metadata is
 * immutable at its CID, so it never needs revalidating.
 *
 * A failed or missing read is not an error state for the caller. The commitment
 * is still real and still binding; it simply renders by what it counts instead
 * of by what it is called.
 *
 * @module hooks/commitment-pooling/useCommitmentMetadata
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "../../config/query-keys";
import {
  commitmentDocumentStore,
  type CommitmentDocumentStore,
} from "../../modules/commitment-pooling/document-store";
import {
  type CommitmentMetadataV1,
  isResolvableMetadataCID,
  parseCommitmentMetadata,
} from "../../modules/commitment-pooling/metadata";

/** Content at a CID never changes, so a resolved title is good indefinitely. */
const IMMUTABLE = Number.POSITIVE_INFINITY;

export interface CommitmentMetadataMap {
  /** CID to its parsed words. A CID that failed or held nothing usable is absent. */
  byCID: Map<string, CommitmentMetadataV1>;
  /** True while any CID is still being read. */
  isLoading: boolean;
}

export function useCommitmentMetadata(
  commitments: readonly { metadataCID?: string | null }[],
  { documents = commitmentDocumentStore }: { documents?: CommitmentDocumentStore } = {}
): CommitmentMetadataMap {
  const cids = useMemo(() => {
    const unique = new Set<string>();
    for (const commitment of commitments) {
      if (isResolvableMetadataCID(commitment.metadataCID)) {
        unique.add(commitment.metadataCID.trim());
      }
    }
    // Sorted so the query list is stable across re-renders in a different order.
    return [...unique].sort();
  }, [commitments]);

  const results = useQueries({
    queries: cids.map((cid) => ({
      queryKey: queryKeys.commitmentPooling.metadata(cid),
      queryFn: async () => parseCommitmentMetadata(await documents.readJson(cid)),
      staleTime: IMMUTABLE,
      gcTime: IMMUTABLE,
      // A caption is not worth hammering a gateway for.
      retry: 1,
    })),
  });

  return useMemo(() => {
    const byCID = new Map<string, CommitmentMetadataV1>();
    let isLoading = false;
    results.forEach((result, index) => {
      const cid = cids[index];
      if (result.isLoading) isLoading = true;
      if (cid && result.data) byCID.set(cid, result.data);
    });
    return { byCID, isLoading };
  }, [results, cids]);
}

/** The one-commitment case, which the detail screen wants. */
export function useCommitmentMetadataFor(
  commitment?: { metadataCID?: string | null },
  options: { documents?: CommitmentDocumentStore } = {}
): CommitmentMetadataV1 | null {
  const list = useMemo(() => (commitment ? [commitment] : []), [commitment]);
  const { byCID } = useCommitmentMetadata(list, options);
  if (!isResolvableMetadataCID(commitment?.metadataCID)) return null;
  return byCID.get(commitment.metadataCID.trim()) ?? null;
}
