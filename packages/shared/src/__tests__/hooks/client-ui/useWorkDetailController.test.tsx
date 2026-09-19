/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canManageGarden: vi.fn(),
  isUserAddress: vi.fn(),
  navigateToTop: vi.fn(),
  approvalParams: null as null | {
    onApprovalComplete?: (gardenId: string) => void;
    viewingMode: string;
  },
  userId: "0x1111111111111111111111111111111111111111" as string | undefined,
  sender: null as null | { authMode: string },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../utils/work/workActions", () => ({
  downloadWorkData: vi.fn(),
  downloadWorkMedia: vi.fn(),
  shareWork: vi.fn(),
}));

vi.mock("../../../utils/blockchain/address", () => ({
  isUserAddress: (...args: unknown[]) => mocks.isUserAddress(...args),
}));

vi.mock("../../../utils/eas/explorers", () => ({
  isValidAttestationId: () => false,
  openEASExplorer: vi.fn(),
}));

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { processJob: vi.fn(), retryJob: vi.fn() },
}));

vi.mock("../../../config/query-keys/work", () => ({
  worksKeys: {
    merged: (...args: unknown[]) => ["works", "merged", ...args],
    offline: (...args: unknown[]) => ["works", "offline", ...args],
  },
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
  useGardens: () => ({
    data: [{ id: "garden-1" }],
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canManageGarden: mocks.canManageGarden }),
}));

vi.mock("../../../hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => mocks.navigateToTop,
}));

vi.mock("../../../hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mocks.sender,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
}));

vi.mock("../../../hooks/work/useWorkApprovalActions", () => ({
  useWorkApprovalActions: (params: {
    onApprovalComplete?: (gardenId: string) => void;
    viewingMode: string;
  }) => {
    mocks.approvalParams = params;
    return { viewingMode: params.viewingMode };
  },
}));

vi.mock("../../../hooks/work/useWorkMetadata", () => ({
  useWorkMetadata: () => ({
    error: null,
    metadata: null,
    retryFetch: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: () => ({
    works: [
      {
        actionUID: "action-1",
        createdAt: 1,
        gardenerAddress: "0x2222222222222222222222222222222222222222",
        id: "work-1",
        media: [],
        status: "pending",
      },
    ],
  }),
}));

import { useWorkDetailController } from "../../../hooks/client-ui/work/useWorkDetailController";

function RouterWrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/home/garden-1/work/work-1"] },
    createElement(
      IntlProvider,
      { locale: "en", messages: {} },
      createElement(
        Routes,
        null,
        createElement(Route, { path: "/home/:id/work/:workId", element: children })
      )
    )
  );
}

describe("useWorkDetailController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = "0x1111111111111111111111111111111111111111";
    mocks.approvalParams = null;
    mocks.canManageGarden.mockReturnValue(false);
    mocks.isUserAddress.mockReturnValue(false);
    mocks.sender = null;
  });

  it("sends explicitly from Upload now and stays quiet when the prompt is declined", async () => {
    mocks.sender = { authMode: "passkey" };
    const { jobQueue } = await import("../../../modules/job-queue/default-instance");
    const { toastService } = await import("../../../components/Toast/toast.service");
    vi.mocked(jobQueue.processJob).mockResolvedValue({
      success: false,
      error: "send-cancelled",
      skipped: true,
    });
    const { result } = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });

    await act(async () => {
      await result.current.retry();
    });

    // Cleared first, so the queue does not refuse a reverted or retired work.
    expect(jobQueue.retryJob).toHaveBeenCalledWith("work-1");
    expect(jobQueue.processJob).toHaveBeenCalledWith("work-1", {
      transactionSender: mocks.sender,
      explicit: true,
    });
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it("checks the connection on Upload now and says nothing was sent when it is not confirmed", async () => {
    mocks.sender = { authMode: "passkey" };
    const { jobQueue } = await import("../../../modules/job-queue/default-instance");
    const { toastService } = await import("../../../components/Toast/toast.service");
    const { connectivityStore } = await import("../../../stores/connectivity");
    const confirm = vi.spyOn(connectivityStore, "confirmOnline").mockResolvedValue(false);
    const notSent = expect.objectContaining({
      title: "app.offline.degraded",
      message: "app.work.connectionUnconfirmed",
    });
    try {
      const { result } = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });

      await act(async () => {
        await result.current.retry();
      });
      expect(jobQueue.processJob).not.toHaveBeenCalled();
      expect(toastService.info).toHaveBeenCalledWith(notSent);

      // The queue can still refuse if the connection drops between the check and the send.
      confirm.mockResolvedValue(true);
      vi.mocked(jobQueue.processJob).mockResolvedValue({
        success: false,
        error: "connection-unconfirmed",
        skipped: true,
      });
      await act(async () => {
        await result.current.retry();
      });
      expect(toastService.info).toHaveBeenCalledTimes(2);
      expect(toastService.info).toHaveBeenLastCalledWith(notSent);
      expect(toastService.error).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("projects steward, gardener, and viewer modes with steward precedence", () => {
    mocks.canManageGarden.mockReturnValue(true);
    mocks.isUserAddress.mockReturnValue(true);
    const steward = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });
    expect(steward.result.current.viewingMode).toBe("steward");
    steward.unmount();

    mocks.canManageGarden.mockReturnValue(false);
    const gardener = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });
    expect(gardener.result.current.viewingMode).toBe("gardener");
    gardener.unmount();

    mocks.isUserAddress.mockReturnValue(false);
    const viewer = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });
    expect(viewer.result.current.viewingMode).toBe("viewer");
  });

  it("owns the route fallback for back navigation", () => {
    const { result } = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });

    result.current.back();

    expect(mocks.navigateToTop).toHaveBeenCalledWith("/home/garden-1");
  });

  it("uses the garden route as the final approval navigation", () => {
    renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });

    mocks.approvalParams?.onApprovalComplete?.("garden-1");

    expect(mocks.navigateToTop).toHaveBeenCalledWith("/home/garden-1");
  });
});
