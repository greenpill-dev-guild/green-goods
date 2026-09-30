/**
 * Finish Creating (PRD-1022 D12).
 *
 * A copy of a group that didn't send waits in the steward's queue, and the
 * group row says so ("1 didn't send") with Finish Creating (1). This sends the
 * group's waiting copies as they were built, through `creation-send`: each is
 * its queued job, so a copy whose answer was lost is read back from the chain
 * before anything is sent again, and none can become a second commitment.
 *
 * @module hooks/admin-ui/pool/useFinishCreating
 */

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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

export interface FinishCreatingController {
  /** The group being finished, while it is. */
  sendingGroupId: string | null;
  /** Where each of its copies stands, for the row's act line. */
  copies: readonly SeedCopyProgress[] | null;
  /** Send every copy of this group still waiting in the queue. */
  finish: (displayGroupId: string) => Promise<"sent" | "left" | "none" | "blocked">;
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

  const finish: FinishCreatingController["finish"] = async (displayGroupId) => {
    if (!owner || !sender) return "blocked";
    let waiting: CreationCopy[];
    try {
      const jobs = await jobQueue.getJobs(owner, { kind: "commitment", synced: false });
      waiting = jobs
        .filter((job) => job.chainId === chainId && queuedCreationGroupId(job) === displayGroupId)
        .map((job) => {
          const payload = job.payload as CommitmentCreationPayload;
          return { clientCommitmentId: payload.clientCommitmentId, setId: displayGroupId, payload };
        });
    } catch (error) {
      logger.warn("[useFinishCreating] the queue could not be read", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "blocked";
    }
    if (waiting.length === 0) return "none";

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
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
    }
  };

  return { sendingGroupId, copies, finish };
}
