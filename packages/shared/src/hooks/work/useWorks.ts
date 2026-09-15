import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { worksKeys } from "../../config/query-keys/work";
import { GC_TIMES, STALE_TIMES } from "../../config/react-query";
import { jobQueueDB } from "../../modules/job-queue/db";
import { jobQueue } from "../../modules/job-queue/default-instance";
import { useJobQueueEvents } from "../../modules/job-queue/event-bus";
import {
  carryOverlayMarkers,
  type IndexedWorkStatus,
  type OverlayWork,
  resolveWorkStatus,
} from "../../modules/work/local-status-overlay";
import { readWorkList, WORK_LIST_PAGE_SIZE } from "../../modules/work/work-list";
import type { Work, WorkCard, WorkDisplayStatus } from "../../types/domain";
import type { EASWorkApproval, EASWorkListRow } from "../../types/eas-responses";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { ZERO_ADDRESS } from "../../utils/blockchain/address-constants";
import { extractClientWorkId } from "../../utils/work/deduplication";
import { reportConnectivityFailure, useOnlineStatus } from "../app/useOnlineStatus";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useLiveQuery } from "../utils/useLiveQuery";
import { useQueuedWorkPreviews } from "./useQueuedWorkPreviews";
import { useSendingWorkIds } from "./useSendingWorkIds";

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
  const projectionKey = offline
    ? worksKeys.local(gardenId, chainId, primaryAddress ?? undefined)
    : worksKeys.merged(gardenId, chainId);
  // The screen reads the newest page and widens its window when asked for older
  // work. The window lives beside the query so a background refresh of the same
  // key never shrinks what the person already scrolled to.
  const [listWindow, setListWindow] = useState({ gardenId, take: WORK_LIST_PAGE_SIZE });
  const take = listWindow.gardenId === gardenId ? listWindow.take : WORK_LIST_PAGE_SIZE;
  const takeRef = useRef(take);
  takeRef.current = take;
  const online = useQuery({
    queryKey: worksKeys.online(gardenId, chainId),
    queryFn: async () => {
      try {
        const cached = queryClient.getQueryData<EASWorkListRow[]>(
          worksKeys.online(gardenId, chainId)
        );
        return await readWorkList({
          garden: gardenId,
          chainId,
          take: Math.max(takeRef.current, cached?.length ?? 0),
        });
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
  // Offline, the restored screen read is the downloaded copy: background
  // preparation fills this same query, so there is no second source to consult.
  const remoteData = online.data;
  const hasOlderWork = (remoteData?.length ?? 0) >= take;
  const loadOlderWork = useCallback(() => {
    if (!isOnline) return;
    const next = take + WORK_LIST_PAGE_SIZE;
    takeRef.current = next;
    setListWindow({ gardenId, take: next });
    void queryClient.refetchQueries({ queryKey: worksKeys.online(gardenId, chainId), exact: true });
  }, [chainId, gardenId, isOnline, queryClient, take]);
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
  const works = useMemo(() => {
    const metadataByKey = new Map(
      (remoteData ?? []).map((work, index) => [work.metadata.trim(), metadataByWork[index]])
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
    // Each row carries the latest approval read with it; a row without the
    // field came from a read whose approvals could not be fetched. The
    // approval stays in the stored read and leaves the projected row, whose
    // status already carries it.
    const approvalsKnown =
      remoteData !== undefined && remoteData.every((row) => row.approval !== undefined);
    const knownApprovals = new Map<string, EASWorkApproval>();
    const remoteRows: WorkCard[] = [];
    for (const { approval, ...row } of remoteData ?? []) {
      if (approval) knownApprovals.set(row.id, approval);
      remoteRows.push(row);
    }
    const indexed =
      remoteData === undefined
        ? cachedWorks
        : reconcileIndexedWorkCollection(remoteRows, cachedWorks);
    const now = Date.now();
    const rows: Work[] = indexed.map((work) =>
      withResolvedStatus(
        work,
        approvalsKnown ? knownApprovals : null,
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
