/**
 * useCommitmentReason Hook
 *
 * Resolves the words behind a reason CID: why a claim was declined, a
 * commitment withdrawn, or a dispute raised. The record carries only the CID;
 * the member reads the sentence.
 *
 * Immutable at its CID, cached forever, and never an error for the caller: a
 * reason that cannot be read leaves the row standing with an em dash where the
 * words would be.
 *
 * @module hooks/commitment-pooling/useCommitmentReason
 */

import { useQuery } from "@tanstack/react-query";

import { demoDocumentFor } from "../../modules/commitment-pooling/demo/demo-gate";
import { getJsonByHash } from "../../modules/data/ipfs/resolve";
import { isResolvableMetadataCID } from "../../modules/commitment-pooling/metadata";
import { queryKeys } from "../../config/query-keys";
import {
  type CommitmentReasonV1,
  parseCommitmentReason,
} from "../../modules/commitment-pooling/reasons";

const IMMUTABLE = Number.POSITIVE_INFINITY;

export interface CommitmentReasonResolution {
  reason: CommitmentReasonV1 | null;
  isLoading: boolean;
  /** The CID exists but its document could not be read or held no reason. */
  isUnavailable: boolean;
}

export function useCommitmentReason(cid: string | null | undefined): CommitmentReasonResolution {
  const resolvable = isResolvableMetadataCID(cid);
  const query = useQuery({
    queryKey: queryKeys.commitmentPooling.reason(resolvable ? cid.trim() : null),
    queryFn: async () => {
      const key = (cid as string).trim();
      return parseCommitmentReason((await demoDocumentFor(key)) ?? (await getJsonByHash(key)));
    },
    enabled: resolvable,
    staleTime: IMMUTABLE,
    gcTime: IMMUTABLE,
    retry: 1,
  });
  return {
    reason: query.data ?? null,
    isLoading: resolvable && query.isLoading,
    isUnavailable: resolvable && !query.isLoading && (query.isError || query.data === null),
  };
}
