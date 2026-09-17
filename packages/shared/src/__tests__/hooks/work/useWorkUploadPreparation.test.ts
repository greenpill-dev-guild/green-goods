/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const preparation = { schedule: vi.fn(), stop: vi.fn(), suspend: vi.fn(), prepareNow: vi.fn() };
  return {
    preparation,
    createUploadPreparation: vi.fn(() => preparation),
    setActiveUploadPreparation: vi.fn(),
  };
});

vi.mock("../../../modules/work/upload-preparation", () => ({
  createUploadPreparation: mocks.createUploadPreparation,
  setActiveUploadPreparation: mocks.setActiveUploadPreparation,
}));
vi.mock("../../../modules/work/prepare-queued-work", () => ({ prepareQueuedJob: vi.fn() }));
vi.mock("../../../modules/job-queue/stuck-work-recovery", () => ({ recoverStuckWork: vi.fn() }));
vi.mock("../../../modules/job-queue/work-claims", () => ({
  acquireAvailableWorkJobs: vi.fn(),
  holdWorkClaims: vi.fn(),
}));
vi.mock("../../../modules/job-queue/db", () => ({ jobQueueDB: {} }));

import { useWorkUploadPreparation } from "../../../hooks/work/useWorkUploadPreparation";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import { connectivityStore } from "../../../stores/connectivity";

const USER = "0x1111111111111111111111111111111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWorkUploadPreparation", () => {
  it("runs preparation for the signed-in person and wakes it on each trigger", async () => {
    const { unmount } = renderHook(() => useWorkUploadPreparation(USER, 42161));

    await waitFor(() =>
      expect(mocks.setActiveUploadPreparation).toHaveBeenCalledWith(mocks.preparation)
    );
    expect(mocks.createUploadPreparation).toHaveBeenCalledWith(
      expect.objectContaining({ userAddress: USER, chainId: 42161 })
    );
    expect(mocks.preparation.schedule).toHaveBeenCalledTimes(1);

    await act(() => connectivityStore.check());
    expect(mocks.preparation.schedule).toHaveBeenCalledTimes(2);

    act(() => {
      jobQueueEventBus.emit("job:added", { jobId: "work-1", job: {} as never });
    });
    expect(mocks.preparation.schedule).toHaveBeenCalledTimes(3);

    // A return to the page re-checks the connection, which reports on the status channel.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(mocks.preparation.schedule).toHaveBeenCalledTimes(4);

    unmount();
    expect(mocks.preparation.stop).toHaveBeenCalledOnce();
    expect(mocks.setActiveUploadPreparation).toHaveBeenLastCalledWith(undefined);

    // Nothing wakes a stopped preparation.
    act(() => {
      jobQueueEventBus.emit("job:added", { jobId: "work-2", job: {} as never });
    });
    expect(mocks.preparation.schedule).toHaveBeenCalledTimes(4);
  });

  it("loads preparation only once the connection is confirmed", async () => {
    const confirmed = vi.spyOn(connectivityStore, "isConfirmedOnline").mockReturnValue(false);
    try {
      renderHook(() => useWorkUploadPreparation(USER, 42161));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await act(() => connectivityStore.check());
      expect(mocks.createUploadPreparation).not.toHaveBeenCalled();

      confirmed.mockReturnValue(true);
      await act(() => connectivityStore.check());
      await waitFor(() =>
        expect(mocks.setActiveUploadPreparation).toHaveBeenCalledWith(mocks.preparation)
      );
      expect(mocks.createUploadPreparation).toHaveBeenCalledOnce();
    } finally {
      confirmed.mockRestore();
    }
  });

  it("prepares nothing without a signed-in person", async () => {
    renderHook(() => useWorkUploadPreparation(null, 42161));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.createUploadPreparation).not.toHaveBeenCalled();
  });
});
