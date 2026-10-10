import { useQuery } from "@tanstack/react-query";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import {
  selectCommitmentWorkDecisions,
  type CommitmentWorkDecision,
} from "../../modules/commitment-pooling/work-decisions";
import type { CommitmentWorkAttributionRecord } from "../../modules/commitment-pooling/types-relations";
import type { Address } from "../../types/domain";

export function useCommitmentWorkDecisions(input: {
  chainId: number;
  garden?: Address | null;
  commitmentId?: bigint | null;
  attributions: readonly CommitmentWorkAttributionRecord[];
  enabled?: boolean;
}) {
  const workUIDs = input.attributions
    .filter((row) => row.linked)
    .map((row) => row.workUID.toLowerCase())
    .sort();
  const query = useQuery({
    queryKey: commitmentPoolingKeys.workDecisions(
      input.chainId,
      input.commitmentId ?? null,
      workUIDs
    ),
    queryFn: () =>
      selectCommitmentWorkDecisions({
        chainId: input.chainId,
        garden: input.garden as Address,
        attributions: input.attributions,
      }),
    enabled: input.enabled !== false && Boolean(input.garden) && workUIDs.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });
  const decisions = query.data ?? [];
  return {
    ...query,
    decisions,
    byWorkUID: new Map<string, CommitmentWorkDecision>(
      decisions.map((row) => [row.workUID.toLowerCase(), row])
    ),
    reconciliationCandidates: decisions.filter((row) => row.state === "readyToReconcile"),
    readAvailable: !query.isError && (workUIDs.length === 0 || query.isSuccess),
  };
}
