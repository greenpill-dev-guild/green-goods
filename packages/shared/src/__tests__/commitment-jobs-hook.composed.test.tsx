/** @vitest-environment jsdom */

/**
 * useCommitmentJobs over the real queue, for a wallet reader.
 *
 * The unit test beside this one scripts `processJob`'s answers, so it would stay
 * green if the queue ever answered a submitted creation or a failed send in
 * another shape. Here the hook runs against the real `createJobQueue`: real
 * identity dedupe, real `processJob`, real `discardJob`. Only the executor, the
 * edge that would reach a chain, is a fake.
 */

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  retryQueuedCommitmentJob,
  useCommitmentJobs,
} from "../hooks/commitment-pooling/useCommitmentJobs";
import type { JobExecution, JobQueueHandle } from "../modules/job-queue/ports";
import { createJobQueue } from "../modules/job-queue/queue";
import type { Address } from "../types/domain";
import { renderHookWithProviders } from "./test-utils";
import {
  createInMemoryJobQueueStore,
  createJobQueueDependencies,
} from "./test-utils/job-queue-fakes";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TX = `0x${"12".repeat(32)}` as const;

const harness = vi.hoisted(() => ({
  queue: null as unknown as JobQueueHandle,
  sender: {
    authMode: "wallet" as const,
    sendContractCall: () => Promise.reject(new Error("unused")),
  },
}));

// A fixed object whose methods read the queue built in `beforeEach`, because the
// hook binds `jobQueue` once at import.
vi.mock("../modules/job-queue/default-instance", () => ({
  jobQueue: {
    addJob: (...args: Parameters<JobQueueHandle["addJob"]>) => harness.queue.addJob(...args),
    processJob: (...args: Parameters<JobQueueHandle["processJob"]>) =>
      harness.queue.processJob(...args),
    discardJob: (...args: Parameters<JobQueueHandle["discardJob"]>) =>
      harness.queue.discardJob(...args),
    retryJob: (...args: Parameters<JobQueueHandle["retryJob"]>) => harness.queue.retryJob(...args),
  },
}));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => VIEWER }));
vi.mock("../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => 42161 }));
vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => harness.sender,
}));

const confirm = { act: "confirm", commitmentId: 9n, gardenAddress: GARDEN } as const;

function setUp(execute: (...args: unknown[]) => Promise<JobExecution>) {
  const store = createInMemoryJobQueueStore();
  const executors = { execute: vi.fn(execute) };
  harness.queue = createJobQueue(createJobQueueDependencies({ store, executors }));
  const jobs = renderHookWithProviders(() => useCommitmentJobs()).result;
  return { store, executors, jobs };
}

describe("useCommitmentJobs over the real queue, signed in with a wallet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the act from the tap and leaves nothing behind", async () => {
    const { store, executors, jobs } = setUp(async () => ({ status: "complete", txHash: TX }));

    await jobs.current.enqueue(confirm);

    expect(executors.execute).toHaveBeenCalledTimes(1);
    expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);
  });

  it("settles a creation in the same tap, where a passkey would wait for the next flush", async () => {
    let pass = 0;
    const { store, executors, jobs } = setUp(async () => {
      pass += 1;
      return pass === 1 ? { status: "submitted", txHash: TX } : { status: "complete" };
    });

    await jobs.current.enqueue({
      act: "create",
      payload: { clientCommitmentId: "draft-1", gardenAddress: GARDEN } as never,
    });

    expect(executors.execute).toHaveBeenCalledTimes(2);
    expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);
  });

  it("keeps a creation whose id has not read back yet, because its send is on chain", async () => {
    let pass = 0;
    const { store, jobs } = setUp(async () => {
      pass += 1;
      return pass === 1
        ? { status: "submitted", txHash: TX }
        : { status: "waiting", reason: "pending-first-send" };
    });

    await expect(
      jobs.current.enqueue({
        act: "create",
        payload: { clientCommitmentId: "draft-1", gardenAddress: GARDEN } as never,
      })
    ).resolves.toEqual(expect.any(String));

    const [kept] = await store.getJobs({ userAddress: VIEWER });
    expect(kept?.meta?.submittedTxHash).toBe(TX);
  });

  it("drops a declined send, so the next tap is a clean second try", async () => {
    const decline = new Error("User rejected the request");
    let declined = false;
    const { store, executors, jobs } = setUp(async () => {
      if (declined) return { status: "complete", txHash: TX };
      declined = true;
      throw decline;
    });

    await expect(jobs.current.enqueue(confirm)).rejects.toThrow(/rejected/i);
    expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);

    await expect(jobs.current.enqueue(confirm)).resolves.toEqual(expect.any(String));
    expect(executors.execute).toHaveBeenCalledTimes(2);
    expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);
  });

  it("keeps an act the queue is holding, and one it judged final", async () => {
    const waiting = setUp(async () => ({ status: "waiting", reason: "membership-unavailable" }));
    await expect(waiting.jobs.current.enqueue(confirm)).resolves.toEqual(expect.any(String));
    expect(await waiting.store.getJobs({ userAddress: VIEWER })).toHaveLength(1);

    const final = setUp(async () => ({ status: "identity-conflict", reason: "commitment-frozen" }));
    await expect(final.jobs.current.enqueue(confirm)).rejects.toThrow(/commitment-frozen/);
    expect(await final.store.getJobs({ userAddress: VIEWER })).toHaveLength(1);
  });

  it("Try Again settles a kept creation, and a declined retry keeps the row it came from", async () => {
    let pass = 0;
    const { store, jobs } = setUp(async () => {
      pass += 1;
      if (pass === 1) return { status: "submitted", txHash: TX };
      if (pass === 2) return { status: "waiting", reason: "pending-first-send" };
      if (pass === 3) throw new Error("User rejected the request");
      return { status: "complete" };
    });
    const jobId = await jobs.current.enqueue({
      act: "create",
      payload: { clientCommitmentId: "draft-1", gardenAddress: GARDEN } as never,
    });

    await expect(retryQueuedCommitmentJob(jobId, harness.sender as never)).rejects.toThrow(
      /rejected/i
    );
    expect(await store.getJobs({ userAddress: VIEWER })).toHaveLength(1);

    await retryQueuedCommitmentJob(jobId, harness.sender as never);
    expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);
  });
});
