import { useRef } from "react";
import { isTerminallyFailedJob } from "../../modules/job-queue/queue-policy";
import { useIntl } from "react-intl";
import {
  acquireWorkJobs,
  reconcileWorkTransaction,
  rememberWorkBroadcast,
  retainedWorkBroadcast,
  forgetWorkBroadcast,
} from "../../modules/work/work-confirmation";
import { classifySendFailure } from "../../modules/work/send-outcome";
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
import { queueToasts, toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import { getEASConfig } from "../../config/blockchain";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { getChain } from "../../config/chains";
import { trackContractError } from "../../modules/app/error-tracking";
import { logger } from "../../modules/app/logger";
import { ensureWagmiWalletChain } from "../../modules/transactions/chain-guard";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { jobQueueEventBus } from "../../modules/job-queue/event-bus";
import { assertLocalArbitrumForkWallet } from "../../modules/transactions/local-fork-safety";
import type { Address } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { TX_RECEIPT_TIMEOUT_MS } from "../../utils/blockchain/polling";
import { buildBatchWorkAttestTx } from "../../utils/eas/transaction-builder";
import { convertQueuedHeicMedia } from "../../modules/job-queue/job-media-conversion";
import { buildQueuedWorkDraft, resolveQueuedWorkTitle } from "../../modules/work/queued-work-draft";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useUser } from "../auth/useUser";
import { queueKeys } from "../../config/query-keys/misc";
import { worksKeys } from "../../config/query-keys/work";
import { connectivityStore } from "../../stores/connectivity";

interface BatchWorkSyncResult {
  hash?: `0x${string}`;
  count: number;
  awaitingConfirmation?: boolean;
  confirmationFailed?: boolean;
  /** Some work still holds a HEIC photo that could not convert yet, so it stayed queued. */
  waitingForPhotos?: boolean;
  /** The origin did not confirm the connection, so nothing was claimed or signed. */
  connectionUnconfirmed?: boolean;
  gardens: string[];
}

interface EncodedWorkJob {
  job: Job<WorkJobPayload>;
  gardenAddress: `0x${string}`;
  attestationData: `0x${string}`;
}

/**
 * Send every unsent queued work job in one wallet transaction.
 *
 * Known broadcasts are reconciled before anything is sent again, so a job that
 * already carries a transaction hash never re-enters the batch. The manual
 * "Send all" control and the provider's reconnect path share this function.
 */
export async function syncQueuedWorkBatch(
  primaryAddress: Address,
  chainId: number = DEFAULT_CHAIN_ID,
  assertSession?: () => void | Promise<void>,
  /** `explicit`: the person tapped Send all, so work they declined earlier is included. */
  options: { explicit?: boolean } = {}
): Promise<BatchWorkSyncResult> {
  // A wallet signature on a connection that may drop the send would strand the work.
  if (!(await connectivityStore.confirmOnline()))
    return { count: 0, gardens: [], connectionUnconfirmed: true };
  const jobs = await jobQueue.getJobs(primaryAddress, { kind: "work", synced: false });
  const candidates: Array<{ job: Job<WorkJobPayload> }> = jobs
    .filter(
      (job) =>
        (job.chainId ?? DEFAULT_CHAIN_ID) === chainId &&
        job.userAddress.toLowerCase() === primaryAddress.toLowerCase() &&
        !job.meta?.workTransactionReverted &&
        (options.explicit || !job.meta?.requiresExplicitSend) &&
        (!isTerminallyFailedJob(job) ||
          Boolean((job.payload as WorkJobPayload).uploadCheckpoint?.transactionHash))
    )
    .map((job) => ({ job: job as Job<WorkJobPayload> }));
  const claim = await acquireWorkJobs(candidates.map(({ job }) => job.id));
  if (!claim) return { count: 0, gardens: [], awaitingConfirmation: true };
  try {
    const pendingJobs: typeof candidates = [];
    let awaitingConfirmation = false;
    let confirmationFailed = false;
    let waitingForPhotos = false;
    for (const entry of candidates) {
      const fresh = await jobQueueDB.getJob(entry.job.id);
      if (!fresh || fresh.synced) continue;
      if (fresh.meta?.workTransactionReverted) {
        confirmationFailed = true;
        continue;
      }
      if (
        (fresh.chainId ?? DEFAULT_CHAIN_ID) !== chainId ||
        fresh.userAddress.toLowerCase() !== primaryAddress.toLowerCase()
      )
        continue;
      entry.job = fresh as Job<WorkJobPayload>;
      const payload = fresh.payload as WorkJobPayload;
      if (
        payload.uploadCheckpoint?.broadcast?.kind === "user-operation" ||
        (payload.uploadCheckpoint?.broadcastPending && !payload.uploadCheckpoint.transactionHash)
      ) {
        awaitingConfirmation = true;
        continue;
      }
      const hash = retainedWorkBroadcast(fresh.id) ?? payload.uploadCheckpoint?.transactionHash;
      if (hash) {
        payload.uploadCheckpoint = {
          submittedAt: new Date().toISOString(),
          files: {},
          ...payload.uploadCheckpoint,
          transactionHash: hash,
        };
        fresh.meta = {
          ...fresh.meta,
          submittedTxHash: hash,
          waitingForDependency: true,
          waitingReason: "awaiting-confirmation",
        };
        await jobQueueDB.updateJob(fresh);
        const state =
          fresh.meta?.legacyConfirmation || fresh.meta?.authMode === "passkey"
            ? await (
                await import("../../modules/work/work-confirmation")
              ).reconcileLegacyPasskeyWork(hash, fresh as Job<WorkJobPayload>, chainId)
            : await reconcileWorkTransaction(hash, chainId);
        if (state === "confirmed") {
          if (payload.clientWorkId)
            await jobQueueDB.storeClientWorkIdMapping(payload.clientWorkId, hash, fresh.id);
          await jobQueueDB.markJobSynced(fresh.id, hash);
          await jobQueueDB.deleteJob(fresh.id);
          forgetWorkBroadcast(fresh.id);
          jobQueueEventBus.emit("job:completed", { jobId: fresh.id, job: fresh, txHash: hash });
        } else if (state === "reverted") {
          confirmationFailed = true;
          fresh.meta.workTransactionReverted = true;
          await jobQueueDB.updateJob(fresh);
          await jobQueueDB.markJobTerminalFailed(fresh.id, "work-transaction-reverted");
        } else awaitingConfirmation = true;
      } else if (!isTerminallyFailedJob(fresh)) {
        // A photo still in HEIC has to become a JPEG before anything uploads.
        if ((await convertQueuedHeicMedia(fresh)).status === "ready") pendingJobs.push(entry);
        else waitingForPhotos = true;
      }
    }
    if (pendingJobs.length === 0) {
      return { count: 0, gardens: [], awaitingConfirmation, confirmationFailed, waitingForPhotos };
    }

    const wagmiConfig = getWagmiConfig();
    await ensureWagmiWalletChain(wagmiConfig, chainId);
    const assertOwnership = async () => {
      await claim.assertOwned();
      await assertSession?.();
      const current = await getWalletClient(wagmiConfig, { chainId });
      if (!current?.account)
        throw new Error("Wallet not connected. Please connect your wallet and try again.");
      if (
        current.account.address.toLowerCase() !== primaryAddress.toLowerCase() ||
        (current.chain?.id !== undefined && current.chain.id !== chainId)
      )
        throw new Error("submission-ownership-changed");
      return current;
    };
    const walletClient = await assertOwnership();
    if (!walletClient?.account) {
      throw new Error("Wallet not connected. Please connect your wallet and try again.");
    }

    // The attestation encoder carries the EAS SDK and its ethers closure.
    // Sending only happens online, so load it here rather than statically:
    // the offline shell reaches this module through the provider and the
    // sync bar, and must stay within its precache budget.
    const { encodeWorkData } = await import("../../utils/eas/encoders");
    // Every upload settles before the batch decides anything: an early failure
    // must not release the claim while a sibling is still saving its CIDs.
    const encoded = await Promise.allSettled(
      pendingJobs.map(async ({ job }): Promise<EncodedWorkJob> => {
        await assertOwnership();
        const images = await jobQueueDB.getImagesForJob(job.id);
        const payload = job.payload as WorkJobPayload;
        const title = await resolveQueuedWorkTitle(job, chainId);
        const draft = buildQueuedWorkDraft(
          payload,
          images.map((image) => image.file),
          title
        );

        const attestationData = await encodeWorkData(draft, chainId, {
          clientWorkId: payload.clientWorkId,
          checkpoint: payload.uploadCheckpoint,
          onCheckpoint: async (checkpoint) => {
            // Progress is saved while the claim holds, even if the wallet has
            // since changed: the CIDs are valid whoever sends the work.
            await claim.assertOwned();
            payload.uploadCheckpoint = checkpoint;
            await jobQueueDB.updateJob(job);
            await assertOwnership();
          },
          gardenAddress: payload.gardenAddress,
          authMode: "wallet",
        });

        return {
          job,
          gardenAddress: payload.gardenAddress as `0x${string}`,
          attestationData,
        };
      })
    );
    const failedUpload = encoded.find((result) => result.status === "rejected");
    if (failedUpload) throw (failedUpload as PromiseRejectedResult).reason;
    const encodedJobs = encoded.map(
      (result) => (result as PromiseFulfilledResult<EncodedWorkJob>).value
    );

    const easConfig = getEASConfig(chainId);
    const txParams = buildBatchWorkAttestTx(
      easConfig,
      encodedJobs.map(({ gardenAddress, attestationData }) => ({
        gardenAddress,
        attestationData,
      }))
    );

    await assertLocalArbitrumForkWallet();

    const currentWallet = await assertOwnership();
    for (const { job } of encodedJobs) {
      const payload = job.payload as WorkJobPayload;
      payload.uploadCheckpoint = {
        submittedAt: new Date().toISOString(),
        files: {},
        ...payload.uploadCheckpoint,
        broadcastPending: true,
        broadcastPendingAt: new Date().toISOString(),
      };
      // Sending now, by the person's tap or by an automatic send they allowed.
      const { requiresExplicitSend: _explicit, ...meta } = job.meta ?? {};
      job.meta = meta;
    }
    await jobQueueDB.updateJobs(encodedJobs.map(({ job }) => job));
    await assertOwnership();
    let hash: `0x${string}`;
    try {
      hash = await currentWallet.sendTransaction({
        ...txParams,
        chain: getChain(chainId),
        account: currentWallet.account,
      });
    } catch (error) {
      // The wallet approves and broadcasts in one step, so the intent was
      // recorded before asking. Only a refusal proves nothing was sent.
      const failure = classifySendFailure(error, { intentRecorded: true, broadcastKnown: false });
      if (failure.kind === "not-sent") {
        for (const { job } of encodedJobs) {
          const checkpoint = (job.payload as WorkJobPayload).uploadCheckpoint;
          if (checkpoint) {
            delete checkpoint.broadcastPending;
            delete checkpoint.broadcastPendingAt;
          }
          if (failure.cancelled) job.meta = { ...job.meta, requiresExplicitSend: true };
        }
        await jobQueueDB.updateJobs(encodedJobs.map(({ job }) => job));
      }
      throw error;
    }

    for (const { job } of encodedJobs) {
      rememberWorkBroadcast(job.id, hash);
      const payload = job.payload as WorkJobPayload;
      payload.uploadCheckpoint = {
        submittedAt: new Date().toISOString(),
        files: {},
        ...payload.uploadCheckpoint,
        transactionHash: hash,
        broadcast: { kind: "transaction", hash },
        broadcastPending: false,
      };
      job.meta = {
        ...job.meta,
        submittedTxHash: hash,
        waitingForDependency: true,
        waitingReason: "awaiting-confirmation",
      };
    }
    await jobQueueDB.updateJobs(encodedJobs.map(({ job }) => job));
    let state: "confirmed" | "reverted" | "unresolved" = "unresolved";
    try {
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId,
        timeout: TX_RECEIPT_TIMEOUT_MS,
      });
      state = await reconcileWorkTransaction(hash, chainId, async () => receipt);
    } catch {
      /* The durable queue will check the existing hash. */
    }
    if (state !== "confirmed") {
      for (const { job } of encodedJobs) {
        if (state === "reverted") {
          job.meta = { ...job.meta, workTransactionReverted: true };
          await jobQueueDB.updateJob(job);
          await jobQueueDB.markJobTerminalFailed(job.id, "work-transaction-reverted");
        }
        jobQueueEventBus.emit("job:added", { jobId: job.id, job });
      }
      return {
        hash,
        count: 0,
        gardens: [],
        awaitingConfirmation: state === "unresolved",
        confirmationFailed: state === "reverted",
      };
    }

    for (const { job } of encodedJobs) {
      const payload = job.payload as WorkJobPayload;
      if (payload.clientWorkId)
        await jobQueueDB.storeClientWorkIdMapping(payload.clientWorkId, hash, job.id);
      await jobQueueDB.markJobSynced(job.id, hash);
      forgetWorkBroadcast(job.id);

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
      waitingForPhotos,
    };
  } finally {
    await claim.release();
  }
}

/**
 * Sync all queued work for wallet users in a single transaction.
 */
export function useBatchWorkSync() {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();
  const { authMode } = useUser();
  const chainId = DEFAULT_CHAIN_ID;
  const identity = `${authMode}:${primaryAddress?.toLowerCase()}:${chainId}`;
  const session = useRef({ identity, generation: 0 });
  if (session.current.identity !== identity)
    session.current = { identity, generation: session.current.generation + 1 };

  return useMutation({
    mutationFn: async (): Promise<BatchWorkSyncResult> => {
      if (authMode !== "wallet") {
        throw new Error("Batch work sync is only available in wallet mode.");
      }
      if (!primaryAddress) {
        throw new Error("Wallet address not available. Please reconnect and try again.");
      }

      const generation = session.current.generation;
      return syncQueuedWorkBatch(
        primaryAddress,
        chainId,
        () => {
          if (generation !== session.current.generation || identity !== session.current.identity)
            throw new Error("submission-ownership-changed");
        },
        { explicit: true }
      );
    },
    onSuccess: ({
      count,
      gardens,
      awaitingConfirmation,
      confirmationFailed,
      waitingForPhotos,
      connectionUnconfirmed,
    }) => {
      if (connectionUnconfirmed) {
        toastService.info({
          title: intl.formatMessage({ id: "app.offline.degraded" }),
          message: intl.formatMessage({ id: "app.work.connectionUnconfirmed" }),
          context: "work",
        });
        return;
      }
      if (awaitingConfirmation || confirmationFailed) {
        toastService.info({
          title: intl.formatMessage({
            id: confirmationFailed
              ? "app.work.confirmationFailed"
              : "app.work.awaitingConfirmation",
          }),
          context: "work",
        });
      } else if (count === 0 && waitingForPhotos) {
        toastService.info({
          title: intl.formatMessage({ id: "app.work.photosStillConverting" }),
          context: "work",
        });
      } else if (count === 0) {
        queueToasts.queueClear();
      } else {
        queueToasts.syncSuccess(count);
      }

      queryClient.invalidateQueries({ queryKey: queueKeys.pendingCount() });
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() });
      queryClient.invalidateQueries({ queryKey: queueKeys.uploading() });
      queryClient.invalidateQueries({ queryKey: worksKeys.all });

      if (primaryAddress) {
        queryClient.invalidateQueries({
          queryKey: worksKeys.mineByUser(primaryAddress),
          exact: false,
        });
      }

      for (const gardenAddress of gardens) {
        queryClient.invalidateQueries({
          queryKey: worksKeys.online(gardenAddress, chainId),
        });
        queryClient.invalidateQueries({
          queryKey: worksKeys.merged(gardenAddress, chainId),
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
