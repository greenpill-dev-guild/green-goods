import { vi } from "vitest";

import type { Job, JobKindMap, QueueEvent, QueueStats } from "../../types/job-queue";
import type {
  FlushResult,
  JobExecution,
  JobExecutorRegistry,
  JobQueueAnalytics,
  JobQueueBackgroundSync,
  JobQueueClock,
  JobQueueConnectivity,
  JobQueueDependencies,
  JobQueueEvents,
  JobQueueHandle,
  JobQueueScheduler,
  JobQueueStore,
} from "../../modules/job-queue/ports";

export function createInMemoryJobQueueStore(initial: Job[] = []): JobQueueStore & {
  jobs: Map<string, Job>;
} {
  const jobs = new Map(initial.map((job) => [job.id, structuredClone(job)]));
  let nextId = jobs.size;
  return {
    jobs,
    async addJob<T>(input: Omit<Job<T>, "id" | "createdAt" | "attempts" | "synced">) {
      const id = `job-${++nextId}`;
      jobs.set(id, { ...input, id, createdAt: 0, attempts: 0, synced: false } as Job);
      return id;
    },
    async getJob(id) {
      return jobs.get(id);
    },
    async getJobs(filter) {
      return [...jobs.values()].filter(
        (job) =>
          job.userAddress === filter.userAddress &&
          (filter.kind === undefined || job.kind === filter.kind) &&
          (filter.synced === undefined || job.synced === filter.synced)
      );
    },
    async updateJob(job) {
      jobs.set(job.id, job);
    },
    async markJobSynced(id, txHash) {
      const job = jobs.get(id);
      if (!job) return;
      jobs.set(id, {
        ...job,
        synced: true,
        meta: { ...(job.meta ?? {}), ...(txHash ? { txHash } : {}) },
      });
    },
    async markJobFailed(id, error) {
      const job = jobs.get(id);
      if (!job) return;
      jobs.set(id, { ...job, attempts: job.attempts + 1, lastError: error, lastAttemptAt: 0 });
    },
    async markJobTerminalFailed(id, error) {
      const job = jobs.get(id);
      if (!job) return;
      jobs.set(id, {
        ...job,
        attempts: Math.max(job.attempts, 5),
        lastError: error,
        lastAttemptAt: 0,
      });
    },
    async deleteJob(id) {
      jobs.delete(id);
    },
    async getImagesForJob() {
      return [];
    },
    async getStats(userAddress): Promise<QueueStats> {
      const selected = [...jobs.values()].filter((job) => job.userAddress === userAddress);
      return {
        total: selected.length,
        pending: selected.filter((job) => !job.synced && !job.lastError).length,
        failed: selected.filter((job) => Boolean(job.lastError)).length,
        synced: selected.filter((job) => job.synced).length,
      };
    },
    storeClientWorkIdMapping: vi.fn().mockResolvedValue(undefined),
    loadFailedDeleteIds: vi.fn().mockResolvedValue([]),
    saveFailedDeleteIds: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

export function createFakeJobQueueEvents(): JobQueueEvents & { emitted: string[] } {
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const emitted: string[] = [];
  const emit = vi.fn((type: string, data: unknown) => {
    emitted.push(type);
    for (const listener of listeners.get(type) ?? []) listener(data);
  }) as JobQueueEvents["emit"];
  const on = vi.fn((type: string, listener: (data: unknown) => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(listener);
    listeners.set(type, set);
    return () => set.delete(listener);
  }) as JobQueueEvents["on"];
  return {
    emitted,
    emit,
    on,
  };
}

export function createFakeJobQueueClock(
  now = 1_000
): JobQueueClock & { advance(ms: number): void } {
  let current = now;
  return { now: () => current, advance: (ms) => (current += ms) };
}

export function createFakeJobQueueConnectivity(online = true): JobQueueConnectivity & {
  setOnline(value: boolean): void;
} {
  let current = online;
  return { isOnline: () => current, setOnline: (value) => (current = value) };
}

export function createFakeJobQueueAnalytics(): JobQueueAnalytics {
  return {
    jobCreated: vi.fn(),
    jobPermanentlyFailed: vi.fn(),
    jobProcessed: vi.fn(),
    jobProcessingError: vi.fn().mockResolvedValue(undefined),
    storageWarning: vi.fn(),
    privateEvent: vi.fn(),
    processingStarted: vi.fn(),
  };
}

export function createFakeJobQueueScheduler(): JobQueueScheduler {
  return {
    schedule: vi.fn((task: () => Promise<unknown>) => task()) as JobQueueScheduler["schedule"],
    yield: vi.fn().mockResolvedValue(undefined),
  };
}

export function createFakeJobExecutorRegistry(
  result: JobExecution = { status: "complete", txHash: "0xtest" }
): JobExecutorRegistry {
  return { execute: vi.fn().mockResolvedValue(result) };
}

export function createFakeBackgroundSync(): JobQueueBackgroundSync {
  return { request: vi.fn() };
}

export function createFakeJobQueueHandle(overrides: Partial<JobQueueHandle> = {}): JobQueueHandle {
  const empty: FlushResult = { processed: 0, failed: 0, skipped: 0 };
  return {
    addJob: vi.fn(async <K extends keyof JobKindMap>(_kind: K) => "job-1"),
    processJob: vi.fn().mockResolvedValue({ success: true }),
    flush: vi.fn().mockResolvedValue(empty),
    retryJob: vi.fn().mockResolvedValue(undefined),
    discardJob: vi.fn().mockResolvedValue(true),
    getStats: vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 }),
    getJobs: vi.fn().mockResolvedValue([]),
    getJobsWithImages: vi.fn().mockResolvedValue([]),
    hasPendingJobs: vi.fn().mockResolvedValue(false),
    getPendingCount: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn((_listener: (event: QueueEvent) => void) => () => undefined),
    onSyncCompleted: vi.fn(() => () => undefined),
    onBackgroundSyncRequested: vi.fn(() => () => undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function createJobQueueDependencies(
  overrides: Partial<JobQueueDependencies> = {}
): JobQueueDependencies {
  return {
    store: createInMemoryJobQueueStore(),
    events: createFakeJobQueueEvents(),
    executors: createFakeJobExecutorRegistry(),
    admission: { prepare: ({ payload }) => payload },
    analytics: createFakeJobQueueAnalytics(),
    quota: {
      get: vi.fn().mockResolvedValue({
        used: 1,
        quota: 100,
        percentUsed: 1,
        isLow: false,
        isCritical: false,
      }),
    },
    scheduler: createFakeJobQueueScheduler(),
    connectivity: createFakeJobQueueConnectivity(),
    backgroundSync: createFakeBackgroundSync(),
    clock: createFakeJobQueueClock(),
    config: { defaultChainId: 11155111, maxRetries: 5, storageQuotaCacheTTL: 30_000 },
    lifecycle: { attach: vi.fn(() => () => undefined) },
    logger: { debug: vi.fn(), warn: vi.fn() },
    ...overrides,
  };
}
