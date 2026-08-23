/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canManageGarden: vi.fn(),
  isUserAddress: vi.fn(),
  navigateToTop: vi.fn(),
  userId: "0x1111111111111111111111111111111111111111" as string | undefined,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  downloadWorkData: vi.fn(),
  downloadWorkMedia: vi.fn(),
  isUserAddress: (...args: unknown[]) => mocks.isUserAddress(...args),
  isValidAttestationId: () => false,
  jobQueue: { processJob: vi.fn() },
  openEASExplorer: vi.fn(),
  queryKeys: {
    works: {
      merged: (...args: unknown[]) => ["works", "merged", ...args],
      offline: (...args: unknown[]) => ["works", "offline", ...args],
    },
  },
  shareWork: vi.fn(),
  toastService: { error: vi.fn(), success: vi.fn() },
  useActions: () => ({ data: [] }),
  useGardenPermissions: () => ({ canManageGarden: mocks.canManageGarden }),
  useGardens: () => ({
    data: [{ id: "garden-1" }],
    isLoading: false,
  }),
  useNavigateToTop: () => mocks.navigateToTop,
  useOffline: () => ({ isOnline: true }),
  useTransactionSender: () => null,
  useUser: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
  useWorkApprovalActions: ({ viewingMode }: { viewingMode: string }) => ({ viewingMode }),
  useWorkMetadata: () => ({
    error: null,
    metadata: null,
    retryFetch: vi.fn(),
    status: "idle",
  }),
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
    mocks.canManageGarden.mockReturnValue(false);
    mocks.isUserAddress.mockReturnValue(false);
  });

  it("projects operator, gardener, and viewer modes with operator precedence", () => {
    mocks.canManageGarden.mockReturnValue(true);
    mocks.isUserAddress.mockReturnValue(true);
    const operator = renderHook(() => useWorkDetailController(), { wrapper: RouterWrapper });
    expect(operator.result.current.viewingMode).toBe("operator");
    operator.unmount();

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
});
