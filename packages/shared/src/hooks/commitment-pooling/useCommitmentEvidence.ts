/**
 * useCommitmentEvidence Hook
 *
 * The proof attached to a commitment, resolved to what was actually submitted:
 * the note, the links, the photos and the voice notes behind each attribution
 * CID. The confirmation sheet reads this so the person deciding sees the
 * evidence rather than a count of it.
 *
 * Documents are content-addressed and immutable, so they are cached forever;
 * a CID the gateway cannot serve resolves to null and the row says so.
 *
 * @module hooks/commitment-pooling/useCommitmentEvidence
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys } from "../../config/query-keys";
import { demoDocumentFor } from "../../modules/commitment-pooling/demo/demo-gate";
import {
  type CommitmentEvidenceDocumentV1,
  parseCommitmentEvidenceDocument,
} from "../../modules/commitment-pooling/evidence";
import { isResolvableMetadataCID } from "../../modules/commitment-pooling/metadata";
import { getJsonByHash, resolveIPFSUrl } from "../../modules/data/ipfs/resolve";
import type { Address } from "../../types/domain";

/** Content at a CID is the same bytes forever. */
const IMMUTABLE = Number.POSITIVE_INFINITY;

export interface ResolvedEvidence {
  cid: string;
  contributor: Address | null;
  attacher: Address | null;
  createdAt: number;
  /** Null while loading or when the document could not be read. */
  document: CommitmentEvidenceDocumentV1 | null;
  isLoading: boolean;
  /** Gateway URLs for the document's media, in order. */
  mediaUrls: string[];
  audioUrls: string[];
}

/** The shape the detail read hands back for each evidence attribution. */
export interface EvidenceAttributionRow {
  cid?: unknown;
  contributor?: unknown;
  attacher?: unknown;
  createdAt?: unknown;
}

function address(value: unknown): Address | null {
  return typeof value === "string" && value.startsWith("0x") ? (value as Address) : null;
}

export function useCommitmentEvidence(attributions: readonly EvidenceAttributionRow[] = []): {
  evidence: ResolvedEvidence[];
  isLoading: boolean;
} {
  const rows = useMemo(
    () =>
      attributions
        .map((row) => ({
          cid: typeof row.cid === "string" ? row.cid.trim() : "",
          contributor: address(row.contributor),
          attacher: address(row.attacher),
          createdAt: typeof row.createdAt === "number" ? row.createdAt : Number(row.createdAt ?? 0),
        }))
        .filter((row) => isResolvableMetadataCID(row.cid))
        .sort((left, right) => right.createdAt - left.createdAt),
    [attributions]
  );

  const results = useQueries({
    queries: rows.map((row) => ({
      queryKey: queryKeys.commitmentPooling.evidence(row.cid),
      queryFn: async () =>
        parseCommitmentEvidenceDocument(
          (await demoDocumentFor(row.cid)) ?? (await getJsonByHash(row.cid))
        ),
      staleTime: IMMUTABLE,
      gcTime: IMMUTABLE,
      retry: 1,
    })),
  });

  const evidence = useMemo(
    () =>
      rows.map((row, index) => {
        const document = results[index]?.data ?? null;
        return {
          ...row,
          document,
          isLoading: results[index]?.isLoading ?? false,
          mediaUrls: (document?.media ?? []).map((item) => resolveIPFSUrl(item.cid)),
          audioUrls: (document?.audio ?? []).map((item) => resolveIPFSUrl(item.cid)),
        };
      }),
    [rows, results]
  );

  return { evidence, isLoading: results.some((result) => result.isLoading) };
}
