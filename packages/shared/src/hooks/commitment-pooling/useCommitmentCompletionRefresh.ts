/**
 * useCommitmentCompletionRefresh Hook
 *
 * Re-reads commitment data when a queued commitment act lands.
 *
 * Queueing an act refreshes the reads at once (`useCommitmentJobs`), but the act
 * is sent later, and until now nothing refreshed them again when it completed:
 * the pending chip cleared and the commitment underneath still showed its old
 * state. The indexer also trails the receipt, so the reads are invalidated at
 * completion and again on the shared indexer-lag schedule.
 *
 * Mount it once per app, somewhere that stays mounted: the client's
 * `JobQueueProvider` does, and the admin's canvas shell does, because the admin
 * has no queue provider. It listens to the queue's event bus directly, so it
 * needs a query client above it and nothing else.
 *
 * @module hooks/commitment-pooling/useCommitmentCompletionRefresh
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import {
  COMMITMENT_JOB_KINDS,
  type CommitmentJobKind,
} from "../../modules/commitment-pooling/job-types";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { useProgressiveInvalidation } from "../utils/useTimeout";

export function useCommitmentCompletionRefresh(): void {
  const queryClient = useQueryClient();
  // The follow-ups fire after the event is gone, so the chain it named is kept.
  const chainId = useRef<number>(DEFAULT_CHAIN_ID);

  // The chain's whole commitment subtree, not one commitment: an act moves the
  // pool's counts, the claim lists and the inbox as well as its own record, and
  // a creation has no id to name yet.
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId.current) });
  }, [queryClient]);
  const { start: refreshAsIndexerCatchesUp } = useProgressiveInvalidation(
    refresh,
    INDEXER_LAG_SCHEDULE_MS
  );

  useJobQueueEvents(
    ["job:completed"],
    (_type, { job }) => {
      if (!COMMITMENT_JOB_KINDS.includes(job.kind as CommitmentJobKind)) return;
      chainId.current = job.chainId ?? DEFAULT_CHAIN_ID;
      refresh();
      refreshAsIndexerCatchesUp();
    },
    [refresh, refreshAsIndexerCatchesUp]
  );
}
