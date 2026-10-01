/**
 * useHubConfirmQueueController Hook
 *
 * The Hub's Confirm stage (W13, uiux-spec §6.9) as rows and acts: the
 * ordinary rows (what the reader's gardens must confirm) and the fallback
 * rows (what only a steward's reasoned step-in can still confirm), each with
 * its title, its garden and its eligibility, plus the disputed rows of the
 * reader's own pools, which carry Resolve rather than a confirmation. Confirm
 * on an ordinary row enqueues the confirmation, Not yet raises a reasoned
 * dispute. A fallback row's confirmation lives in the commitment dialog, which
 * names the garden whose authority it uses.
 *
 * Each row states the garden that owns its pool beside the garden whose
 * authority confirms. They are different questions: a garden confirms as a
 * party wherever its commitment lives, while a dispute is admitted only from
 * the pool garden's own steward, so `canDispute` answers that separately.
 *
 * The rows hold steady for the visit (PRD-1045): a row confirmed here turns
 * into its outcome in place and stays until the steward leaves the stage, and
 * a copy from a group is its own row, named by the size of its group.
 *
 * @module hooks/admin-ui/pool/useHubConfirmQueueController
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { STALE_TIME_MEDIUM } from "../../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import {
  type ConfirmDecision,
  type ConfirmQueueProjectionRow,
  type ConfirmVisitEntry,
  confirmRowKey,
  confirmRowState,
  matchesConfirmSearch,
  reconcileConfirmVisit,
  selectConfirmQueueRows,
} from "../../../modules/commitment-pooling/confirm-queue";
import { getCommitments } from "../../../modules/commitment-pooling/data";
import { groupCommitmentsForDisplay } from "../../../modules/commitment-pooling/display-groups";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import {
  type CommitmentMetadataMap,
  useCommitmentMetadata,
} from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import type { CommitmentsToConfirm } from "../../commitment-pooling/useCommitmentsToConfirm";
import type { ConfirmQueueRow, HubConfirmQueueController } from "./controller.types";

/**
 * How many published promises each grouped row's group holds, read from its
 * pool's copies. Only pools with a grouped row are read; the rest cost nothing.
 */
function useConfirmGroupSizes(
  chainId: number,
  rows: readonly ConfirmQueueProjectionRow[],
  byCID: CommitmentMetadataMap["byCID"]
): ReadonlyMap<string, number> {
  const poolIds = useMemo(() => {
    const ids = new Set<bigint>();
    for (const row of rows) {
      const cid = row.commitment.metadataCID?.trim();
      if (cid && byCID.get(cid)?.displayGroup && typeof row.commitment.poolId === "bigint") {
        ids.add(row.commitment.poolId);
      }
    }
    return [...ids].sort((left, right) => (left < right ? -1 : 1));
  }, [rows, byCID]);
  const pools = useQueries({
    queries: poolIds.map((poolId) => ({
      queryKey: commitmentPoolingKeys.commitments(chainId, { chainId, poolId }),
      queryFn: () => getCommitments({ chainId, poolId }),
      staleTime: STALE_TIME_MEDIUM,
    })),
  });
  const copies = useMemo(() => pools.flatMap((pool) => pool.data ?? []), [pools]);
  const { byCID: copiesByCID } = useCommitmentMetadata(copies);
  return useMemo(() => {
    const sizes = new Map<string, number>();
    for (const entry of groupCommitmentsForDisplay({
      commitments: copies,
      metadataByCID: copiesByCID,
    })) {
      if (entry.kind !== "group") continue;
      for (const copy of entry.children) sizes.set(copy.id, entry.counts.published);
    }
    return sizes;
  }, [copies, copiesByCID]);
}

export function useHubConfirmQueueController(input: {
  chainId: number;
  toConfirm: CommitmentsToConfirm;
  /** The Hub's search term, already normalized. */
  search: string;
}): HubConfirmQueueController {
  const { chainId, toConfirm, search } = input;
  const isOnline = useOnlineStatus();
  const jobs = useCommitmentJobs({ chainId });
  const mutation = useCommitmentMutation({ chainId });

  const commitments = useMemo(
    () => [
      ...toConfirm.groups.flatMap((group) => group.rows.map((row) => row.commitment)),
      ...toConfirm.fallback.map((row) => row.commitment),
      ...(toConfirm.disputed ?? []).map((row) => row.commitment),
    ],
    [toConfirm.groups, toConfirm.fallback, toConfirm.disputed]
  );
  const metadata = useCommitmentMetadata(commitments);
  const live = useMemo(
    () => selectConfirmQueueRows({ toConfirm, byCID: metadata.byCID, search: "" }),
    [toConfirm, metadata.byCID]
  );
  const groupSizes = useConfirmGroupSizes(chainId, live, metadata.byCID);

  // Only a settled read moves the visit: rows keep their place, and new ones
  // join the end. Taken while rendering, so a row never flashes in late. A
  // failed read moves nothing for good: states are read from the queue anew.
  const [visit, setVisit] = useState<{
    read: string;
    entries: ConfirmVisitEntry<ConfirmQueueProjectionRow>[];
  }>({ read: "", entries: [] });
  const read = live.map(confirmRowKey).join("|");
  if (!toConfirm.isLoading && visit.read !== read) {
    setVisit({ read, entries: reconcileConfirmVisit(visit.entries, live) });
  }
  const [decisions, setDecisions] = useState<Record<string, ConfirmDecision>>({});

  const rows = useMemo<ConfirmQueueRow[]>(() => {
    const byKey = new Map(live.map((row) => [confirmRowKey(row), row]));
    const liveKeys = new Set(byKey.keys());
    return visit.entries
      .map(({ key, row: seen }) => {
        const row = byKey.get(key) ?? seen;
        return {
          ...row,
          state: confirmRowState(key, { live: liveKeys, decisions }),
          groupSize: groupSizes.get(row.commitment.id) ?? null,
        };
      })
      .filter((row) => matchesConfirmSearch(row, search));
  }, [visit.entries, live, decisions, groupSizes, search]);

  const acts = useMemo(
    () => ({
      confirm: async (row: ConfirmQueueRow) => {
        let landed = false;
        const jobId = await jobs.enqueue({
          act: "confirm",
          commitmentId: row.commitment.commitmentId,
          gardenAddress: row.garden,
          report: (event) => {
            if (event.stage === "landed") landed = true;
          },
        });
        const decision: ConfirmDecision = { kind: landed ? "confirmed" : "queued", at: Date.now() };
        setDecisions((current) => ({ ...current, [confirmRowKey(row)]: decision }));
        return jobId;
      },
      notYet: (row: ConfirmQueueRow, reason: string) =>
        mutation.mutateAsync({
          action: "raiseDispute",
          commitmentId: row.commitment.commitmentId,
          reason,
          gardenAddress: row.garden,
        }),
    }),
    [jobs, mutation]
  );

  return {
    rows,
    isOnline,
    isLoading: toConfirm.isLoading || metadata.isLoading,
    isError: toConfirm.isError,
    isConfirming: jobs.isPending,
    isDisputing: mutation.isPending,
    acts,
  };
}
