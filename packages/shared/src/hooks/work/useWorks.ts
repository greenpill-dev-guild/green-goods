import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import { type OverlayWork, resolveGardenWorkRows } from "../../modules/work/local-status-overlay";
import { queuedUploadStatus } from "../../modules/work/upload-state";
import { WORK_LIST_PAGE_SIZE } from "../../modules/work/work-list";
import type { Work, WorkDisplayStatus } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { ZERO_ADDRESS } from "../../utils/blockchain/address-constants";
import { extractClientWorkId } from "../../utils/work/deduplication";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useLiveQuery } from "../utils/useLiveQuery";
import { gardenWorkListQuery } from "./gardenWorkListQuery";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { useSendingWorkIds } from "./useSendingWorkIds";

export { usePendingWorksCount } from "./usePendingWorksCount";

/** Options for the useWorks hook */
export interface UseWorksOptions {
  /**
   * Enable offline job queue integration.
   * When true, merges online works with pending offline jobs.
   * @default false
   */
  offline?: boolean;
}

/**
 * Where a queued work stands, as the work card and dashboard read it: sent
 * and confirming, or waiting for Upload all, with the reason when the chain
 * would refuse it.
 */
function queuedSubmissionState(job: Job<WorkJobPayload>): {
  submissionState: string;
  blockedReason?: string;
} {
  const upload = queuedUploadStatus(job);
  switch (upload.state) {
    case "sent": {
      const checkpoint = job.payload.uploadCheckpoint;
      return {
        submissionState:
          checkpoint?.broadcast || checkpoint?.transactionHash
            ? "awaiting-confirmation"
            : "checking-submission",
      };
    }
    case "failed":
      return { submissionState: "retry-required" };
    case "blocked":
      return { submissionState: "blocked", blockedReason: upload.reason };
    default:
      return { submissionState: upload.state };
  }
}

// Helper function to convert job payload to Work model
export function jobToWork(job: Job<WorkJobPayload>): Work {
  const checkpoint = job.payload.uploadCheckpoint;
  const awaiting = Boolean(
    checkpoint?.broadcast || checkpoint?.transactionHash || checkpoint?.broadcastPending
  );
  const failed = Boolean(
    job.meta?.workTransactionReverted ||
      checkpoint?.transactionReverted ||
      (job.lastError && !awaiting)
  );
  return {
    id: job.id, // Use job ID as temporary work ID
    title: job.payload.title || `Action ${job.payload.actionUID}`,
    actionUID: job.payload.actionUID,
    gardenerAddress: job.userAddress ?? ZERO_ADDRESS, // Unresolved offline; hydration overwrites with the active address
    gardenAddress: job.payload.gardenAddress,
    feedback: job.payload.feedback,
    metadata: JSON.stringify({
      clientWorkId: job.payload.clientWorkId,
      ...queuedSubmissionState(job),
      details: job.payload.details,
      timeSpentMinutes: job.payload.timeSpentMinutes,
      tags: job.payload.tags,
    }),
    media: [], // Media will be loaded separately for offline jobs
    createdAt: Math.floor(job.createdAt / 1000), // Convert ms (Date.now()) to seconds (EAS format)
    status: (job.synced
      ? "pending" // Synced but awaiting on-chain approval
      : failed
        ? "sync_failed" // Failed to sync to chain
        : "offline") as WorkDisplayStatus, // Admitted locally; a processing event confirms actual sending
  };
}

/** Availability describes local data, independently from a remote refresh. */
export type WorkAvailability = "available" | "partial" | "unavailable" | "empty";
const NO_QUEUED_JOBS: Job<WorkJobPayload>[] = [];

export function useWorks(gardenId: string, options: UseWorksOptions = {}) {
  const { offline = false } = options;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();
  const isOnline = useOnlineStatus();
  const sendingJobs = useSendingWorkIds(primaryAddress, chainId);
  const projectionKey = offline
    ? worksKeys.local(gardenId, chainId, primaryAddress ?? undefined)
    : worksKeys.merged(gardenId, chainId);
  // Every observer of this garden shares one window. Keeping it in query state
  // prevents a second mounted screen from refetching the same key with a
  // smaller component-local ref.
  const windowKey = useMemo(() => worksKeys.window(gardenId, chainId), [gardenId, chainId]);
  const listWindow = useQuery<number>({
    queryKey: windowKey,
    queryFn: () => queryClient.getQueryData<number>(windowKey) ?? WORK_LIST_PAGE_SIZE,
    initialData: WORK_LIST_PAGE_SIZE,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const take = listWindow.data;
  const online = useQuery(gardenWorkListQuery(queryClient, gardenId, chainId));
  // Offline, the restored screen read is the downloaded copy: background
  // preparation fills this same query, so there is no second source to consult.
  const remoteData = online.data?.slice(0, take);
  const hasOlderWork = (online.data?.length ?? 0) > take;
  const loadOlderWork = useCallback(() => {
    if (!isOnline) return;
    queryClient.setQueryData<number>(
      windowKey,
      (current) => Math.max(current ?? WORK_LIST_PAGE_SIZE, take) + WORK_LIST_PAGE_SIZE
    );
    void queryClient.refetchQueries({ queryKey: worksKeys.online(gardenId, chainId), exact: true });
  }, [chainId, gardenId, isOnline, queryClient, take, windowKey]);
  const queued = useQuery({
    queryKey: worksKeys.offline(gardenId, chainId, primaryAddress ?? undefined),
    queryFn: async () => {
      if (!primaryAddress) return NO_QUEUED_JOBS;
      const jobs = await jobQueue.getJobs(primaryAddress, { kind: "work", synced: false });
      return jobs.filter(
        (job) =>
          (job.chainId ?? DEFAULT_CHAIN_ID) === chainId &&
          job.userAddress?.toLowerCase() === primaryAddress.toLowerCase() &&
          (job.payload as WorkJobPayload).gardenAddress.toLowerCase() === gardenId.toLowerCase()
      ) as Job<WorkJobPayload>[];
    },
    enabled: offline && !!gardenId && !!primaryAddress,
    networkMode: "always",
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });
  // Observe approval overlays written by existing consumers. PWA queued rows
  // are kept under an account/chain key and never restored from legacy merges.
  const overlay = useQuery<OverlayWork[]>({
    queryKey: worksKeys.merged(gardenId, chainId),
    queryFn: () =>
      queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId, chainId)) ?? [],
    enabled: false,
  });
  const projection = useQuery<OverlayWork[]>({
    queryKey: projectionKey,
    queryFn: () => queryClient.getQueryData<OverlayWork[]>(projectionKey) ?? [],
    enabled: false,
  });
  const queuedJobs = offline ? (queued.data ?? NO_QUEUED_JOBS) : NO_QUEUED_JOBS;
  const queuedPreviews = useQueuedWorkPreviews(queuedJobs);
  // `combine` keeps one array identity until a metadata read actually changes;
  // without it every render rebuilt the list and re-rendered each work card.
  const metadataByWork = useQueries({
    queries: (remoteData ?? []).map((work) => ({
      queryKey: worksKeys.metadata(work.metadata.trim()),
      enabled: false,
    })),
    combine: (results) =>
      results.map((result) => result.data as { clientWorkId?: string } | undefined),
  });
  const { works, unknownIds } = useMemo(() => {
    const metadataByKey = new Map(
      (remoteData ?? []).map((work, index) => [work.metadata.trim(), metadataByWork[index]])
    );
    // The approval stays in the stored read and leaves the projected row, whose
    // status already carries it.
    const resolved = resolveGardenWorkRows({
      remote: remoteData,
      saved: projection.data ?? overlay.data,
      overlay: overlay.data,
    });
    const rows: Work[] = resolved.rows;
    // Identity must agree on submitter and clientWorkId. A CID whose metadata
    // has not been downloaded cannot prove a match, so retain the local work.
    const identities = new Set(
      rows.flatMap((work) => {
        const metadata =
          metadataByKey.get(work.metadata.trim()) ??
          queryClient.getQueryData<{ clientWorkId?: string }>(
            worksKeys.metadata(work.metadata.trim())
          );
        const id = extractClientWorkId(work.metadata) ?? metadata?.clientWorkId;
        return id ? [`${work.gardenerAddress.toLowerCase()}:${id}`] : [];
      })
    );
    for (const job of queuedJobs) {
      const identity =
        job.payload.clientWorkId && `${job.userAddress.toLowerCase()}:${job.payload.clientWorkId}`;
      if (identity && identities.has(identity)) continue;
      if (rows.some((work) => work.id === job.id)) continue;
      const work = jobToWork(job);
      if (isOnline && sendingJobs.has(job.id) && work.status === "offline") {
        work.status = "uploading";
        work.metadata = JSON.stringify({
          ...JSON.parse(work.metadata),
          submissionState: "sending",
        });
      }
      rows.push(
        queuedPreviews.has(job.id) ? { ...work, media: queuedPreviews.get(job.id)! } : work
      );
    }
    return {
      works: rows.sort((a, b) => b.createdAt - a.createdAt),
      unknownIds: resolved.unknownIds,
    };
  }, [
    remoteData,
    projection.data,
    overlay.data,
    queuedJobs,
    queuedPreviews,
    queryClient,
    metadataByWork,
    sendingJobs,
    isOnline,
  ]);

  useEffect(() => {
    if (remoteData !== undefined) {
      // Persist remote status overlays only; local object URLs and queued work
      // are reconstructed from the durable queue after each restore.
      const remoteIds = new Set(remoteData.map((work) => work.id));
      // A row whose approvals could not be read is shown but never saved: a saved
      // row reads as a settled status to every screen that restores it.
      const records = works.filter(
        (work) => !unknownIds.has(work.id) && (!offline || remoteIds.has(work.id))
      );
      if (JSON.stringify(queryClient.getQueryData(projectionKey)) !== JSON.stringify(records)) {
        queryClient.setQueryData(projectionKey, records);
      }
    }
  }, [remoteData, works, unknownIds, queryClient, projectionKey, offline]);

  // Existing approval consumers invalidate the public merged key. Preserve
  // that contract while keeping remote reads separate from local projection.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "invalidate") return;
        if (
          JSON.stringify(event.query.queryKey) !==
          JSON.stringify(worksKeys.merged(gardenId, chainId))
        )
          return;
        void queryClient.invalidateQueries({ queryKey: worksKeys.online(gardenId, chainId) });
      }),
    [queryClient, gardenId, chainId]
  );

  useJobQueueEvents(
    ["job:added", "job:processing", "job:completed", "job:failed", "queue:sync-completed"],
    (event, data) => {
      if (!offline) return;
      if ("job" in data && data.job.kind !== "work") return;
      void queryClient.invalidateQueries({
        queryKey: worksKeys.offline(gardenId, chainId, primaryAddress ?? undefined),
      });
      if (event === "job:completed")
        void queryClient.invalidateQueries({ queryKey: worksKeys.online(gardenId, chainId) });
    }
  );
  const hasRemote = remoteData !== undefined || (projection.data?.length ?? 0) > 0;
  const availability: WorkAvailability = hasRemote
    ? works.length === 0
      ? "empty"
      : "available"
    : works.length > 0
      ? "partial"
      : "unavailable";
  return {
    works,
    availability,
    lastSuccessfulRefresh: online.dataUpdatedAt || undefined,
    fetchStatus: online.fetchStatus,
    isPaused: !isOnline || online.isPaused,
    isLoading: isOnline && online.isPending && works.length === 0,
    /** Local queued work may still be loading after the garden read settles. */
    queuedLoading: offline && queued.isPending && works.length === 0,
    isFetching: isOnline && online.isFetching,
    isError: online.isError || (offline && queued.isError),
    refreshWarning:
      hasRemote &&
      (online.isError || (remoteData?.some((row) => row.approval === undefined) ?? false)),
    error: online.error || (offline ? queued.error : null),
    offlineCount: queuedJobs.length,
    onlineCount: remoteData?.length ?? 0,
    /** Whether the garden may have work older than the loaded window. */
    hasOlderWork,
    /** Widen the window by one page and read it; a no-op offline. */
    loadOlderWork,
    isLoadingOlder: online.isFetching && take > WORK_LIST_PAGE_SIZE,
    refetch: () => {
      if (isOnline) void online.refetch();
      if (offline) void queued.refetch();
    },
  };
}

/**
 * Queue statistics for the current primary address as a live view of the
 * queue table: every write, in this tab or another, re-emits them.
 */
export function useQueueStatistics() {
  const primaryAddress = usePrimaryAddress();
  return useLiveQuery(primaryAddress?.toLowerCase() ?? null, () =>
    jobQueueDB.observeStats(primaryAddress ?? "")
  );
}
