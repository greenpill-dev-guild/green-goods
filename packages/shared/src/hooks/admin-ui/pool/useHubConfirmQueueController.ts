/**
 * useHubConfirmQueueController Hook
 *
 * The Hub's Confirm stage (W13, uiux-spec §6.9) as rows and acts: the
 * ordinary rows (what the reader's gardens must confirm) and the fallback
 * rows (what only a steward's reasoned step-in can still confirm), each with
 * its title, its garden and its eligibility; Confirm on an ordinary row
 * enqueues the confirmation, Not yet raises a reasoned dispute. A fallback
 * row's confirmation lives in the commitment dialog, which names the garden
 * whose authority it uses.
 *
 * @module hooks/admin-ui/pool/useHubConfirmQueueController
 */

import { useMemo } from "react";

import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitmentMutation } from "../../commitment-pooling/useCommitmentMutations";
import type { CommitmentsToConfirm } from "../../commitment-pooling/useCommitmentsToConfirm";

export type ConfirmQueueEligibility = "ORDINARY" | "POOL_FALLBACK" | "PROTOCOL_FALLBACK";

export interface ConfirmQueueRow {
  commitment: CommitmentReadModel;
  /** The garden whose authority the act uses: the party garden, or the fallback garden. */
  garden: Address;
  gardenName: string;
  eligibility: ConfirmQueueEligibility;
  title: string | null;
}

export function useHubConfirmQueueController(input: {
  chainId: number;
  toConfirm: CommitmentsToConfirm;
  /** The Hub's search term, already normalized. */
  search: string;
}) {
  const { chainId, toConfirm, search } = input;
  const isOnline = useOnlineStatus();
  const jobs = useCommitmentJobs({ chainId });
  const mutation = useCommitmentMutation({ chainId });

  const commitments = useMemo(
    () => [
      ...toConfirm.groups.flatMap((group) => group.rows.map((row) => row.commitment)),
      ...toConfirm.fallback.map((row) => row.commitment),
    ],
    [toConfirm.groups, toConfirm.fallback]
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
      }))
    );
    const fallback = toConfirm.fallback.map((row) => ({
      commitment: row.commitment,
      garden: row.garden,
      gardenName: row.gardenName,
      eligibility: row.path,
      title: titleOf(row.commitment),
    }));
    const all = [...ordinary, ...fallback];
    const needle = search.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (row) =>
        (row.title ?? "").toLowerCase().includes(needle) ||
        row.gardenName.toLowerCase().includes(needle)
    );
  }, [toConfirm.groups, toConfirm.fallback, metadata.byCID, search]);

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

export type HubConfirmQueueController = ReturnType<typeof useHubConfirmQueueController>;
