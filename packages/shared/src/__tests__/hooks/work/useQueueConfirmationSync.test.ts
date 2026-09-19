/**
 * @vitest-environment jsdom
 *
 * Queue confirmation sync: one pass that confirms queued work and decisions
 * that were already sent. Upload all sends; this pass never does.
 */

import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, QueueEvent } from "../../../types/job-queue";
import { createFakeJobQueueHandle } from "../../test-utils/job-queue-fakes";

vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { useQueueConfirmationSync } from "../../../hooks/work/useQueueConfirmationSync";
import { connectivityStore } from "../../../stores/connectivity";

const USER = "0x1234567890123456789012345678901234567890" as const;
const sender = {
  sendContractCall: vi.fn(),
  supportsSponsorship: true,
  supportsBatching: false,
  authMode: "passkey" as const,
};

function queued(id: string, kind: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    kind,
    chainId: 11155111,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", title: "Plant" },
    createdAt: Date.now(),
    attempts: 0,
    synced: false,
    userAddress: USER,
    ...overrides,
  } as Job;
}

const sentWork = queued("sent-work", "work", {
  payload: {
    actionUID: 1,
    gardenAddress: "0xgarden",
    feedback: "",
    uploadCheckpoint: {
      submittedAt: "2026-09-11T00:00:00Z",
      files: {},
      transactionHash: `0x${"ab".repeat(32)}`,
    },
  },
});
const sentDecision = queued("sent-decision", "approval", {
  payload: {
    actionUID: 1,
    workUID: `0x${"44".repeat(32)}`,
    gardenAddress: "0xgarden",
    gardenerAddress: USER,
    approved: true,
    confidence: 2,
    verificationMethod: 1,
    sendCheckpoint: { broadcastPending: true, broadcastPendingAt: "2026-09-11T00:00:00Z" },
  },
});
const unsentWork = queued("unsent-work", "work", {
  meta: { preparation: { status: "ready", checkedAt: "2026-09-11T00:00:00Z" } },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useQueueConfirmationSync", () => {
  const queue = createFakeJobQueueHandle();
  const queueListeners = new Set<(event: QueueEvent) => void>();
  const backgroundListeners = new Set<() => void>();
  const refreshStats = vi.fn().mockResolvedValue(undefined);

  const render = (options: Partial<Parameters<typeof useQueueConfirmationSync>[0]> = {}) =>
    renderHook(() =>
      useQueueConfirmationSync({ queue, sender, userAddress: USER, refreshStats, ...options })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    onlineManager.setOnline(true);
    queueListeners.clear();
    backgroundListeners.clear();
    vi.mocked(queue.getJobs).mockResolvedValue([]);
    vi.mocked(queue.processJob).mockResolvedValue({ success: true });
    vi.mocked(queue.subscribe).mockImplementation((listener) => {
      queueListeners.add(listener);
      return () => queueListeners.delete(listener);
    });
    vi.mocked(queue.onBackgroundSyncRequested).mockImplementation((listener) => {
      backgroundListeners.add(listener);
      return () => backgroundListeners.delete(listener);
    });
  });

  it("confirms sent work and decisions, and never sends what was not sent", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([sentWork, sentDecision, unsentWork]);

    render();

    await waitFor(() => expect(refreshStats).toHaveBeenCalled());
    expect(queue.getJobs).toHaveBeenCalledWith(USER, { synced: false });
    expect(queue.processJob).toHaveBeenCalledWith("sent-work", {
      transactionSender: sender,
      assertOwnership: expect.any(Function),
    });
    expect(queue.processJob).toHaveBeenCalledWith("sent-decision", expect.anything());
    expect(queue.processJob).not.toHaveBeenCalledWith("unsent-work", expect.anything());
    expect(sender.sendContractCall).not.toHaveBeenCalled();
  });

  it("leaves other chains, commitment acts, and reverted work alone", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([
      { ...sentWork, chainId: 1 },
      queued("claim", "claim", { meta: { submittedTxHash: `0x${"cd".repeat(32)}` } }),
      { ...sentWork, id: "reverted", meta: { workTransactionReverted: true } },
    ]);

    render();

    await waitFor(() => expect(refreshStats).toHaveBeenCalled());
    expect(queue.processJob).not.toHaveBeenCalled();
  });

  it("checks again when connectivity returns, on queue events, and on a background sync request", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([sentWork]);
    render();
    await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(1));

    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(2));

    await act(async () => {
      queueListeners.forEach((listener) => listener({ type: "job_added", jobId: "x" }));
    });
    await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(3));

    await act(async () => {
      backgroundListeners.forEach((listener) => listener());
    });
    await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(4));
  });

  it("checks again when an unstable connection recovers, but not on every probe answer", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([sentWork]);
    const status = vi
      .spyOn(connectivityStore, "getStatusSnapshot")
      .mockReturnValue({ state: "online" });
    try {
      render();
      await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(1));

      await act(() => connectivityStore.check());
      expect(queue.processJob).toHaveBeenCalledTimes(1);

      status.mockReturnValue({ state: "degraded" });
      await act(() => connectivityStore.check());
      status.mockReturnValue({ state: "online", checkedAt: Date.now() });
      await act(() => connectivityStore.check());
      await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(2));
    } finally {
      status.mockRestore();
    }
  });

  it("never runs two passes at once", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([sentWork]);
    const first = deferred<{ success: boolean }>();
    vi.mocked(queue.processJob).mockReturnValueOnce(first.promise);

    render();
    await waitFor(() => expect(queue.processJob).toHaveBeenCalledTimes(1));
    await act(async () => {
      backgroundListeners.forEach((listener) => listener());
      queueListeners.forEach((listener) => listener({ type: "job_added", jobId: "x" }));
    });
    expect(queue.processJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({ success: true });
    });
    await waitFor(() => expect(refreshStats).toHaveBeenCalledOnce());
    expect(queue.processJob).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a sender to confirm with", async () => {
    render({ sender: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queue.getJobs).not.toHaveBeenCalled();
  });
});
