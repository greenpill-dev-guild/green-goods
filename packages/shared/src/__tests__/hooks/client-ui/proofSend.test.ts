/**
 * A proof's send after the proof screens are gone: following one the background
 * flush sends (one outcome per job, read from the queue's own events and record),
 * and telling its promise that it is on its way.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proofContentsOf } from "../../../hooks/client-ui/commitment/proofContents";
import {
  followBackgroundProof,
  proofSendKey,
  settleProofSend,
  startProofSend,
  useProofSend,
} from "../../../hooks/client-ui/commitment/proofSend";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Job } from "../../../types/job-queue";

const mocks = vi.hoisted(() => ({ getJobs: vi.fn(async () => [] as Job[]) }));
vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { getJobs: mocks.getJobs },
}));

const OWNER = "0x1111111111111111111111111111111111111111";

function proofJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    kind: "evidence",
    payload: { commitmentId: 9n, clientEvidenceId: "proof-1" },
    meta: {},
    chainId: 42161,
    userAddress: OWNER,
    createdAt: 1,
    attempts: 1,
    synced: false,
    ...overrides,
  } as Job;
}

describe("followBackgroundProof", () => {
  const onEnd = vi.fn();
  let stop: () => void = () => undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stop = followBackgroundProof({ jobId: "job-1", owner: OWNER, onEnd, followForMs: 1_000 });
  });
  afterEach(() => stop());

  it.each([
    ["landed", "job:completed", proofJob()],
    // A declined prompt fails the attempt but marks the job for the person's own send.
    ["declined", "job:failed", proofJob({ meta: { requiresExplicitSend: true } })],
    ["failed", "job:failed", proofJob()],
  ] as const)("says %s once, and only for its own job", (outcome, event, job) => {
    jobQueueEventBus.emit(event, {
      jobId: "other",
      job: { ...job, id: "other" },
      txHash: "0x1",
      error: "x",
    } as never);
    expect(onEnd).not.toHaveBeenCalled();

    jobQueueEventBus.emit(event, { jobId: "job-1", job, txHash: "0x1", error: "x" } as never);
    jobQueueEventBus.emit("job:completed", { jobId: "job-1", job, txHash: "0x1" });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(outcome);
  });

  it("waits for a flush that picked the job up before reading what it left", async () => {
    mocks.getJobs.mockResolvedValue([proofJob({ meta: { requiresExplicitSend: true } })]);
    // A flush that started before the proof was queued never saw it.
    jobQueueEventBus.emit("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 0 },
    });
    await Promise.resolve();
    expect(onEnd).not.toHaveBeenCalled();

    jobQueueEventBus.emit("job:processing", { jobId: "job-1", job: proofJob() });
    jobQueueEventBus.emit("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 1 },
    });
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalledWith("declined"));
  });

  it("hands over to the promise's own notice when no answer comes", () => {
    vi.useFakeTimers();
    stop();
    stop = followBackgroundProof({ jobId: "job-1", owner: OWNER, onEnd, followForMs: 1_000 });
    vi.advanceTimersByTime(1_000);
    expect(onEnd).toHaveBeenCalledWith("undecided");
    vi.useRealTimers();
  });
});

describe("a proof on its way", () => {
  const key = proofSendKey(42161, 9n);
  const contents = proofContentsOf({
    media: [new File(["a"], "a.jpg", { type: "image/jpeg" })],
    audioNotes: [new File(["b"], "b.webm", { type: "audio/webm" })],
    links: ["https://example.org/receipt"],
    note: "  ",
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => settleProofSend(key, { landed: false }));
  });

  it("counts what the proof carries", () => {
    expect(contents).toEqual({ photos: 1, videos: 0, voiceNotes: 1, links: 1, words: false });
  });

  it("tells the promise while the send runs, and clears when it ends without landing", () => {
    const { result } = renderHook(() => useProofSend(key));
    expect(result.current).toBeNull();

    act(() => startProofSend(key, { contents, baseline: 0 }));
    expect(result.current).toEqual({ contents, baseline: 0, landed: false });

    act(() => settleProofSend(key, { landed: false }));
    expect(result.current).toBeNull();
  });

  it("keeps a landed proof until the record can catch up, then lets go", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useProofSend(key));
    act(() => startProofSend(key, { contents, baseline: 2 }));
    act(() => settleProofSend(key, { landed: true }));
    expect(result.current).toMatchObject({ baseline: 2, landed: true });

    act(() => vi.advanceTimersByTime(120_000));
    expect(result.current).toBeNull();
  });
});
