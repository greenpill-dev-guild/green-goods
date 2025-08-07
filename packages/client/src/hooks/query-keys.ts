/**
 * Centralized Query Key Factory
 * Standardizes and simplifies React Query cache keys
 */

// Base query key factory
export const queryKeys = {
  // Top-level keys
  all: ["jobQueue"] as const,

  // Job queue related keys
  queue: {
    all: ["jobQueue", "queue"] as const,
    stats: () => ["jobQueue", "queue", "stats"] as const,
    jobs: (filter?: { kind?: string; synced?: boolean }) =>
      ["jobQueue", "queue", "jobs", filter] as const,
    pendingCount: () => ["jobQueue", "queue", "pendingCount"] as const,
  },

  // Works related keys
  works: {
    all: ["jobQueue", "works"] as const,
    online: (gardenId: string, chainId: number) =>
      ["jobQueue", "works", "online", gardenId, chainId] as const,
    offline: (gardenId: string) => ["jobQueue", "works", "offline", gardenId] as const,
    merged: (gardenId: string, chainId: number) =>
      ["jobQueue", "works", "merged", gardenId, chainId] as const,
    approvals: (userAddress?: string, chainId?: number) =>
      ["jobQueue", "works", "approvals", userAddress, chainId] as const,
  },

  // Work approvals related keys
  workApprovals: {
    all: ["workApprovals"] as const,
    byAttester: (attesterAddress?: string, chainId?: number) =>
      ["workApprovals", "byAttester", attesterAddress, chainId] as const,
    offline: (attesterAddress?: string) => ["workApprovals", "offline", attesterAddress] as const,
  },

  // Offline state keys
  offline: {
    all: ["jobQueue", "offline"] as const,
    status: () => ["jobQueue", "offline", "status"] as const,
    sync: () => ["jobQueue", "offline", "sync"] as const,
  },

  // Media related keys
  media: {
    all: ["jobQueue", "media"] as const,
    forJob: (jobId: string) => ["jobQueue", "media", "job", jobId] as const,
  },
} as const;

// Utility functions for invalidating related queries
export const queryInvalidation = {
  // Invalidate all job queue related queries
  invalidateAll: () => queryKeys.all,

  // Invalidate queue statistics
  invalidateQueueStats: () => queryKeys.queue.stats(),

  // Invalidate works for a specific garden
  invalidateWorksForGarden: (gardenId: string, chainId: number) => [
    queryKeys.works.online(gardenId, chainId),
    queryKeys.works.offline(gardenId),
    queryKeys.works.merged(gardenId, chainId),
  ],

  // Invalidate all works
  invalidateAllWorks: () => queryKeys.works.all,

  // Invalidate offline state
  invalidateOfflineState: () => queryKeys.offline.all,

  // Get queries to invalidate when a job is added
  onJobAdded: (gardenId: string, chainId: number) => [
    queryKeys.queue.stats(),
    queryKeys.queue.pendingCount(),
    queryKeys.works.offline(gardenId),
    queryKeys.works.merged(gardenId, chainId),
  ],

  // Get queries to invalidate when a job is completed
  onJobCompleted: (gardenId: string, chainId: number) => [
    queryKeys.queue.stats(),
    queryKeys.queue.pendingCount(),
    queryKeys.works.all,
    queryKeys.works.online(gardenId, chainId),
    queryKeys.works.merged(gardenId, chainId),
    queryKeys.works.approvals(),
  ],

  // Get queries to invalidate when sync is completed
  onSyncCompleted: () => [queryKeys.queue.all, queryKeys.works.all, queryKeys.offline.sync()],
};

// Type-safe query key helpers
export type QueryKey =
  | typeof queryKeys.all
  | ReturnType<typeof queryKeys.queue.stats>
  | ReturnType<typeof queryKeys.queue.jobs>
  | ReturnType<typeof queryKeys.queue.pendingCount>
  | typeof queryKeys.works.all
  | ReturnType<typeof queryKeys.works.online>
  | ReturnType<typeof queryKeys.works.offline>
  | ReturnType<typeof queryKeys.works.merged>
  | ReturnType<typeof queryKeys.works.approvals>
  | typeof queryKeys.workApprovals.all
  | ReturnType<typeof queryKeys.workApprovals.byAttester>
  | ReturnType<typeof queryKeys.workApprovals.offline>
  | typeof queryKeys.offline.all
  | ReturnType<typeof queryKeys.offline.status>
  | ReturnType<typeof queryKeys.offline.sync>
  | typeof queryKeys.media.all
  | ReturnType<typeof queryKeys.media.forJob>;

export type WorksQueryKey =
  | typeof queryKeys.works.all
  | ReturnType<typeof queryKeys.works.online>
  | ReturnType<typeof queryKeys.works.offline>
  | ReturnType<typeof queryKeys.works.merged>
  | ReturnType<typeof queryKeys.works.approvals>;

export type QueueQueryKey =
  | typeof queryKeys.queue.all
  | ReturnType<typeof queryKeys.queue.stats>
  | ReturnType<typeof queryKeys.queue.jobs>
  | ReturnType<typeof queryKeys.queue.pendingCount>;
