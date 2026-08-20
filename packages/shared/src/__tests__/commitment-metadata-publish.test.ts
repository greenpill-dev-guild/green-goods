/**
 * The commitment metadata publish step.
 *
 * The riskiest path on this branch and previously untested: it is the only one
 * whose failure mode is unrecoverable, because `identity-conflict` marks a job
 * terminally failed with no retry.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadJSONToIPFS: vi.fn(),
  updateJob: vi.fn(),
  executeCommitmentJob: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("../modules/data/ipfs/upload", () => ({ uploadJSONToIPFS: mocks.uploadJSONToIPFS }));
vi.mock("../modules/job-queue/db", () => ({
  jobQueueDB: {
    updateJob: mocks.updateJob,
    getImagesForJob: vi.fn().mockResolvedValue([]),
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
  readContract: mocks.readContract,
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

const METADATA = { version: 1, title: "Compost workshop" };

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    kind: "commitment",
    userAddress: "0x1111111111111111111111111111111111111111",
    payload: {
      clientCommitmentId: "draft-1",
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      metadataCID: "",
      metadata: METADATA,
      ...(overrides.payload as object),
    },
    ...overrides,
  } as never;
}

describe("publishing a commitment's words", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeCommitmentJob.mockResolvedValue({ status: "sent", txHash: "0xabc" });
  });

  it("writes the CID back to storage the moment it exists", async () => {
    // markJobFailed re-reads the job from storage, so a CID kept only in memory
    // is lost on any later throw — and the retry then depends on two uploads
    // returning identical CIDs.
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafyCID" });

    await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);

    expect(mocks.updateJob).toHaveBeenCalledTimes(1);
    const persisted = mocks.updateJob.mock.calls[0]?.[0] as { payload: { metadataCID: string } };
    expect(persisted.payload.metadataCID).toBe("bafyCID");
  });

  it("publishes before anything reads or sends the payload", async () => {
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafyCID" });

    await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);

    const sent = mocks.executeCommitmentJob.mock.calls[0]?.[0] as {
      payload: { metadataCID: string };
    };
    expect(sent.payload.metadataCID).toBe("bafyCID");
  });

  it("waits rather than spending an attempt when the upload fails", async () => {
    // Throwing here runs markJobFailed, which burns one of five attempts on an
    // outage unrelated to this commitment, and does it before the recovery read
    // that would have noticed the commitment already exists.
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));

    const result = await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);

    expect(result).toEqual({ status: "waiting", reason: "metadata-unpublished" });
    expect(mocks.executeCommitmentJob).not.toHaveBeenCalled();
  });

  it("never republishes a commitment that already carries a CID", async () => {
    await executeCommitmentQueueJob(
      "job-1",
      job({ payload: { metadataCID: "bafyAlready" } }),
      42161,
      {} as never
    );

    expect(mocks.uploadJSONToIPFS).not.toHaveBeenCalled();
    expect(mocks.updateJob).not.toHaveBeenCalled();
  });

  it("leaves other commitment job kinds untouched", async () => {
    await executeCommitmentQueueJob(
      "job-1",
      job({ kind: "claim", payload: { metadataCID: "", metadata: undefined } }),
      42161,
      {} as never
    );

    expect(mocks.uploadJSONToIPFS).not.toHaveBeenCalled();
  });
});

describe("when the gateway never comes back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeCommitmentJob.mockResolvedValue({ status: "sent", txHash: "0xabc" });
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));
  });

  it("counts its own attempts rather than waiting forever", async () => {
    const first = await executeCommitmentQueueJob("job-1", job(), 42161, {} as never);
    expect(first).toEqual({ status: "waiting", reason: "metadata-unpublished" });

    const persisted = mocks.updateJob.mock.calls[0]?.[0] as { meta: { metadataAttempts: number } };
    expect(persisted.meta.metadataAttempts).toBe(1);
  });

  it("gives up after as many tries as any other job gets", async () => {
    // Waiting silently forever is its own failure mode: no attempts spent, no
    // job:failed, nothing on any surface. Better to fail where it can be seen.
    const exhausted = job({ meta: { metadataAttempts: 4 } });
    const result = await executeCommitmentQueueJob("job-1", exhausted, 42161, {} as never);

    // Terminal, but named for what happened. Reporting a gateway outage as an
    // identity conflict puts a data-integrity signal in the member's job record
    // and makes real conflicts indistinguishable in the metrics.
    expect(result).toEqual({ status: "unavailable", reason: "metadata-unavailable" });
    expect(mocks.executeCommitmentJob).not.toHaveBeenCalled();
  });
});
