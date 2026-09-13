import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { ZERO_ADDRESS } from "../../utils/blockchain/address-constants";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { getWorkApprovals, getWorks } from "../../modules/data/eas";
import { useSendingWorkIds } from "./useSendingWorkIds";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import {
  carryOverlayMarkers,
  type IndexedWorkStatus,
  type OverlayWork,
  resolveWorkStatus,
} from "../../modules/work/local-status-overlay";
import type { Work, WorkCard, WorkDisplayStatus } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { useOnlineStatus, reportConnectivityFailure } from "../app/useOnlineStatus";
import { extractClientWorkId } from "../../utils/work/deduplication";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { queueKeys } from "../../config/query-keys/misc";
import { worksKeys } from "../../config/query-keys/work";
import {
  getOfflineContentSnapshot,
  subscribeOfflineContent,
} from "../../modules/offline-content/store";
import { gardenPreparationKey } from "../../modules/offline-content/types";
export { usePendingWorksCount } from "./usePendingWorksCount";

type ApprovalsByWork = Map<string, EASWorkApproval>;

function indexedStatusFor(work: WorkCard, approvals: ApprovalsByWork | null): IndexedWorkStatus {
  if (approvals === null) return null;
  const approval = approvals.get(work.id);
  if (!approval) return "pending";
  return approval.approved ? "approved" : "rejected";
}

/**
 * Resolve one indexed row against the local overlay. The overlay's markers
 * travel with the row while it still covers indexer lag, so the next refetch
 * recognises the decision instead of falling back to pending.
 */
function withResolvedStatus(
  work: WorkCard,
  approvals: ApprovalsByWork | null,
  cached: OverlayWork | undefined,
  now: number
): OverlayWork {
  const indexedStatus = indexedStatusFor(work, approvals);
  return {
    ...work,
    status: resolveWorkStatus(indexedStatus, cached, now),
    ...carryOverlayMarkers(cached, indexedStatus, now),
  };
}

/**
 * Keep cached rows the indexer failed to return this cycle, so an empty or
 * partial read cannot wipe a collection the steward is looking at.
 */
function reconcileIndexedWorkCollection(
  indexedWorks: WorkCard[],
  cachedWorks: OverlayWork[]
): WorkCard[] {
  if (cachedWorks.length === 0) return indexedWorks;

  const indexedIds = new Set(indexedWorks.map((work) => work.id));
  const isIncomplete = cachedWorks.some((work) => !indexedIds.has(work.id));
  if (!isIncomplete) return indexedWorks;

  const reconciled = new Map(cachedWorks.map((work) => [work.id, work as WorkCard]));
  indexedWorks.forEach((work) => reconciled.set(work.id, work));
  return Array.from(reconciled.values());
}

/** Options for the useWorks hook */
export interface UseWorksOptions {
  /**
   * Enable offline job queue integration.
   * When true, merges online works with pending offline jobs.
   * @default false
   */
  offline?: boolean;
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
      submissionState:
        job.meta?.workTransactionReverted || job.payload.uploadCheckpoint?.transactionReverted
          ? "reverted"
          : job.payload.uploadCheckpoint?.broadcast || job.payload.uploadCheckpoint?.transactionHash
            ? "awaiting-confirmation"
            : job.payload.uploadCheckpoint?.broadcastPending
              ? "checking-submission"
              : job.lastError
                ? "retry-required"
                : "queued",
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
  const downloads = useSyncExternalStore(
    subscribeOfflineContent,
    getOfflineContentSnapshot,
    getOfflineContentSnapshot
  );
  const coverage = primaryAddress
    ? downloads.gardens[gardenPreparationKey(gardenId, chainId, primaryAddress)]
    : undefined;
  const projectionKey = offline
    ? worksKeys.local(gardenId, chainId, primaryAddress ?? undefined)
    : worksKeys.merged(gardenId, chainId);
  const online = useQuery({
    queryKey: worksKeys.online(gardenId, chainId),
    queryFn: async () => {
      try {
        return await getWorks(gardenId, chainId);
      } catch (error) {
        void reportConnectivityFailure();
        throw error;
      }
    },
    enabled: !!gardenId,
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  const approvals = useQuery({
    queryKey: worksKeys.approvals(undefined, chainId),
    queryFn: () => getWorkApprovals(undefined, chainId),
    enabled: !!gardenId,
    networkMode: "online",
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });
  const prepared = useQuery<WorkCard[]>({
    queryKey: worksKeys.preparedRecent(gardenId, chainId),
    enabled: false,
  });
  const preparedApprovals = useQuery<EASWorkApproval[]>({
    queryKey: worksKeys.preparedApprovals(gardenId, chainId),
    enabled: false,
  });
  const remoteData = online.data ?? (offline ? prepared.data : undefined);
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
    enabled: false,
  });
  const projection = useQuery<OverlayWork[]>({ queryKey: projectionKey, enabled: false });
  const queuedJobs = offline ? (queued.data ?? NO_QUEUED_JOBS) : NO_QUEUED_JOBS;
  const queuedPreviews = useQueuedWorkPreviews(queuedJobs);
  const metadataQueries = useQueries({
    queries: (remoteData ?? []).map((work) => ({
      queryKey: worksKeys.metadata(work.metadata.trim()),
      enabled: false,
    })),
  });
  const works = useMemo(() => {
    const metadataByKey = new Map(
      (remoteData ?? []).map((work, index) => [
        work.metadata.trim(),
        metadataQueries[index]?.data as { clientWorkId?: string } | undefined,
      ])
    );
    const cachedWorks = (projection.data ?? overlay.data ?? []).filter(
      (work) =>
        !["syncing", "sync_failed", "offline", "uploading"].includes(work.status) &&
        !work.id.startsWith("0xoffline_")
    );
    const cachedMap = new Map(cachedWorks.map((work) => [work.id, work]));
    for (const work of overlay.data ?? []) {
      if (
        !["syncing", "sync_failed", "offline", "uploading"].includes(work.status) &&
        !work.id.startsWith("0xoffline_")
      )
        cachedMap.set(work.id, work);
    }
    const indexed = offline
      ? (remoteData ?? cachedWorks)
      : reconcileIndexedWorkCollection(online.data ?? [], cachedWorks);
    const globalApprovalsKnown = approvals.data !== undefined && !approvals.isError;
    const preparedIds = new Set(
      offline && preparedApprovals.data !== undefined ? prepared.data?.map((work) => work.id) : []
    );
    const knownApprovals = new Map(
      [...(offline ? (preparedApprovals.data ?? []) : []), ...(approvals.data ?? [])]
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        .map((approval) => [approval.workUID, approval])
    );
    const now = Date.now();
    const rows: Work[] = indexed.map((work) =>
      withResolvedStatus(
        work,
        globalApprovalsKnown || preparedIds.has(work.id) ? knownApprovals : null,
        cachedMap.get(work.id) ?? (work as OverlayWork),
        now
      )
    );
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
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [
    online.data,
    remoteData,
    prepared.data,
    preparedApprovals.data,
    approvals.data,
    approvals.isError,
    projection.data,
    overlay.data,
    queuedJobs,
    queuedPreviews,
    offline,
    queryClient,
    metadataQueries,
    sendingJobs,
    isOnline,
  ]);

  useEffect(() => {
    if (remoteData !== undefined) {
      // Persist remote status overlays only; local object URLs and queued work
      // are reconstructed from the durable queue after each restore.
      const remoteIds = new Set(remoteData.map((work) => work.id));
      const records = works.filter((work) => !offline || remoteIds.has(work.id));
      if (JSON.stringify(queryClient.getQueryData(projectionKey)) !== JSON.stringify(records)) {
        queryClient.setQueryData(projectionKey, records);
      }
    }
  }, [remoteData, works, queryClient, projectionKey, offline]);

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
        void queryClient.invalidateQueries({ queryKey: worksKeys.approvals(undefined, chainId) });
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
      : offline && coverage?.state === "partial"
        ? "partial"
        : "available"
    : works.length > 0
      ? "partial"
      : "unavailable";
  return {
    works,
    availability,
    lastSuccessfulRefresh:
      online.dataUpdatedAt || (offline ? prepared.dataUpdatedAt : 0) || undefined,
    truncated: online.data !== undefined ? false : coverage?.truncated,
    fetchStatus: online.fetchStatus,
    isPaused: !isOnline || online.isPaused,
    isLoading: isOnline && online.isPending && works.length === 0,
    isFetching: isOnline && online.isFetching,
    isError: online.isError || (offline && queued.isError),
    refreshWarning: hasRemote && (online.isError || approvals.isError),
    error: online.error || (offline ? queued.error : null),
    offlineCount: queuedJobs.length,
    onlineCount: remoteData?.length ?? 0,
    refetch: () => {
      if (isOnline) {
        void online.refetch();
        void approvals.refetch();
      }
      if (offline) void queued.refetch();
    },
  };
}

/**
 * Hook for getting queue statistics with event-driven updates
 * Scoped to the current authenticated primary address
 */
export function useQueueStatistics() {
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();

  const query = useQuery({
    queryKey: queueKeys.stats(),
    queryFn: async () => {
      // Only get stats for the current user
      if (!primaryAddress) {
        return { total: 0, pending: 0, failed: 0, synced: 0 };
      }
      return jobQueue.getStats(primaryAddress);
    },
    enabled: !!primaryAddress,
    staleTime: STALE_TIMES.queue,
    gcTime: GC_TIMES.queue,
  });

  // Listen to events to update stats
  useJobQueueEvents(
    ["job:added", "job:processing", "job:completed", "job:failed", "queue:sync-completed"],
    () => {
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() });
    }
  );

  return query;
}
