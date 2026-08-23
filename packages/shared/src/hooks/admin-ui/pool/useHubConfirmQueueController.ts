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
 * @module hooks/admin-ui/pool/useHubConfirmQueueController
 */

import { useMemo } from "react";

import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import type { CommitmentsToConfirm } from "../../commitment-pooling/useCommitmentsToConfirm";
import type { ConfirmQueueRow, HubConfirmQueueController } from "./controller.types";

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

  const rows = useMemo<ConfirmQueueRow[]>(() => {
    const titleOf = (commitment: CommitmentReadModel) =>
      (commitment.metadataCID && metadata.byCID.get(commitment.metadataCID.trim())?.title) ?? null;
    const ordinary = toConfirm.groups.flatMap((group) =>
      group.rows.map((row) => ({
        commitment: row.commitment,
        garden: group.garden,
        gardenName: group.gardenName,
        eligibility: "ORDINARY" as const,
        title: titleOf(row.commitment),
        poolGarden: row.poolGarden,
        canDispute: row.canDispute,
      }))
    );
    const fallback = toConfirm.fallback.map((row) => ({
      commitment: row.commitment,
      garden: row.garden,
      gardenName: row.gardenName,
      eligibility: row.path,
      title: titleOf(row.commitment),
      poolGarden: row.poolGarden,
      canDispute: row.canDispute,
    }));
    // A disputed row's garden is already the pool's own, because only that
    // pool's steward may resolve it.
    const disputed = (toConfirm.disputed ?? []).map((row) => ({
      commitment: row.commitment,
      garden: row.garden,
      gardenName: row.gardenName,
      eligibility: "DISPUTED" as const,
      title: titleOf(row.commitment),
      poolGarden: row.garden,
      canDispute: true,
    }));
    const all = [...ordinary, ...fallback, ...disputed];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (row) =>
        (row.title ?? "").toLowerCase().includes(needle) ||
        row.gardenName.toLowerCase().includes(needle)
    );
  }, [toConfirm.groups, toConfirm.fallback, toConfirm.disputed, metadata.byCID, search]);

  const acts = useMemo(
    () => ({
      confirm: (row: ConfirmQueueRow) =>
        jobs.enqueue({
          act: "confirm",
          commitmentId: row.commitment.commitmentId,
          gardenAddress: row.garden,
        }),
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
