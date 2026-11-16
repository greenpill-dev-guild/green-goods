import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import {
  hasWorkVisibilityExclusions,
  isWorkVisible,
  readWorkVisibility,
  type WorkVisibilitySnapshot,
} from "../../modules/work/work-visibility";

export function workVisibilityQuery(chainId: number) {
  return {
    queryKey: worksKeys.visibility(chainId),
    queryFn: () => readWorkVisibility(chainId),
    initialData: hasWorkVisibilityExclusions(chainId)
      ? undefined
      : { chainId, excludedWorkUIDs: [], excludedApprovalUIDs: [] },
    networkMode: "online" as const,
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  };
}

/** The successful snapshot persists with prepared work; a failed refresh keeps that snapshot. */
export function useWorkVisibility(chainId: number) {
  const query = useQuery<WorkVisibilitySnapshot>(workVisibilityQuery(chainId));
  const snapshot = query.data;
  const isVisible = useCallback(
    (uid: string) => (snapshot ? isWorkVisible(uid, snapshot) : !/^0x[0-9a-f]{64}$/i.test(uid)),
    [snapshot]
  );
  return { ...query, snapshot, isReady: snapshot !== undefined, isVisible };
}
