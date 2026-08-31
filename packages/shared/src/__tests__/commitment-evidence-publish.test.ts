/**
 * The evidence publish step.
 *
 * Proof is composed in a field with no signal: a note, links, photos, a voice
 * note, and the people credited. None of it can become a CID until the phone is
 * back online, so the job carries the raw document and the media the way the
 * work job does, and the executor publishes them at sync, writes the CID back
 * onto the stored job, and only then calls attachEvidence. An upload that fails
 * leaves the job waiting, never terminal, and a restart in between loses
 * nothing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();
const images = new Map<string, Array<{ id: string; file: File; url: string }>>();

const mocks = vi.hoisted(() => ({
  uploadJSONToIPFS: vi.fn(),
  uploadFileToIPFS: vi.fn(),
  executeCommitmentJob: vi.fn(),
  readContract: vi.fn(),
}));

vi.mock("../modules/data/ipfs/upload", () => ({
  uploadJSONToIPFS: mocks.uploadJSONToIPFS,
  uploadFileToIPFS: mocks.uploadFileToIPFS,
}));
vi.mock("../modules/job-queue/db", () => ({
  jobQueueDB: {
    // Stateful, so a write has to actually land to be seen by a later read.
    updateJob: async (job: { id: string }) => {
      store.set(job.id, { ...job });
    },
    getImagesForJob: async (jobId: string) => images.get(jobId) ?? [],
    getSeriesIdByClientId: vi.fn(),
    storeClientCommitmentIdMapping: vi.fn(),
    storeClientSeriesIdMapping: vi.fn(),
  },
}));
vi.mock("../modules/job-queue/commitment-chain-reads", () => ({
  createCommitmentChainReads: () => ({}),
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

const HOLDER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-evidence",
    kind: "evidence",
    userAddress: HOLDER,
    meta: {},
    payload: {
      clientEvidenceId: "proof-1",
      commitmentId: 9n,
      creditedContributors: [HOLDER],
      gardenAddress: GARDEN,
      note: "Beds cleared",
      links: ["https://example.org/before"],
      ...(overrides.payload as object),
    },
    ...overrides,
  } as never;
}

const photo = new File(["jpeg-bytes"], "beds.jpg", { type: "image/jpeg" });
const voice = new File(["webm-bytes"], "note.webm", { type: "audio/webm" });

describe("publishing proof at sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    images.clear();
    mocks.executeCommitmentJob.mockResolvedValue({ status: "sent", txHash: "0xabc" });
  });

  it("uploads the media, pins the document, writes the CID back, then attaches", async () => {
    images.set("job-evidence", [
      { id: "img-1", file: photo, url: "blob:photo" },
      { id: "img-2", file: voice, url: "blob:voice" },
    ]);
    mocks.uploadFileToIPFS
      .mockResolvedValueOnce({ cid: "bafy-photo" })
      .mockResolvedValueOnce({ cid: "bafy-voice" });
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafy-proof" });

    const result = await executeCommitmentQueueJob("job-evidence", job(), 42161, {} as never);

    expect(result).toEqual({ status: "complete", txHash: "0xabc" });
    // The document names every piece by its own CID and carries the words.
    expect(mocks.uploadJSONToIPFS).toHaveBeenCalledWith(
      {
        version: 1,
        note: "Beds cleared",
        links: [{ url: "https://example.org/before" }],
        media: [{ cid: "bafy-photo", mime: "image/jpeg", kind: "photo" }],
        audio: [{ cid: "bafy-voice", mime: "audio/webm" }],
      },
      expect.objectContaining({ gardenAddress: GARDEN })
    );
    // The CID landed in storage before the chain was touched.
    const stored = store.get("job-evidence") as { payload: { cid: string } };
    expect(stored.payload.cid).toBe("bafy-proof");
    // And the send carries that CID with the credited people, untouched.
    const sent = mocks.executeCommitmentJob.mock.calls[0]?.[0] as {
      payload: { cid: string; creditedContributors: string[] };
    };
    expect(sent.payload.cid).toBe("bafy-proof");
    expect(sent.payload.creditedContributors).toEqual([HOLDER]);
  });

  it("leaves the job waiting, not terminal, when an upload fails", async () => {
    images.set("job-evidence", [{ id: "img-1", file: photo, url: "blob:photo" }]);
    mocks.uploadFileToIPFS.mockRejectedValue(new Error("gateway down"));

    const result = await executeCommitmentQueueJob("job-evidence", job(), 42161, {} as never);

    expect(result).toEqual({ status: "waiting", reason: "evidence-unpublished" });
    expect(mocks.executeCommitmentJob).not.toHaveBeenCalled();
    expect(
      (store.get("job-evidence") as { meta: { evidenceAttempts: number } }).meta.evidenceAttempts
    ).toBe(1);
  });

  it("gives up only after as many tries as any other job gets", async () => {
    mocks.uploadJSONToIPFS.mockRejectedValue(new Error("gateway down"));

    const result = await executeCommitmentQueueJob(
      "job-evidence",
      job({ meta: { evidenceAttempts: 4 } }),
      42161,
      {} as never
    );

    expect(result).toEqual({ status: "unavailable", reason: "evidence-unavailable" });
  });

  it("does not publish twice: a job that already holds its CID goes straight to the send", async () => {
    await executeCommitmentQueueJob(
      "job-evidence",
      job({ payload: { cid: "bafy-already" } }),
      42161,
      {} as never
    );

    expect(mocks.uploadFileToIPFS).not.toHaveBeenCalled();
    expect(mocks.uploadJSONToIPFS).not.toHaveBeenCalled();
    expect(mocks.executeCommitmentJob).toHaveBeenCalledTimes(1);
  });

  it("survives a restart between publish and send: the re-read job carries the CID", async () => {
    mocks.uploadJSONToIPFS.mockResolvedValue({ cid: "bafy-proof" });
    mocks.executeCommitmentJob.mockRejectedValueOnce(new Error("wallet closed"));

    await executeCommitmentQueueJob("job-evidence", job(), 42161, {} as never).catch(() => {});
    const reread = store.get("job-evidence") as never;

    mocks.executeCommitmentJob.mockResolvedValue({ status: "sent", txHash: "0xdef" });
    await executeCommitmentQueueJob("job-evidence", reread, 42161, {} as never);

    expect(mocks.uploadJSONToIPFS).toHaveBeenCalledTimes(1);
    const sent = mocks.executeCommitmentJob.mock.calls[1]?.[0] as { payload: { cid: string } };
    expect(sent.payload.cid).toBe("bafy-proof");
  });
});
