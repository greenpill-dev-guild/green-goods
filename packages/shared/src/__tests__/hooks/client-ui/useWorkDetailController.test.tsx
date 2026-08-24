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
  jobQueue: { processJob: vi.fn() },
}));

vi.mock("../../../config/query-keys/work", () => ({
  worksKeys: {
    merged: (...args: unknown[]) => ["works", "merged", ...args],
    offline: (...args: unknown[]) => ["works", "offline", ...args],
  },
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: vi.fn(), success: vi.fn() },
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

vi.mock("../../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: true }),
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => null,
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
}));

vi.mock("../../../hooks/work/useWorkApprovalActions", () => ({
  useWorkApprovalActions: ({ viewingMode }: { viewingMode: string }) => ({ viewingMode }),
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
