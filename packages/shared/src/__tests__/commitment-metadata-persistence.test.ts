/**
 * Does the published CID actually survive a later failure?
 *
 * The round-1 finding was that `markJobFailed` re-reads the job from storage,
 * so a CID held only in memory is thrown away — and the retry then rests on two
 * uploads returning byte-identical CIDs, with an identity conflict and a dead
 * commitment if they ever differ.
 *
 * The existing publish tests mock `updateJob` and assert it was called, which
 * would pass even if the write never landed. This one keeps a real store and
 * puts the job through the same read-modify-write that `markJobFailed` does,
 * so it fails if the persistence stops working rather than if the line is
 * deleted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();

const mocks = vi.hoisted(() => ({
  uploadJSONToIPFS: vi.fn(),
  executeCommitmentJob: vi.fn(),
}));

vi.mock("../modules/data/ipfs/upload", () => ({ uploadJSONToIPFS: mocks.uploadJSONToIPFS }));
vi.mock("../modules/job-queue/db", () => ({
  jobQueueDB: {
    // Stateful, so a write has to actually land to be seen later.
    updateJob: async (job: { id: string }) => {
      store.set(job.id, { ...job });
    },
    getImagesForJob: async () => [],
    getSeriesIdByClientId: vi.fn(),
    storeClientCommitmentIdMapping: vi.fn(),
    storeClientSeriesIdMapping: vi.fn(),
  },
}));
vi.mock("../modules/commitment-pooling/jobs", async () => {
  const actual = await vi.importActual<typeof import("../modules/commitment-pooling/jobs")>(
    "../modules/commitment-pooling/jobs"
  );
  return { ...actual, executeCommitmentJob: mocks.executeCommitmentJob };
});
vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  readContract: vi.fn(),
}));
vi.mock("../utils/blockchain/contracts", async () => {
  const actual = await vi.importActual<typeof import("../utils/blockchain/contracts")>(
    "../utils/blockchain/contracts"
  );
  return {
    ...actual,
    getNetworkContracts: () => ({
      commitmentPoolingModule: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
    }),
  };
});

const { executeCommitmentQueueJob } = await import("../modules/job-queue/job-executors");

/**
 * What `processJob` does after a waiting return: it writes the job it is still
 * holding, spreading the meta from memory rather than from storage.
 */
function markWaitingLikeTheRealCaller(job: { id: string; meta?: Record<string, unknown> }) {
  const next = {
    ...job,
    meta: { ...(job.meta ?? {}), waitingForDependency: true },
    lastAttemptAt: Date.now(),
  };
  store.set(job.id, { ...next });
  return next as never;
}

/** The read-modify-write `markJobFailed` performs, which is where a CID was lost. */
function markJobFailedLikeTheRealOne(id: string) {
  const stored = store.get(id);
  if (!stored) return;
  stored.attempts = Number(stored.attempts ?? 0) + 1;
  store.set(id, stored);
}

function job() {
  return {
    id: "job-1",
    kind: "commitment",
    attempts: 0,
    userAddress: "0x1111111111111111111111111111111111111111",
    payload: {
      clientCommitmentId: "draft-1",
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      metadataCID: "",
      metadata: { version: 1, title: "Compost workshop" },
    },
  } as never;
}

describe("a published CID survives what comes after it", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    mocks.executeCommitmentJob.mockResolvedValue({ status: "sent", txHash: "0xabc" });
  });

  it("is still there after the job is marked failed and read back", async () => {
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafyCID" });

    await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);
    markJobFailedLikeTheRealOne("job-1");

    const persisted = store.get("job-1") as { payload: { metadataCID: string }; attempts: number };
    expect(persisted.payload.metadataCID).toBe("bafyCID");
    expect(persisted.attempts).toBe(1);
  });

  it("lets the next attempt reuse it instead of publishing again", async () => {
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafyCID" });
    await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);
    markJobFailedLikeTheRealOne("job-1");

    // Whatever the gateway would return now is irrelevant: the retry reads the
    // stored job, which already carries the CID the contract was given.
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "DIFFERENT" });
    const retried = store.get("job-1") as never;
    await executeCommitmentQueueJob("job-1", retried, 42161, {} as never);

    expect(mocks.uploadJSONToIPFS).toHaveBeenCalledTimes(1);
    const sent = mocks.executeCommitmentJob.mock.calls[1]?.[0] as {
      payload: { metadataCID: string };
    };
    expect(sent.payload.metadataCID).toBe("bafyCID");
  });

  it("keeps its attempt count across failures so it can eventually give up", async () => {
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));

    let current = job();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await executeCommitmentQueueJob("job-1", current, 42161, {} as never);
      expect(result).toEqual({ status: "waiting", reason: "metadata-unpublished" });
      current = markWaitingLikeTheRealCaller(current);
    }

    const final = await executeCommitmentQueueJob("job-1", current, 42161, {} as never);
    expect(final).toEqual({ status: "unavailable", reason: "metadata-unavailable" });
  });

  it("survives the caller writing the job again on the same attempt", async () => {
    // The step the first version of this file left out. processJob writes the
    // job it still holds in memory after a waiting return, so a count written
    // only to storage is erased before the next attempt reads it — and the
    // ceiling never arrives. The loop above passes either way; this does not.
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));

    const first = job();
    await executeCommitmentQueueJob("job-1", first, 42161, {} as never);
    markWaitingLikeTheRealCaller(first);

    const persisted = store.get("job-1") as { meta: { metadataAttempts?: number } };
    expect(persisted.meta.metadataAttempts).toBe(1);
  });
});
