/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import {
  mergeUploadProgress,
  prepareQueuedJob,
  type PrepareQueuedJobDependencies,
} from "../../../modules/work/prepare-queued-work";
import { SimulationRejected } from "../../../modules/work/simulation-rejected";
import type { Job } from "../../../types/job-queue";

vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: {} }));
vi.mock("../../../modules/job-queue/job-media-conversion", () => ({
  convertQueuedHeicMedia: vi.fn(),
}));

const NOW = Date.parse("2026-09-17T10:00:00.000Z");
const CHECKED_AT = new Date(NOW).toISOString();
const CLAIM = { token: "claim-token" };
const GARDEN = "0x2222222222222222222222222222222222222222";
const USER = "0x1111111111111111111111111111111111111111";

function queuedWork(overrides: Partial<Job> = {}): Job {
  return {
    id: "work-1",
    kind: "work",
    chainId: 42161,
    userAddress: USER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    payload: { actionUID: 3, gardenAddress: GARDEN, feedback: "Weeded", clientWorkId: "client-1" },
    ...overrides,
  } as Job;
}

function queuedDecision(): Job {
  return {
    id: "decision-1",
    kind: "approval",
    chainId: 42161,
    userAddress: USER,
    createdAt: 1,
    attempts: 0,
    synced: false,
    payload: {
      actionUID: 3,
      workUID: `0x${"44".repeat(32)}`,
      gardenAddress: GARDEN,
      gardenerAddress: USER,
      approved: true,
      confidence: 2,
      verificationMethod: 1,
    },
  } as Job;
}

function dependencies(overrides: Partial<PrepareQueuedJobDependencies> = {}) {
  const saved: Job[] = [];
  const deps = {
    now: () => NOW,
    convertMedia: vi.fn().mockResolvedValue({ status: "ready" }),
    images: vi.fn().mockResolvedValue([]),
    resolveTitle: vi.fn().mockResolvedValue("Weeding"),
    simulateWork: vi.fn().mockResolvedValue(undefined),
    simulateApproval: vi.fn().mockResolvedValue(undefined),
    encodeWork: vi.fn().mockResolvedValue(`0x${"ab".repeat(32)}`),
    // Storage is a copy of the job the test holds; each save amends that copy.
    save: vi.fn(async (_claim, _id, amend: (stored: Job) => void) => {
      const stored = structuredClone(saved.at(-1) ?? ({ meta: {}, payload: {} } as Job));
      amend(stored);
      saved.push(stored);
    }),
    ...overrides,
  };
  return { deps: deps as unknown as Partial<PrepareQueuedJobDependencies>, raw: deps, saved };
}

describe("preparing a queued item for Upload all", () => {
  it("prepares a decision by simulating it, and signs nothing", async () => {
    const decision = queuedDecision();
    const { deps, raw } = dependencies();

    await expect(prepareQueuedJob(decision, 42161, CLAIM, deps)).resolves.toBe("ready");

    expect(raw.simulateApproval).toHaveBeenCalledWith({
      draft: expect.objectContaining({ workUID: `0x${"44".repeat(32)}`, approved: true }),
      gardenAddress: GARDEN,
      chainId: 42161,
      accountAddress: USER,
    });
    expect(decision.meta?.preparation).toEqual({ status: "ready", checkedAt: CHECKED_AT });
  });

  it("prepares work: converts, titles, simulates, uploads, then records ready", async () => {
    const work = queuedWork({
      meta: { waitingReason: "photo-conversion-pending", waitingForDependency: true },
    });
    const { deps, raw } = dependencies();

    await expect(prepareQueuedJob(work, 42161, CLAIM, deps)).resolves.toBe("ready");

    expect(raw.convertMedia).toHaveBeenCalledWith(work);
    expect(raw.simulateWork).toHaveBeenCalledWith(
      expect.objectContaining({ actionTitle: "Weeding", accountAddress: USER, chainId: 42161 })
    );
    expect(raw.encodeWork).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Weeding", feedback: "Weeded" }),
      42161,
      expect.objectContaining({ clientWorkId: "client-1", gardenAddress: GARDEN })
    );
    // The new answer replaces the wait an earlier send attempt recorded.
    expect(work.meta).toEqual({ preparation: { status: "ready", checkedAt: CHECKED_AT } });
  });

  it("records a photo still waiting for the decoder without simulating or uploading", async () => {
    const work = queuedWork();
    const { deps, raw } = dependencies({
      convertMedia: vi.fn().mockResolvedValue({ status: "pending" }),
    });

    await expect(prepareQueuedJob(work, 42161, CLAIM, deps)).resolves.toBe("photo-pending");
    expect(raw.simulateWork).not.toHaveBeenCalled();
    expect(raw.encodeWork).not.toHaveBeenCalled();
  });

  it("blocks work the chain would refuse, with the reason, before uploading anything", async () => {
    const work = queuedWork();
    const { deps, raw } = dependencies({
      simulateWork: vi
        .fn()
        .mockRejectedValue(new SimulationRejected("Action ended", "ActionExpired", true)),
    });

    await expect(prepareQueuedJob(work, 42161, CLAIM, deps)).resolves.toBe("blocked");
    expect(work.meta?.preparation).toEqual({
      status: "blocked",
      reason: "ActionExpired",
      checkedAt: CHECKED_AT,
    });
    expect(raw.encodeWork).not.toHaveBeenCalled();
  });

  it("tries again later when the chain's answer or an upload never arrived", async () => {
    const lost = dependencies({
      simulateWork: vi
        .fn()
        .mockRejectedValue(new SimulationRejected("Check failed", "unknown", false)),
    });
    const upload = dependencies({
      encodeWork: vi.fn().mockRejectedValue(new Error("fetch failed")),
    });

    await expect(prepareQueuedJob(queuedWork(), 42161, CLAIM, lost.deps)).resolves.toBe(
      "retry-later"
    );
    await expect(prepareQueuedJob(queuedWork(), 42161, CLAIM, upload.deps)).resolves.toBe(
      "retry-later"
    );
    expect(lost.saved).toHaveLength(0);
  });

  it("never prepares a job that was sent or used up its retries", async () => {
    const { deps, raw } = dependencies();
    const sent = queuedWork({
      payload: {
        actionUID: 3,
        gardenAddress: GARDEN,
        feedback: "",
        uploadCheckpoint: { submittedAt: "", files: {}, broadcastPending: true },
      },
    });
    const retired = queuedWork({ attempts: 5, lastError: "Max retries (5) exceeded" });

    await expect(prepareQueuedJob(sent, 42161, CLAIM, deps)).resolves.toBe("skipped");
    await expect(prepareQueuedJob(retired, 42161, CLAIM, deps)).resolves.toBe("skipped");
    expect(raw.convertMedia).not.toHaveBeenCalled();
  });

  it("stops when another holder takes the job", async () => {
    const { deps } = dependencies({
      save: vi.fn().mockRejectedValue(new Error("submission-ownership-changed")),
    });

    await expect(prepareQueuedJob(queuedDecision(), 42161, CLAIM, deps)).resolves.toBe("skipped");
  });

  it("saves upload progress without copying a send from memory over what storage recorded", () => {
    const progress = {
      submittedAt: "2026-09-17T09:00:00.000Z",
      files: { photo: { attachmentId: "a", contentHash: "photo", cid: "bafy-photo" } },
      metadata: { contentHash: "meta", cid: "bafy-meta" },
      broadcastPending: true,
    };
    const stored = {
      submittedAt: "2026-09-16T09:00:00.000Z",
      files: { older: { attachmentId: "b", contentHash: "older", cid: "bafy-older" } },
      transactionHash: `0x${"cd".repeat(32)}` as const,
    };

    expect(mergeUploadProgress(stored, progress)).toEqual({
      ...stored,
      files: { ...stored.files, ...progress.files },
      metadata: progress.metadata,
    });
    // With nothing stored yet, only the uploads are kept.
    expect(mergeUploadProgress(undefined, progress)).toEqual({
      submittedAt: progress.submittedAt,
      files: progress.files,
      metadata: progress.metadata,
    });
  });
});
