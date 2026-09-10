import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { ZERO_ADDRESS } from "../../utils/blockchain/address-constants";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { logger } from "../../modules/app/logger";
import { getWorkApprovals, getWorks } from "../../modules/data/eas";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { jobQueueEventBus, useJobQueueEvents } from "../../modules/job-queue/event-bus";
import {
  carryOverlayMarkers,
  type IndexedWorkStatus,
  type OverlayWork,
  resolveWorkStatus,
} from "../../modules/work/local-status-overlay";
import type { Work, WorkCard, WorkDisplayStatus } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { useMerged } from "../app/useMerged";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { queueKeys } from "../../config/query-keys/misc";
import { worksKeys } from "../../config/query-keys/work";
export { usePendingWorksCount } from "./usePendingWorksCount";

// Throttle approval-fetch warnings to avoid console spam (at most once per 10s)
let _lastApprovalWarnAt = 0;
function warnApprovalFetchOnce(error: unknown) {
  const now = Date.now();
  if (now - _lastApprovalWarnAt > 10_000) {
    _lastApprovalWarnAt = now;
    logger.warn("Failed to fetch approvals, status may be stale", { source: "useWorks", error });
  }
}

type ApprovalsByWork = Map<string, EASWorkApproval>;

/**
 * Read the approvals the status computation depends on.
 *
 * Returns `null` when the read failed. "No approval exists" and "approvals
 * unavailable" must stay distinct: collapsing them turned every reviewed work
 * back to pending whenever one request failed.
 */
async function readApprovalsByWork(chainId: number): Promise<ApprovalsByWork | null> {
  try {
    const approvals = await getWorkApprovals(undefined, chainId);
    return new Map(approvals.map((approval) => [approval.workUID, approval]));
  } catch (error) {
    warnApprovalFetchOnce(error);
    return null;
  }
}

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
  return {
    id: job.id, // Use job ID as temporary work ID
    title: job.payload.title || `Action ${job.payload.actionUID}`,
    actionUID: job.payload.actionUID,
    gardenerAddress: ZERO_ADDRESS, // Unresolved offline; hydration overwrites with the active address
    gardenAddress: job.payload.gardenAddress,
    feedback: job.payload.feedback,
    metadata: JSON.stringify({
      submissionState: job.meta?.workTransactionReverted
        ? "reverted"
        : job.payload.uploadCheckpoint?.transactionHash
          ? "awaiting-confirmation"
          : undefined,
      details: job.payload.details,
      timeSpentMinutes: job.payload.timeSpentMinutes,
      tags: job.payload.tags,
    }),
    media: [], // Media will be loaded separately for offline jobs
    createdAt: Math.floor(job.createdAt / 1000), // Convert ms (Date.now()) to seconds (EAS format)
    status: (job.synced
      ? "pending" // Synced but awaiting on-chain approval
      : job.lastError
        ? "sync_failed" // Failed to sync to chain
        : "syncing") as WorkDisplayStatus, // Waiting to sync
  };
}

/**
 * Compute work status from approvals, honouring local decisions that still
 * cover indexer lag.
 */
async function computeWorksWithStatus(
  works: WorkCard[],
  chainId: number,
  queryClient: ReturnType<typeof useQueryClient>,
  gardenId: string
): Promise<Work[]> {
  const approvals = await readApprovalsByWork(chainId);
  const cachedWorks =
    queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId, chainId)) ?? [];
  const cachedMap = new Map(cachedWorks.map((work) => [work.id, work]));
  const now = Date.now();

  return reconcileIndexedWorkCollection(works, cachedWorks).map((work) =>
    withResolvedStatus(work, approvals, cachedMap.get(work.id), now)
  );
}

/**
 * Hook for fetching works with optional offline support.
 *
 * @param gardenId - The garden address to fetch works for
 * @param options - Configuration options
 * @param options.offline - Enable offline job queue integration (default: false)
 *
 * @example
 * // Admin dashboard (online only)
 * const { works, isLoading } = useWorks(gardenId);
 *
 * @example
 * // Client PWA (with offline support)
 * const { works, isLoading, offlineCount } = useWorks(gardenId, { offline: true });
 */
const NO_QUEUED_JOBS: Job[] = [];

export function useWorks(gardenId: string, options: UseWorksOptions = {}) {
  const { offline = false } = options;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const primaryAddress = usePrimaryAddress();
  const mergedWorksKey = worksKeys.merged(gardenId, chainId);
  const onlineOnlyQueryKey = offline
    ? ([...mergedWorksKey, "online-only-disabled"] as const)
    : mergedWorksKey;
  const offlineMergedQueryKey = offline
    ? mergedWorksKey
    : ([...mergedWorksKey, "offline-merge-disabled"] as const);

  // ─────────────────────────────────────────────────────────────────────────
  // Online-only mode: Simple query without offline job queue integration
  // ─────────────────────────────────────────────────────────────────────────
  const onlineOnlyQuery = useQuery({
    queryKey: onlineOnlyQueryKey,
    queryFn: async () => {
      const onlineWorks = await getWorks(gardenId, chainId);
      return computeWorksWithStatus(onlineWorks, chainId, queryClient, gardenId);
    },
    enabled: !offline && !!gardenId,
    staleTime: STALE_TIMES.works,
    gcTime: GC_TIMES.works,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Offline mode: Merged online + offline with job queue integration
  // ─────────────────────────────────────────────────────────────────────────
  const merged = useMerged<WorkCard[], Job<WorkJobPayload>[], Work[]>({
    onlineKey: worksKeys.online(gardenId, chainId),
    offlineKey: worksKeys.offline(gardenId),
    mergedKey: offlineMergedQueryKey,
    enabled: offline && !!gardenId,
    fetchOnline: () => getWorks(gardenId, chainId),
    fetchOffline: async () => {
      if (!primaryAddress) return [];
      const jobs = await jobQueue.getJobs(primaryAddress, { kind: "work", synced: false });
      return jobs.filter(
        (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
      ) as Job<WorkJobPayload>[];
    },
    staleTimeOnline: STALE_TIMES.works,
    gcTimeOnline: GC_TIMES.works,
    gcTimeMerged: GC_TIMES.works,
    staleTimeMerged: STALE_TIMES.merged,
    merge: async (onlineWorks, offlineJobs) => {
      const safeOnlineWorks = onlineWorks ?? [];
      const safeOfflineJobs = offlineJobs ?? [];

      const approvals = await readApprovalsByWork(chainId);

      // Preserve local decisions that are still covering indexer lag
      const cachedWorks =
        queryClient.getQueryData<OverlayWork[]>(worksKeys.merged(gardenId, chainId)) ?? [];
      const cachedMap = new Map(cachedWorks.map((work) => [work.id, work]));
      const now = Date.now();

      // Convert offline jobs to Work models
      const offlineWorks = await Promise.all(
        safeOfflineJobs.map(async (job) => {
          const work = jobToWork(job as Job<WorkJobPayload>);
          if (primaryAddress) {
            work.gardenerAddress = primaryAddress;
          }
          return work;
        })
      );

      // Build work map with computed status
      const workMap = new Map<string, Work>();
      safeOnlineWorks.forEach((work) => {
        workMap.set(work.id, withResolvedStatus(work, approvals, cachedMap.get(work.id), now));
      });

      // Deduplicate offline works against online
      const onlineTimestampsByAction = new Map<number, number[]>();
      safeOnlineWorks.forEach((work) => {
        const timestamps = onlineTimestampsByAction.get(work.actionUID) ?? [];
        timestamps.push(work.createdAt);
        onlineTimestampsByAction.set(work.actionUID, timestamps);
      });

      const DUPLICATE_TIME_WINDOW_MS = 5 * 60 * 1000;

      offlineWorks.forEach((work) => {
        const onlineTimestamps = onlineTimestampsByAction.get(work.actionUID);
        const isDuplicate = onlineTimestamps?.some(
          (timestamp) => Math.abs(timestamp - work.createdAt) < DUPLICATE_TIME_WINDOW_MS
        );
        if (!isDuplicate) {
          workMap.set(work.id, work);
        }
      });

      return Array.from(workMap.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    events: [
      {
        subscribe: (listener: () => void) =>
          jobQueueEventBus.onMultiple(
            ["job:added", "job:completed", "job:failed"],
            (_type, data) => {
              if ("job" in data && data.job.kind === "work") {
                const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
                if (jobGardenId === gardenId) listener();
              }
            }
          ),
      },
    ],
  });

  const queuedPreviews = useQueuedWorkPreviews(
    offline ? (merged.offline.data ?? NO_QUEUED_JOBS) : NO_QUEUED_JOBS
  );

  // Job queue event subscription for offline mode
  useJobQueueEvents(["job:completed"], (_eventType, data) => {
    if (offline && "job" in data && data.job.kind === "work") {
      const jobGardenId = (data.job.payload as WorkJobPayload).gardenAddress;
      if (jobGardenId === gardenId) {
        queryClient.invalidateQueries({ queryKey: worksKeys.online(gardenId, chainId) });
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Return appropriate data based on mode
  // ─────────────────────────────────────────────────────────────────────────
  if (offline) {
    return {
      works: ((merged.merged.data ?? []) as Work[]).map((work) =>
        queuedPreviews.has(work.id) ? { ...work, media: queuedPreviews.get(work.id)! } : work
      ),
      isLoading: merged.merged.isLoading,
      isFetching: merged.online.isFetching || merged.merged.isFetching,
      isError: merged.online.isError || merged.merged.isError,
      error: merged.online.error || merged.merged.error,
      offlineCount: (merged.offline.data ?? []).length,
      onlineCount: (merged.online.data ?? []).length,
      refetch: () => {
        merged.online.refetch();
        merged.offline.refetch();
        merged.merged.refetch();
      },
    };
  }

  return {
    works: (onlineOnlyQuery.data ?? []) as Work[],
    isLoading: onlineOnlyQuery.isLoading,
    isFetching: onlineOnlyQuery.isFetching,
    isError: onlineOnlyQuery.isError,
    error: onlineOnlyQuery.error,
    offlineCount: 0,
    onlineCount: (onlineOnlyQuery.data ?? []).length,
    refetch: () => {
      onlineOnlyQuery.refetch();
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
  useJobQueueEvents(["job:added", "job:completed", "job:failed", "queue:sync-completed"], () => {
    queryClient.invalidateQueries({ queryKey: queueKeys.stats() });
  });

  return query;
}
