/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJobQueue } from "../../modules/job-queue/queue";
import type { FlushResult, JobQueueDependencies } from "../../modules/job-queue/ports";
import type { Job, JobKindMap, QueueEvent } from "../../types/job-queue";
import {
  createFakeJobExecutorRegistry,
  createFakeJobQueueClock,
  createFakeJobQueueConnectivity,
  createInMemoryJobQueueStore,
  createJobQueueDependencies,
} from "../test-utils/job-queue-fakes";

const USER = "0x1111111111111111111111111111111111111111";

function queuedJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    kind: "work",
    payload: {},
    userAddress: USER,
    chainId: 11155111,
    createdAt: 1,
    attempts: 0,
    synced: false,
    ...overrides,
  } as Job;
}

function setup(overrides: Partial<JobQueueDependencies> = {}) {
  const deps = createJobQueueDependencies(overrides);
  return { deps, queue: createJobQueue(deps) };
}

describe("createJobQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("constructs from explicit dependencies and persists a job", async () => {
    const { deps, queue } = setup();
    const id = await queue.addJob("work", {} as JobKindMap["work"], USER);

    expect(id).toBe("job-1");
    expect(await queue.getPendingCount(USER)).toBe(1);
    expect(deps.events.emit).toHaveBeenCalledWith("job:added", expect.anything());
    expect(deps.backgroundSync.request).toHaveBeenCalledOnce();
    expect(deps.analytics.jobCreated).toHaveBeenCalledWith("work", true, 11155111);
  });

  it("requires an address for add and flush", async () => {
    const { queue } = setup();
    await expect(queue.addJob("work", {} as JobKindMap["work"], "")).rejects.toThrow(
      "userAddress is required when adding a job"
    );
    await expect(queue.flush({ transactionSender: null, userAddress: "" })).rejects.toThrow(
      "userAddress is required for flush operation"
    );
  });

  it("caches quota reads and tolerates background-sync registration failure", async () => {
    const backgroundSync = {
      request: vi.fn(() => {
        throw new Error("unsupported");
      }),
    };
    const { deps, queue } = setup({ backgroundSync });
    await queue.addJob("work", {} as JobKindMap["work"], USER);
    await queue.addJob("approval", {} as JobKindMap["approval"], USER);

    expect(deps.quota.get).toHaveBeenCalledOnce();
    expect(deps.logger.debug).toHaveBeenCalledWith(
      "[JobQueue] Failed to register background sync",
      expect.anything()
    );
  });

  it("deduplicates equal commitment identities and rejects conflicts", async () => {
    const claim = {
      commitmentId: 1n,
      kind: 0,
      gardenContext: "0x2222222222222222222222222222222222222222",
    } as JobKindMap["claim"];
    const { queue } = setup();
    const first = await queue.addJob("claim", claim, USER);

    await expect(queue.addJob("claim", { ...claim }, USER)).resolves.toBe(first);
    await expect(
      queue.addJob(
        "claim",
        { ...claim, gardenAddress: "0x3333333333333333333333333333333333333333" },
        USER
      )
    ).rejects.toThrow("offline_job_identity_conflict");
  });

  it("emits an empty sync result", async () => {
    const { deps, queue } = setup();
    await expect(queue.flush({ transactionSender: null, userAddress: USER })).resolves.toEqual({
      processed: 0,
      failed: 0,
      skipped: 0,
    });
    expect(deps.events.emit).toHaveBeenCalledWith("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 0 },
    });
  });

  it("serializes concurrent flushes and yields after three jobs", async () => {
    const store = createInMemoryJobQueueStore([
      queuedJob({ id: "1" }),
      queuedJob({ id: "2" }),
      queuedJob({ id: "3" }),
      queuedJob({ id: "4" }),
    ]);
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const executors = {
      execute: vi.fn(
        () =>
          new Promise<{ status: "complete" }>((resolve) => {
            if (executors.execute.mock.calls.length === 1) {
              release = () => resolve({ status: "complete" });
              started?.();
            } else {
              resolve({ status: "complete" });
            }
          })
      ),
    };
    const { deps, queue } = setup({ store, executors });
    const sender = {} as Parameters<typeof queue.flush>[0]["transactionSender"];
    const first = queue.flush({ transactionSender: sender, userAddress: USER });
    const second = queue.flush({ transactionSender: sender, userAddress: USER });
    expect(second).toBe(first);
    await firstStarted;
    release?.();
    await expect(first).resolves.toEqual({ processed: 4, failed: 0, skipped: 0 });
    expect(deps.scheduler.yield).toHaveBeenCalledOnce();
  });

  it("counts scheduler failures without stopping the remaining batch", async () => {
    const store = createInMemoryJobQueueStore([queuedJob({ id: "1" }), queuedJob({ id: "2" })]);
    const scheduler = {
      schedule: vi
        .fn()
        .mockRejectedValueOnce(new Error("scheduler failed"))
        .mockImplementation((task: () => Promise<unknown>) => task()),
      yield: vi.fn().mockResolvedValue(undefined),
    } as JobQueueDependencies["scheduler"];
    const { deps, queue } = setup({ store, scheduler });
    const result = await queue.flush({ transactionSender: {} as never, userAddress: USER });
    expect(result).toEqual({ processed: 1, failed: 1, skipped: 0 });
    expect(deps.events.emit).toHaveBeenCalledWith(
      "job:failed",
      expect.objectContaining({ jobId: "1", error: "scheduler failed" })
    );
  });

  it("exposes readers, subscriptions, recovery, and cleanup through the handle", async () => {
    const failed = queuedJob({ id: "failed", attempts: 5, lastError: "failed" });
    const store = createInMemoryJobQueueStore([failed]);
    let unloadCleanup: (() => void) | undefined;
    const detach = vi.fn();
    const lifecycle = {
      attach: vi.fn((cleanup: () => void) => {
        unloadCleanup = cleanup;
        return detach;
      }),
    };
    const { deps, queue } = setup({ store, lifecycle });
    const received: QueueEvent[] = [];
    const unsubscribe = queue.subscribe((event) => received.push(event));
    let syncResult: FlushResult | undefined;
    const offSync = queue.onSyncCompleted((result) => {
      syncResult = result;
    });
    let backgroundRequests = 0;
    const offBackground = queue.onBackgroundSyncRequested(() => {
      backgroundRequests += 1;
    });

    await queue.retryJob("failed");
    expect((await store.getJob("failed"))?.attempts).toBe(0);
    expect(received.at(-1)?.type).toBe("job_added");
    expect(await queue.discardJob("failed")).toBe(true);
    expect(await queue.discardJob("missing")).toBe(false);
    deps.events.emit("queue:sync-completed", { result: { processed: 1, failed: 0, skipped: 0 } });
    deps.events.emit("background:sync-requested", { source: "service-worker", timestamp: 1 });
    expect(syncResult?.processed).toBe(1);
    expect(backgroundRequests).toBe(1);
    expect(await queue.getStats(USER)).toEqual({ total: 0, pending: 0, failed: 0, synced: 0 });
    expect(await queue.getJobsWithImages(USER)).toEqual([]);
    expect(await queue.hasPendingJobs(USER)).toBe(false);

    unsubscribe();
    offSync();
    offBackground();
    unloadCleanup?.();
    await queue.cleanup();
    expect(detach).toHaveBeenCalledOnce();
    expect(store.cleanup).toHaveBeenCalledOnce();
  });
});

describe("processJob", () => {
  it("skips missing, synced, offline, backoff, and senderless jobs", async () => {
    const clock = createFakeJobQueueClock(1_000);
    const connectivity = createFakeJobQueueConnectivity(true);
    const store = createInMemoryJobQueueStore([
      queuedJob({ id: "synced", synced: true, meta: { txHash: "0xdone" } }),
      queuedJob({ id: "backoff", attempts: 1, lastAttemptAt: 999 }),
      queuedJob({ id: "senderless" }),
    ]);
    const { queue } = setup({ store, clock, connectivity });
    await expect(queue.processJob("missing", { transactionSender: null })).resolves.toEqual({
      success: true,
      skipped: true,
    });
    await expect(queue.processJob("synced", { transactionSender: null })).resolves.toEqual({
      success: true,
      txHash: "0xdone",
      skipped: true,
    });
    connectivity.setOnline(false);
    await expect(queue.processJob("senderless", { transactionSender: null })).resolves.toEqual({
      success: false,
      error: "offline",
      skipped: true,
    });
    connectivity.setOnline(true);
    await expect(
      queue.processJob("backoff", { transactionSender: {} as never })
    ).resolves.toMatchObject({ success: false, error: "backoff_2s", skipped: true });
    await expect(queue.processJob("senderless", { transactionSender: null })).resolves.toEqual({
      success: false,
      error: "transaction_sender_unavailable",
      skipped: true,
    });
  });

  it("permanently fails a job at the retry ceiling", async () => {
    const store = createInMemoryJobQueueStore([queuedJob({ attempts: 5 })]);
    const { deps, queue } = setup({ store });
    await expect(queue.processJob("job-1", { transactionSender: {} as never })).resolves.toEqual({
      success: false,
      error: "Max retries (5) exceeded",
    });
    expect(deps.analytics.jobPermanentlyFailed).toHaveBeenCalledOnce();
  });

  it.each([
    [{ status: "waiting", reason: "membership-unavailable" }, "membership-unavailable", 0],
    [
      { status: "identity-conflict", reason: "payload-mismatch" },
      "identity_conflict:payload-mismatch",
      5,
    ],
    [{ status: "unavailable", reason: "gateway-down" }, "unavailable:gateway-down", 5],
    [{ status: "submitted", txHash: "0xsubmitted" }, "pending_materialization", 0],
  ] as const)("preserves %s execution semantics", async (execution, error, attempts) => {
    const store = createInMemoryJobQueueStore([queuedJob()]);
    const { queue } = setup({ store, executors: createFakeJobExecutorRegistry(execution) });
    const result = await queue.processJob("job-1", { transactionSender: {} as never });
    expect(result).toMatchObject({ success: false, error });
    expect((await store.getJob("job-1"))?.attempts).toBe(attempts);
  });

  it("completes, maps work identity, and emits the completed job", async () => {
    const store = createInMemoryJobQueueStore([
      queuedJob({ meta: { clientWorkId: "client-work" } }),
    ]);
    const { deps, queue } = setup({ store });
    await expect(queue.processJob("job-1", { transactionSender: {} as never })).resolves.toEqual({
      success: true,
      txHash: "0xtest",
    });
    expect(store.storeClientWorkIdMapping).toHaveBeenCalledWith("client-work", "0xtest", "job-1");
    expect(deps.events.emit).toHaveBeenCalledWith(
      "job:completed",
      expect.objectContaining({ jobId: "job-1", txHash: "0xtest" })
    );
    expect(await store.getJob("job-1")).toBeUndefined();
  });

  it("uses the offline receipt hash and tracks failed deletion for cleanup", async () => {
    const store = createInMemoryJobQueueStore([queuedJob()]);
    store.deleteJob = vi.fn().mockRejectedValue(new Error("locked"));
    const { deps, queue } = setup({
      store,
      executors: createFakeJobExecutorRegistry({ status: "complete" }),
    });
    const result = await queue.processJob("job-1", { transactionSender: {} as never });
    expect(result.txHash).toMatch(/^0xoffline_/);
    expect(store.saveFailedDeleteIds).toHaveBeenCalledWith(["job-1"]);
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it("records executor failures without swallowing them", async () => {
    const store = createInMemoryJobQueueStore([queuedJob()]);
    const executors = { execute: vi.fn().mockRejectedValue(new Error("send failed")) };
    const { deps, queue } = setup({ store, executors });
    await expect(queue.processJob("job-1", { transactionSender: {} as never })).resolves.toEqual({
      success: false,
      error: "send failed",
    });
    expect((await store.getJob("job-1"))?.lastError).toBe("send failed");
    expect(deps.analytics.jobProcessingError).toHaveBeenCalledOnce();
  });
});
