/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../../../types/job-queue";

const mocks = vi.hoisted(() => ({
  jobs: [] as unknown[],
  sender: { authMode: "passkey" } as unknown,
  uploadQueuedWork: vi.fn(),
  createPorts: vi.fn(async () => ({ ports: true })),
  schedule: vi.fn(),
  prepareNow: vi.fn(),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  preparation: {
    activeJobId: null as string | null,
    paused: null as string | null,
    dataSaverOverride: false,
  },
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1111111111111111111111111111111111111111",
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));
vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../../components/toast", () => ({ toastService: mocks.toast }));
vi.mock("../../../modules/job-queue/db", () => ({
  jobQueueDB: {
    observeJobs: () => ({
      subscribe: (observer: { next?: (jobs: unknown[]) => void }) => {
        observer.next?.(mocks.jobs);
        return { unsubscribe: () => undefined };
      },
    }),
  },
}));
vi.mock("../../../modules/work/upload-preparation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/work/upload-preparation")>()),
  scheduleUploadPreparation: mocks.schedule,
  prepareUploadsNow: mocks.prepareNow,
  uploadPreparationStore: {
    getSnapshot: () => mocks.preparation,
    subscribe: () => () => undefined,
  },
}));
vi.mock("../../../modules/work/upload-queued-work", () => ({
  uploadQueuedWork: mocks.uploadQueuedWork,
}));
vi.mock("../../../modules/work/upload-queued-work-defaults", () => ({
  createDefaultUploadQueuedWorkPorts: mocks.createPorts,
}));

import { useWorkUploads } from "../../../hooks/work/useWorkUploads";
import en from "../../../i18n/en.json";
import { connectivityStore } from "../../../stores/connectivity";

const CHECKED = "2026-09-17T10:00:00.000Z";
const WORK_UID = `0x${"AB".repeat(32)}`;

function queued(kind: string, meta: Job["meta"], payload: Record<string, unknown> = {}): Job {
  return {
    id: `${kind}-${Math.random()}`,
    kind,
    chainId: 42161,
    payload: { actionUID: 1, gardenAddress: "0xgarden", feedback: "", ...payload },
    meta,
    createdAt: 1,
    attempts: 0,
    synced: false,
    userAddress: "0x1111111111111111111111111111111111111111",
  } as Job;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return createElement(
    IntlProvider,
    { locale: "en", messages: en },
    createElement(QueryClientProvider, { client }, children)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sender = { authMode: "passkey" };
  mocks.jobs = [];
  mocks.preparation = { activeJobId: null, paused: null, dataSaverOverride: false };
});

describe("useWorkUploads", () => {
  it("counts what is ready, still preparing, or needs attention, and the decisions still waiting", async () => {
    mocks.jobs = [
      queued("work", { preparation: { status: "ready", checkedAt: CHECKED } }),
      queued(
        "approval",
        { preparation: { status: "ready", checkedAt: CHECKED } },
        { workUID: WORK_UID }
      ),
      queued("work", {}),
      queued("work", { preparation: { status: "photo-pending", checkedAt: CHECKED } }),
      queued("work", {
        preparation: { status: "blocked", reason: "ActionExpired", checkedAt: CHECKED },
      }),
      // Sent items are confirmed by the queue and no longer wait for an upload.
      queued(
        "work",
        {},
        { uploadCheckpoint: { submittedAt: "", files: {}, broadcastPending: true } }
      ),
      // Commitment acts send on their own.
      queued("claim", {}),
    ];

    const { result } = renderHook(() => useWorkUploads(), { wrapper });

    await waitFor(() => expect(result.current.queuedCount).toBe(5));
    expect(result.current.readyCount).toBe(2);
    expect(result.current.preparingCount).toBe(2);
    expect(result.current.attentionCount).toBe(1);
    expect(result.current.waitingDecisionWorkIds.has(WORK_UID.toLowerCase())).toBe(true);
  });

  it("says preparation runs only when it is not waiting for the connection or Data Saver", async () => {
    mocks.jobs = [queued("work", {})];
    const render = (paused: string | null) => {
      mocks.preparation = { activeJobId: null, paused, dataSaverOverride: false };
      return renderHook(() => useWorkUploads(), { wrapper }).result;
    };

    const running = render(null);
    await waitFor(() => expect(running.current.preparingCount).toBe(1));
    expect(running.current.isPreparing).toBe(true);
    expect(running.current.pausedForDataSaver).toBe(false);

    const unconfirmed = render("unconfirmed");
    await waitFor(() => expect(unconfirmed.current.preparingCount).toBe(1));
    expect(unconfirmed.current.isPreparing).toBe(false);

    const dataSaver = render("data-saver");
    await waitFor(() => expect(dataSaver.current.preparingCount).toBe(1));
    expect(dataSaver.current.isPreparing).toBe(false);
    expect(dataSaver.current.pausedForDataSaver).toBe(true);
  });

  it("says nothing is preparing while the connection is down, even before preparation has loaded", async () => {
    mocks.jobs = [queued("work", {})];
    for (const state of ["offline", "degraded"] as const) {
      const snapshot = { state };
      const status = vi.spyOn(connectivityStore, "getStatusSnapshot").mockReturnValue(snapshot);
      try {
        const { result, unmount } = renderHook(() => useWorkUploads(), { wrapper });
        await waitFor(() => expect(result.current.preparingCount).toBe(1));
        expect(result.current.isPreparing).toBe(false);
        unmount();
      } finally {
        status.mockRestore();
      }
    }
  });

  it("says nothing is preparing when every item is ready", async () => {
    mocks.jobs = [queued("work", { preparation: { status: "ready", checkedAt: CHECKED } })];
    const { result } = renderHook(() => useWorkUploads(), { wrapper });
    await waitFor(() => expect(result.current.readyCount).toBe(1));
    expect(result.current.isPreparing).toBe(false);
  });

  it("wakes background preparation when the dashboard opens", () => {
    renderHook(() => useWorkUploads(), { wrapper });
    expect(mocks.schedule).toHaveBeenCalledOnce();
  });

  it("only starts manual preparation on a confirmed connection", async () => {
    const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
    try {
      const { result } = renderHook(() => useWorkUploads(), { wrapper });
      act(() => result.current.prepareNow());
      await waitFor(() => expect(mocks.toast.info).toHaveBeenCalledOnce());
      expect(mocks.prepareNow).not.toHaveBeenCalled();

      confirm.mockResolvedValue(true);
      act(() => result.current.prepareNow());
      await waitFor(() => expect(mocks.prepareNow).toHaveBeenCalledOnce());
    } finally {
      confirm.mockRestore();
    }
  });

  it("uploads with the person's sender and says how many items went", async () => {
    mocks.uploadQueuedWork.mockResolvedValue({ status: "uploaded", sent: 2, flagged: 0 });
    const { result } = renderHook(() => useWorkUploads(), { wrapper });

    await act(async () => {
      await result.current.upload();
    });

    expect(mocks.uploadQueuedWork).toHaveBeenCalledWith(
      {
        userAddress: "0x1111111111111111111111111111111111111111",
        chainId: 42161,
        sender: mocks.sender,
        jobIds: undefined,
      },
      { ports: true }
    );
    expect(mocks.toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Uploaded 2 items", message: "Saved to the garden record." })
    );
  });

  it("reports an upload that stopped unexpectedly instead of swallowing it", async () => {
    const stopped = new Error("submission-ownership-changed");
    mocks.uploadQueuedWork.mockRejectedValue(stopped);
    const { result } = renderHook(() => useWorkUploads(), { wrapper });

    await act(async () => {
      await result.current.upload().catch(() => undefined);
    });

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: en["app.uploads.failedTitle"], error: stopped })
      )
    );
  });

  it("checks the connection before loading the upload modules, which may not be on the device", async () => {
    const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
    try {
      const { result } = renderHook(() => useWorkUploads(), { wrapper });

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.upload();
      });

      expect(outcome).toEqual({ status: "connection-unconfirmed" });
      expect(mocks.createPorts).not.toHaveBeenCalled();
      expect(mocks.uploadQueuedWork).not.toHaveBeenCalled();
      expect(mocks.toast.info).toHaveBeenCalledWith(
        expect.objectContaining({ message: en["app.uploads.connectionUnconfirmed"] })
      );
    } finally {
      confirm.mockRestore();
    }
  });

  it("asks the person to sign in when nothing can sign, and sends nothing", async () => {
    mocks.sender = null;
    const { result } = renderHook(() => useWorkUploads(), { wrapper });

    await act(async () => {
      await result.current.upload();
    });

    expect(mocks.uploadQueuedWork).not.toHaveBeenCalled();
    expect(mocks.toast.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: en["app.uploads.signInToUpload"] })
    );
  });
});
