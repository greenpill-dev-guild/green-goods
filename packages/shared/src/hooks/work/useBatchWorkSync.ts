/**
 * Batch Work Sync Hook
 *
 * Enables wallet users to sync all queued work submissions in a single
 * EAS multiAttest transaction (one wallet signature).
 *
 * @module hooks/work/useBatchWorkSync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getWalletClient, waitForTransactionReceipt } from "@wagmi/core";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import type { WorkDraft } from "../../types/domain";
import { logger } from "../../modules/app/logger";
import { trackContractError } from "../../modules/app/error-tracking";
import { queueToasts } from "../../components/toast";
import { wagmiConfig } from "../../config/appkit";
import { DEFAULT_CHAIN_ID, getEASConfig } from "../../config/blockchain";
import { jobQueue, jobQueueDB, jobQueueEventBus } from "../../modules/job-queue";
import { encodeWorkData } from "../../utils/eas/encoders";
import { buildBatchWorkAttestTx } from "../../utils/eas/transaction-builder";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useUser } from "../auth/useUser";
import { queryKeys } from "../query-keys";

interface BatchWorkSyncResult {
  hash?: `0x${string}`;
  count: number;
  gardens: string[];
}

interface EncodedWorkJob {
  job: Job<WorkJobPayload>;
  gardenAddress: `0x${string}`;
  attestationData: `0x${string}`;
}

function toWorkDraft(payload: WorkJobPayload, mediaFiles: File[], createdAt: number): WorkDraft {
  // Separate audio from visual media
  const audioFiles = mediaFiles.filter((f) => f.type.startsWith("audio/"));
  const visualFiles = mediaFiles.filter((f) => !f.type.startsWith("audio/"));

  return {
    actionUID: payload.actionUID,
    title: payload.title || `Action ${payload.actionUID} - ${new Date(createdAt).toISOString()}`,
    feedback: payload.feedback,
    media: visualFiles,
    details: payload.details ?? {},
    ...(typeof payload.timeSpentMinutes === "number"
      ? { timeSpentMinutes: payload.timeSpentMinutes }
      : { timeSpentMinutes: 0 }),
    ...(payload.tags ? { tags: payload.tags } : {}),
    ...(audioFiles.length > 0 ? { audioNotes: audioFiles } : {}),
  };
}

/**
 * Sync all queued work for wallet users in a single transaction.
 */
export function useBatchWorkSync() {
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();
  const { authMode } = useUser();
  const chainId = DEFAULT_CHAIN_ID;

  return useMutation({
    mutationFn: async (): Promise<BatchWorkSyncResult> => {
      if (authMode !== "wallet") {
        throw new Error("Batch work sync is only available in wallet mode.");
      }
      if (!primaryAddress) {
        throw new Error("Wallet address not available. Please reconnect and try again.");
      }

      const pendingJobs = await jobQueue.getJobsWithImages(primaryAddress);
      if (pendingJobs.length === 0) {
        return { count: 0, gardens: [] };
      }

      const walletClient = await getWalletClient(wagmiConfig, { chainId });
      if (!walletClient?.account) {
        throw new Error("Wallet not connected. Please connect your wallet and try again.");
      }

      const encodedJobs = (await Promise.all(
        pendingJobs.map(async ({ job, images }): Promise<EncodedWorkJob> => {
          const payload = job.payload as WorkJobPayload;
          const mediaFiles = images.map((image) => image.file);
          const draft = toWorkDraft(payload, mediaFiles, job.createdAt);

          const attestationData = await encodeWorkData(draft, chainId, {
            gardenAddress: payload.gardenAddress,
            authMode: "wallet",
          });

          return {
            job,
            gardenAddress: payload.gardenAddress as `0x${string}`,
            attestationData,
          };
        })
      )) as EncodedWorkJob[];

      const easConfig = getEASConfig(chainId);
      const txParams = buildBatchWorkAttestTx(
        easConfig,
        encodedJobs.map(({ gardenAddress, attestationData }) => ({
          gardenAddress,
          attestationData,
        }))
      );

      const hash = await walletClient.sendTransaction({
        ...txParams,
        chain: walletClient.chain,
        account: walletClient.account,
      });

      await waitForTransactionReceipt(wagmiConfig, { hash, chainId });

      for (const { job } of encodedJobs) {
        try {
          await jobQueueDB.markJobSynced(job.id, hash);
        } catch (error) {
          logger.warn("Failed to mark job as synced", {
            source: "useBatchWorkSync",
            jobId: job.id,
            error,
          });
        }

        try {
          await jobQueueDB.deleteJob(job.id);
        } catch (error) {
          logger.warn("Failed to delete synced job", {
            source: "useBatchWorkSync",
            jobId: job.id,
            error,
          });
        }

        jobQueueEventBus.emit("job:completed", {
          jobId: job.id,
          job: {
            ...job,
            synced: true,
            meta: { ...(job.meta ?? {}), txHash: hash, batchSync: true },
          },
          txHash: hash,
        });
      }

      jobQueueEventBus.emit("queue:sync-completed", {
        result: { processed: encodedJobs.length, failed: 0, skipped: 0 },
      });

      return {
        hash,
        count: encodedJobs.length,
        gardens: [...new Set(encodedJobs.map(({ gardenAddress }) => gardenAddress))],
      };
    },
    onSuccess: ({ count, gardens }) => {
      if (count === 0) {
        queueToasts.queueClear();
      } else {
        queueToasts.syncSuccess(count);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.queue.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
      queryClient.invalidateQueries({ queryKey: queryKeys.works.all });

      if (primaryAddress) {
        queryClient.invalidateQueries({
          queryKey: ["myWorks", primaryAddress],
          exact: false,
        });
      }

      for (const gardenAddress of gardens) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.online(gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.merged(gardenAddress, chainId),
        });
      }
    },
    onError: (error) => {
      logger.error("Batch work sync failed", {
        source: "useBatchWorkSync",
        error,
        authMode,
        primaryAddress,
      });

      trackContractError(error, {
        source: "useBatchWorkSync",
        userAction: "batch work sync",
        metadata: { authMode },
      });

      queueToasts.syncError();
    },
  });
}

export type UseBatchWorkSyncReturn = ReturnType<typeof useBatchWorkSync>;
