/**
 * Finish Creating (PRD-1022 D12).
 *
 * A copy of a group that didn't send waits in the steward's queue, and the
 * group row says so ("1 didn't send") with Finish Creating (1). `waiting` reads
 * which queued copies belong to which group, so the row can count them and the
 * pool tab can fold them into it rather than list them apart. `finish` sends a
 * group's waiting copies as they were built, through `creation-send`: each is
 * its queued job, so a copy whose answer was lost is read back from the chain
 * before anything is sent again, and none can become a second commitment.
 * Past the group's deadline it sends nothing: the chain would still create the
 * copies, due before anyone could take one up.
 *
 * @module hooks/admin-ui/pool/useFinishCreating
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { logger } from "../../../modules/app/logger";
import {
  type CreationCopy,
  sendCreationCopies,
} from "../../../modules/commitment-pooling/creation-send";
import type { CommitmentCreationPayload } from "../../../modules/commitment-pooling/job-types";
import {
  copiesToRetry,
  type SeedCopyProgress,
} from "../../../modules/commitment-pooling/seed-sets";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import type { Address } from "../../../types/domain";
import type { Job } from "../../../types/job-queue";
import { useTransactionSender } from "../../blockchain/useTransactionSender";

/** The display group a queued creation belongs to, from the words it carries. */
function queuedCreationGroupId(job: Pick<Job, "kind" | "payload">): string | null {
  if (job.kind !== "commitment") return null;
  const payload = job.payload as Partial<CommitmentCreationPayload> | undefined;
  return payload?.metadata?.displayGroup?.id ?? null;
}

/** Each group's queued copies on a chain: display group id to job ids. */
function waitingCopiesByGroup(
  jobs: readonly Pick<Job, "id" | "kind" | "payload" | "chainId">[],
  chainId: number
): ReadonlyMap<string, readonly string[]> {
  const byGroup = new Map<string, string[]>();
  for (const job of jobs) {
    const group = job.chainId === chainId ? queuedCreationGroupId(job) : null;
    if (group) byGroup.set(group, [...(byGroup.get(group) ?? []), job.id]);
  }
  return byGroup;
}

const NOTHING_WAITING: ReadonlyMap<string, readonly string[]> = new Map();

export interface FinishCreatingController {
  /** Each group's copies still waiting in the steward's queue on this chain, by job id. */
  waiting: ReadonlyMap<string, readonly string[]>;
  /** The group being finished, while it is. */
  sendingGroupId: string | null;
  /** Where each of its copies stands, for the row's act line. */
  copies: readonly SeedCopyProgress[] | null;
  /** Send every copy of this group still waiting in the queue. */
  finish: (displayGroupId: string) => Promise<"sent" | "left" | "none" | "blocked" | "expired">;
}

export function useFinishCreating(input: {
  chainId: number;
  owner: Address | null;
}): FinishCreatingController {
  const { chainId, owner } = input;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const [sendingGroupId, setSendingGroupId] = useState<string | null>(null);
  const [copies, setCopies] = useState<readonly SeedCopyProgress[] | null>(null);
  // Under the queue's key: whatever refreshes the queue refreshes this read.
  const waitingQuery = useQuery({
    queryKey: commitmentPoolingKeys.queuedGroupCopies(owner, chainId),
    enabled: Boolean(owner),
    queryFn: async () =>
      waitingCopiesByGroup(
        await jobQueue.getJobs(owner as string, { kind: "commitment", synced: false }),
        chainId
      ),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: "always",
  });

  const finish = useCallback<FinishCreatingController["finish"]>(
    async (displayGroupId) => {
      if (!owner || !sender) return "blocked";
      let waiting: CreationCopy[];
      try {
        const jobs = await jobQueue.getJobs(owner, { kind: "commitment", synced: false });
        waiting = jobs
          .filter((job) => job.chainId === chainId && queuedCreationGroupId(job) === displayGroupId)
          .map((job) => {
            const payload = job.payload as CommitmentCreationPayload;
            return {
              clientCommitmentId: payload.clientCommitmentId,
              setId: displayGroupId,
              payload,
            };
          });
      } catch (error) {
        logger.warn("[useFinishCreating] the queue could not be read", {
          error: error instanceof Error ? error.message : String(error),
        });
        return "blocked";
      }
      if (waiting.length === 0) return "none";
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (waiting.some(({ payload }) => payload.dueDate > 0n && payload.dueDate <= now)) {
        return "expired";
      }

      const latest = new Map<string, SeedCopyProgress>();
      setSendingGroupId(displayGroupId);
      try {
        const ended = await sendCreationCopies({
          copies: waiting,
          queue: jobQueue,
          sender,
          owner,
          chainId,
          onCopy: (progress) => {
            latest.set(progress.clientCommitmentId, progress);
            setCopies([...latest.values()]);
          },
          // The group already exists: a declined prompt leaves its copies waiting.
          clearable: () => false,
        });
        return copiesToRetry(ended).length > 0 ? "left" : "sent";
      } finally {
        setSendingGroupId(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) }),
          // The queue and what waits in it per group, read again after the send.
          queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.queueState(owner) }),
        ]);
      }
    },
    [owner, sender, chainId, queryClient]
  );

  return { waiting: waitingQuery.data ?? NOTHING_WAITING, sendingGroupId, copies, finish };
}
