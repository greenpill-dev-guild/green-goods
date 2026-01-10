/**
 * Centralized Query Key Factory
 * Standardizes and simplifies React Query cache keys
 */

// ============================================
// Stale Time Constants (in milliseconds)
// ============================================

/** Fast-changing data (queue status, uploading jobs) */
export const STALE_TIME_FAST = 5_000; // 5 seconds

/** Medium-frequency data (approvals, recent works) */
export const STALE_TIME_MEDIUM = 30_000; // 30 seconds

/** Slow-changing data (gardens, actions) */
export const STALE_TIME_SLOW = 60_000; // 1 minute

/** Rarely changing data (user profile, settings) */
export const STALE_TIME_RARE = 300_000; // 5 minutes

/** Default retry configuration */
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

// Base query key factory
export const queryKeys = {
  // Top-level key for all Green Goods queries
  all: ["greengoods"] as const,

  // Job queue related keys
  queue: {
    all: ["greengoods", "queue"] as const,
    stats: () => ["greengoods", "queue", "stats"] as const,
    jobs: (filter?: { kind?: string; synced?: boolean }) =>
      ["greengoods", "queue", "jobs", filter] as const,
    pendingCount: () => ["greengoods", "queue", "pendingCount"] as const,
    uploading: () => ["greengoods", "queue", "uploading"] as const,
  },

  // Works related keys
  works: {
    all: ["greengoods", "works"] as const,
    online: (gardenId: string, chainId: number) =>
      ["greengoods", "works", "online", gardenId, chainId] as const,
    offline: (gardenId: string) => ["greengoods", "works", "offline", gardenId] as const,
    merged: (gardenId: string, chainId: number) =>
      ["greengoods", "works", "merged", gardenId, chainId] as const,
    approvals: (userAddress?: string, chainId?: number) =>
      ["greengoods", "works", "approvals", userAddress, chainId] as const,
  },

  // Work approvals related keys
  workApprovals: {
    all: ["greengoods", "workApprovals"] as const,
    byAttester: (attesterAddress?: string, chainId?: number) =>
      ["greengoods", "workApprovals", "byAttester", attesterAddress, chainId] as const,
    offline: (attesterAddress?: string) =>
      ["greengoods", "workApprovals", "offline", attesterAddress] as const,
  },

  // Offline state keys
  offline: {
    all: ["greengoods", "offline"] as const,
    status: () => ["greengoods", "offline", "status"] as const,
    sync: () => ["greengoods", "offline", "sync"] as const,
  },

  // Media related keys
  media: {
    all: ["greengoods", "media"] as const,
    forJob: (jobId: string) => ["greengoods", "media", "job", jobId] as const,
  },

  // Garden related keys
  gardens: {
    all: ["greengoods", "gardens"] as const,
    byChain: (chainId: number) => ["greengoods", "gardens", chainId] as const,
    detail: (gardenId: string, chainId: number) =>
      ["greengoods", "gardens", "detail", gardenId, chainId] as const,
  },

  // Action related keys
  actions: {
    all: ["greengoods", "actions"] as const,
    byChain: (chainId: number) => ["greengoods", "actions", chainId] as const,
  },

  // Gardener related keys
  gardeners: {
    all: ["greengoods", "gardeners"] as const,
    byAddress: (address: string) => ["greengoods", "gardeners", "byAddress", address] as const,
  },

  // Role related keys (operator/deployer detection)
  role: {
    all: ["greengoods", "role"] as const,
    operatorGardens: (address?: string) =>
      ["greengoods", "role", "operatorGardens", address] as const,
  },

  // Draft related keys
  drafts: {
    all: ["greengoods", "drafts"] as const,
    list: (userAddress: string, chainId: number) =>
      ["greengoods", "drafts", "list", userAddress, chainId] as const,
    detail: (draftId: string) => ["greengoods", "drafts", "detail", draftId] as const,
    images: (draftId: string) => ["greengoods", "drafts", "images", draftId] as const,
  },
} as const;

// Utility functions for invalidating related queries
export const queryInvalidation = {
  // Invalidate all Green Goods related queries
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

  // Invalidate gardens (e.g., after joining/leaving)
  invalidateGardens: (chainId: number) => [
    queryKeys.gardens.all,
    queryKeys.gardens.byChain(chainId),
  ],

  // Invalidate specific garden
  invalidateGarden: (gardenId: string, chainId: number) => [
    queryKeys.gardens.byChain(chainId),
    queryKeys.gardens.detail(gardenId, chainId),
  ],

  // Invalidate drafts for user
  invalidateDrafts: (userAddress: string, chainId: number) => [
    queryKeys.drafts.all,
    queryKeys.drafts.list(userAddress, chainId),
  ],

  // Invalidate specific draft
  invalidateDraft: (draftId: string) => [
    queryKeys.drafts.detail(draftId),
    queryKeys.drafts.images(draftId),
  ],
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
