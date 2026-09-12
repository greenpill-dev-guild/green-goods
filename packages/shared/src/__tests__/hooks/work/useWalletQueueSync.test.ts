/**
 * @vitest-environment jsdom
 *
 * Wallet queue sync: one sequential routine that reconciles known broadcasts
 * and then sends unsent work in a single batched signature on reconnect.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, QueueEvent } from "../../../types/job-queue";
import { createFakeJobQueueHandle } from "../../test-utils/job-queue-fakes";

const mockSyncQueuedWorkBatch = vi.fn();
vi.mock("../../../hooks/work/useBatchWorkSync", () => ({
  syncQueuedWorkBatch: (...args: unknown[]) => mockSyncQueuedWorkBatch(...args),
}));

const mockToasts = { syncSuccess: vi.fn(), walletSendFailed: vi.fn() };
vi.mock("../../../components/toast", () => ({
  createQueueToasts: () => mockToasts,
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../modules/job-queue/event-bus", () => ({
  jobQueueEventBus: { emit: vi.fn() },
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { useWalletQueueSync } from "../../../hooks/work/useWalletQueueSync";
import { trackContractError } from "../../../modules/app/error-tracking";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";

const USER = "0x1234567890123456789012345678901234567890" as const;
const walletSender = {
  sendContractCall: vi.fn(),
  supportsSponsorship: false,
  supportsBatching: false,
  authMode: "wallet" as const,
};

function workJob(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    kind: "work",
    chainId: 11155111,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", title: "Plant" },
    createdAt: Date.now(),
    attempts: 0,
    synced: false,
    userAddress: USER,
    ...overrides,
  } as Job;
}

const unsentJob = workJob("unsent-1");
const broadcastJob = workJob("broadcast-1", {
  payload: {
    actionUID: 1,
    gardenAddress: "0xgarden",
    feedback: "",
    title: "Plant",
    uploadCheckpoint: {
      submittedAt: "2026-09-11T00:00:00Z",
      files: {},
      transactionHash: `0x${"ab".repeat(32)}`,
    },
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(IntlProvider, { locale: "en", messages: {}, children });
}

describe("useWalletQueueSync", () => {
  const queue = createFakeJobQueueHandle();
  const queueListeners = new Set<(event: QueueEvent) => void>();
  const backgroundListeners = new Set<() => void>();
  const refreshStats = vi.fn().mockResolvedValue(undefined);

  const render = (options: Partial<Parameters<typeof useWalletQueueSync>[0]> = {}) =>
    renderHook(
      () =>
        useWalletQueueSync({
          queue,
          sender: walletSender,
          authMode: "wallet",
          walletConnected: true,
          userAddress: USER,
          refreshStats,
          ...options,
        }),
      { wrapper }
    );

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
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
    mockSyncQueuedWorkBatch.mockResolvedValue({ count: 1, gardens: ["0xgarden"] });
  });

  it("sends unsent work in one batch when the app comes back online", async () => {
    render();
    await waitFor(() => {
      expect(queue.getJobs).toHaveBeenCalledWith(USER, { kind: "work", synced: false });
    });
    expect(mockSyncQueuedWorkBatch).not.toHaveBeenCalled();

    vi.mocked(queue.getJobs).mockResolvedValue([unsentJob]);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledWith(USER, 11155111);
    });
    expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);
    expect(mockToasts.syncSuccess).toHaveBeenCalledWith(1);
    expect(refreshStats).toHaveBeenCalled();
  });

  it("reconciles a known broadcast before the batch, inside the same pass", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([broadcastJob, unsentJob]);

    render();
    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);
    });

    expect(queue.processJob).toHaveBeenCalledWith("broadcast-1", {
      transactionSender: walletSender,
    });
    expect(queue.processJob).not.toHaveBeenCalledWith("unsent-1", expect.anything());
    expect(vi.mocked(queue.processJob).mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncQueuedWorkBatch.mock.invocationCallOrder[0]!
    );
  });

  it("never runs two passes at once and serves a reconnect that arrives mid-pass once", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([unsentJob]);
    const firstBatch = deferred<{ count: number; gardens: string[] }>();
    mockSyncQueuedWorkBatch
      .mockReturnValueOnce(firstBatch.promise)
      .mockResolvedValue({ count: 1, gardens: ["0xgarden"] });

    render();
    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstBatch.resolve({ count: 1, gardens: ["0xgarden"] });
    });
    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(2);
  });

  it("keeps reconciling broadcasts while the wallet is disconnected but sends nothing", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([broadcastJob, unsentJob]);

    render({ walletConnected: false });
    await waitFor(() => {
      expect(queue.processJob).toHaveBeenCalledWith("broadcast-1", {
        transactionSender: walletSender,
      });
    });

    expect(mockSyncQueuedWorkBatch).not.toHaveBeenCalled();
  });

  it("only reconciles on queue events, and sends again on a background sync request", async () => {
    render();
    await waitFor(() => {
      expect(queue.getJobs).toHaveBeenCalled();
    });
    vi.mocked(queue.getJobs).mockResolvedValue([broadcastJob, unsentJob]);

    await act(async () => {
      queueListeners.forEach((listener) =>
        listener({ type: "job_added", jobId: "unsent-1", job: unsentJob })
      );
    });
    await waitFor(() => {
      expect(queue.processJob).toHaveBeenCalledWith("broadcast-1", expect.anything());
    });
    expect(mockSyncQueuedWorkBatch).not.toHaveBeenCalled();

    await act(async () => {
      backgroundListeners.forEach((listener) => listener());
    });
    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);
    });
  });

  it("reports a failed send with wallet copy and leaves the queue for the manual control", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([unsentJob]);
    mockSyncQueuedWorkBatch.mockRejectedValueOnce(
      new Error("Wallet not connected. Please connect your wallet and try again.")
    );

    render();
    await waitFor(() => {
      expect(mockToasts.walletSendFailed).toHaveBeenCalled();
    });

    expect(trackContractError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: "useWalletQueueSync" })
    );
    expect(queue.discardJob).not.toHaveBeenCalled();
    expect(queue.retryJob).not.toHaveBeenCalled();
    expect(jobQueueEventBus.emit).toHaveBeenCalledWith("queue:sync-completed", {
      result: { processed: 0, failed: 1, skipped: 0 },
    });
  });

  it("stays quiet when the wallet user rejects the send", async () => {
    vi.mocked(queue.getJobs).mockResolvedValue([unsentJob]);
    mockSyncQueuedWorkBatch.mockRejectedValueOnce(new Error("User rejected the request"));

    render();
    await waitFor(() => {
      expect(mockSyncQueuedWorkBatch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(refreshStats).toHaveBeenCalled();
    });

    expect(mockToasts.walletSendFailed).not.toHaveBeenCalled();
    expect(trackContractError).not.toHaveBeenCalled();
  });

  it("ends the reconnect sync for a wallet user with nothing to send, and not for a passkey user", async () => {
    render();
    await waitFor(() => {
      expect(refreshStats).toHaveBeenCalled();
    });
    expect(jobQueueEventBus.emit).toHaveBeenCalledWith("queue:sync-completed", {
      result: { processed: 0, failed: 0, skipped: 0 },
    });

    vi.mocked(jobQueueEventBus.emit).mockClear();
    render({ authMode: "passkey", walletConnected: false });
    await waitFor(() => {
      expect(refreshStats).toHaveBeenCalledTimes(2);
    });
    expect(jobQueueEventBus.emit).not.toHaveBeenCalled();
  });
});
