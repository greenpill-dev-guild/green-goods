/** @vitest-environment happy-dom */

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

import { toastService } from "../components/toast";
import {
  retryQueuedCommitmentJob,
  useCommitmentJobs,
} from "../hooks/commitment-pooling/useCommitmentJobs";
import type { JobExecution, JobQueueHandle } from "../modules/job-queue/ports";
import { createJobQueue } from "../modules/job-queue/queue";
import type { Address } from "../types/domain";
import type { Job } from "../types/job-queue";
import { renderHookWithProviders } from "./test-utils/render-helpers";
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
// The failure toast, as the person reads it (the test wrapper's catalog is English).
const toastError = vi.spyOn(toastService, "error").mockImplementation(() => "toast");

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

  it("keeps a declined proof on the phone with its identity, for the person to send or discard", async () => {
    const { store, jobs } = setUp(async () => {
      throw new Error("User rejected the request");
    });

    await expect(
      jobs.current.enqueue({
        act: "evidence",
        payload: {
          clientEvidenceId: "proof-1",
          commitmentId: 9n,
          creditedContributors: [VIEWER],
          gardenAddress: GARDEN,
          note: "Posts replaced",
        },
      })
    ).resolves.toEqual(expect.any(String));

    const [kept] = await store.getJobs({ userAddress: VIEWER });
    expect(kept?.kind).toBe("evidence");
    expect(kept?.payload).toMatchObject({ clientEvidenceId: "proof-1", note: "Posts replaced" });
  });

  it("keeps an act the queue is holding, one it judged final, and one that may have been sent", async () => {
    const waiting = setUp(async () => ({ status: "waiting", reason: "membership-unavailable" }));
    await expect(waiting.jobs.current.enqueue(confirm)).resolves.toEqual(expect.any(String));
    expect(await waiting.store.getJobs({ userAddress: VIEWER })).toHaveLength(1);

    const final = setUp(async () => ({ status: "identity-conflict", reason: "commitment-frozen" }));
    await expect(final.jobs.current.enqueue(confirm)).rejects.toThrow(/commitment-frozen/);
    expect(await final.store.getJobs({ userAddress: VIEWER })).toHaveLength(1);

    // A wallet that broadcast before the receipt timed out looks exactly like one
    // that never sent, and a commitment job records no broadcast checkpoint. The
    // row is the only trace of a transaction that may still land, so it stays.
    const ambiguous = setUp(async () => {
      throw new Error("timed out waiting for the receipt");
    });
    await expect(ambiguous.jobs.current.enqueue(confirm)).rejects.toThrow(/timed out/);
    expect(await ambiguous.store.getJobs({ userAddress: VIEWER })).toHaveLength(1);
  });

  describe("pressing the form's button again after a send that failed", () => {
    // As the composer builds it on every press: the deadline counts from the press,
    // and the words ride the job with no CID yet.
    const creation = (overrides: Record<string, unknown> = {}) =>
      ({
        act: "create",
        payload: {
          clientCommitmentId: "draft-1",
          gardenAddress: GARDEN,
          targetUnits: 10n,
          dueDate: 2_000_000_000n,
          metadataCID: "",
          metadata: { version: 1, title: "Ten hours of weeding" },
          ...overrides,
        } as never,
      }) as const;
    // What the chain guard throws when the person declines the wallet's network switch.
    const declinedSwitch =
      "Network switch rejected. Approve the wallet prompt to switch to Arbitrum One before continuing.";

    /** A first press whose send fails after the executor has published the words. */
    function failingFirstSend() {
      let pass = 0;
      return setUp(async (_jobId, job) => {
        pass += 1;
        if (pass === 1) {
          ((job as Job).payload as { metadataCID: string }).metadataCID = "bafy-published";
          throw new Error(declinedSwitch);
        }
        return pass === 2 ? { status: "submitted", txHash: TX } : { status: "complete" };
      });
    }

    it("sends the creation already queued, and files no second one", async () => {
      const { store, executors, jobs } = failingFirstSend();

      // A declined network switch is not a declined signature: the act stays queued.
      await expect(jobs.current.enqueue(creation())).rejects.toThrow(/Network switch rejected/);
      const [queued] = await store.getJobs({ userAddress: VIEWER });
      expect(queued?.lastError).toBe(declinedSwitch);
      expect(toastError).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "Wallet on another network",
          message:
            "Your wallet needs to be on Arbitrum One for this. Switch it there, then try again.",
        })
      );

      // Ninety seconds later the same answers build a later deadline and no CID.
      await expect(jobs.current.enqueue(creation({ dueDate: 2_000_000_090n }))).resolves.toBe(
        queued?.id
      );

      expect(executors.execute.mock.calls.map(([jobId]) => jobId)).toEqual([
        queued?.id,
        queued?.id,
        queued?.id,
      ]);
      expect(await store.getJobs({ userAddress: VIEWER })).toEqual([]);
    });

    it("refuses a press whose answers changed, and leaves the queued creation to send or discard", async () => {
      const { store, executors, jobs } = failingFirstSend();
      await expect(jobs.current.enqueue(creation())).rejects.toThrow(/Network switch rejected/);

      await expect(
        jobs.current.enqueue(creation({ dueDate: 2_000_000_090n, targetUnits: 12n }))
      ).rejects.toThrow(/offline_job_identity_conflict/);
      expect(toastError).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: "An earlier version is waiting",
          message: expect.stringMatching(/earlier version .* hasn't been sent/),
        })
      );

      // Nothing was sent, overwritten or added: the earlier version is still the one queued.
      expect(executors.execute).toHaveBeenCalledTimes(1);
      const kept = await store.getJobs({ userAddress: VIEWER });
      expect(kept).toHaveLength(1);
      expect(kept[0]?.payload).toMatchObject({ targetUnits: 10n, dueDate: 2_000_000_000n });
      await expect(harness.queue.discardJob(kept[0]?.id ?? "")).resolves.toBe(true);
    });
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
