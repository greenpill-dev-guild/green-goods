/**
 * useCommitmentCycleNames Hook
 *
 * Resolves the names behind a set of cycles' metadata CIDs.
 *
 * A season or campaign is named by its stewards and the record carries only a
 * CID (`CommitmentCycleRecord.metadataCID`). The pool tab, a cycle's own page
 * and the member's sheet all want the same name, so each CID is its own cached
 * query and two cycles sharing a CID cost one read. Content at a CID never
 * changes, so a resolved name is good indefinitely.
 *
 * Missing and unreachable are kept apart: a cycle with no CID simply has no
 * name, while a CID that failed to read may have one the rail cannot show yet.
 *
 * @module hooks/commitment-pooling/useCommitmentCycleNames
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";

import {
  type CycleMetadataNameResolution,
  resolveCycleMetadataName,
} from "../../modules/commitment-pooling/cycle-metadata";

const IMMUTABLE = Number.POSITIVE_INFINITY;
const MISSING: CycleMetadataNameResolution = { status: "missing", name: null };

/**
 * Chain-free like the commitment metadata key: the same CID is the same bytes
 * on every chain. Declared here beside the queue-state key rather than in the
 * registry, which this lane does not own.
 */
const cycleMetadataKey = (cid: string) => commitmentPoolingKeys.cycleMetadata(cid);

function resolvableCID(cid: string | null | undefined): string | null {
  if (!cid) return null;
  const value = cid.trim();
  return value.length > 0 && value !== "0" && value !== "-" ? value : null;
}

export interface CommitmentCycleNameMap {
  /**
   * Decimal cycle id to the resolution of its name. A cycle whose read is still
   * in flight has no entry yet; every other input cycle has one.
   */
  byCycleId: Map<string, CycleMetadataNameResolution>;
  /** True while any CID is still being read. */
  isLoading: boolean;
}

export function useCommitmentCycleNames(
  cycles: readonly { cycleId: bigint; metadataCID: string | null }[]
): CommitmentCycleNameMap {
  const { cids, cidByCycle } = useMemo(() => {
    const unique = new Set<string>();
    const cidByCycle = new Map<string, string | null>();
    for (const cycle of cycles) {
      const cid = resolvableCID(cycle.metadataCID);
      cidByCycle.set(cycle.cycleId.toString(), cid);
      if (cid) unique.add(cid);
    }
    // Sorted so the query list is stable across re-renders in a different order.
    return { cids: [...unique].sort(), cidByCycle };
  }, [cycles]);

  const results = useQueries({
    queries: cids.map((cid) => ({
      queryKey: cycleMetadataKey(cid),
      queryFn: () => resolveCycleMetadataName(cid),
      staleTime: IMMUTABLE,
      gcTime: IMMUTABLE,
      // A caption is not worth hammering a gateway for.
      retry: 1,
    })),
  });

  return useMemo(() => {
    const byCID = new Map<string, CycleMetadataNameResolution>();
    const inFlight = new Set<string>();
    let isLoading = false;
    results.forEach((result, index) => {
      const cid = cids[index];
      if (!cid) return;
      if (result.isLoading) {
        isLoading = true;
        inFlight.add(cid);
        return;
      }
      // A read that failed outright (rather than resolving to "unavailable")
      // reads as unavailable too: the name may exist, the rail just cannot
      // show it yet.
      byCID.set(cid, result.data ?? { status: "unavailable", name: null });
    });
    const byCycleId = new Map<string, CycleMetadataNameResolution>();
    for (const [cycleId, cid] of cidByCycle) {
      if (!cid) {
        byCycleId.set(cycleId, MISSING);
        continue;
      }
      if (inFlight.has(cid)) continue;
      byCycleId.set(cycleId, byCID.get(cid) ?? { status: "unavailable", name: null });
    }
    return { byCycleId, isLoading };
  }, [results, cids, cidByCycle]);
}
