import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockUseGardens = vi.fn();
const mockUseWorks = vi.fn();
const mockUseUser = vi.fn();
const mockCanManageGarden = vi.fn();
const mockIsUserAddress = vi.fn();
const mockUseWorkApprovalActions = vi.fn();
const mockWorkViewSectionProps: { current: Record<string, unknown> | null } = { current: null };

vi.mock("@green-goods/shared", () => ({
  Confidence: {
    NONE: "NONE",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
  },
  DEFAULT_CHAIN_ID: 11155111,
  VerificationMethod: {
    HUMAN: "HUMAN",
  },
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
  debugWarn: vi.fn(),
  downloadWorkData: vi.fn(),
  downloadWorkMedia: vi.fn(),
  getJsonByHash: vi.fn(),
  isUserAddress: (...args: unknown[]) => mockIsUserAddress(...args),
  isValidAttestationId: vi.fn(() => false),
  jobQueue: { processJob: vi.fn() },
  openEASExplorer: vi.fn(),
  queryKeys: {
    workApprovals: { all: ["workApprovals"] },
    works: {
      merged: () => ["works", "merged"],
      online: () => ["works", "online"],
    },
  },
  shareWork: vi.fn(),
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
  useActions: () => ({ data: [] }),
  useAsyncEffect: vi.fn(),
  useGardenPermissions: () => ({
    canManageGarden: mockCanManageGarden,
  }),
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
  useJobQueueEvents: vi.fn(),
  useNavigateToTop: () => mockNavigate,
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle", refetch: vi.fn() }),
  useTimeout: () => ({
    set: (fn: () => void) => fn,
  }),
  useUser: (...args: unknown[]) => mockUseUser(...args),
  useWorkApproval: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useWorkApprovalActions: (...args: unknown[]) => mockUseWorkApprovalActions(...args),
  useWorkMetadata: () => ({ metadata: null, isLoading: false, error: null, retryFetch: vi.fn() }),
  useWorks: (...args: unknown[]) => mockUseWorks(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/components/Features/Work", () => ({
  WorkViewSkeleton: () => createElement("div", null, "Skeleton"),
}));

vi.mock("@/components/Navigation", () => ({
  TopNav: ({ onBackClick }: { onBackClick?: () => void }) =>
    createElement(
      "button",
      { type: "button", onClick: onBackClick, "data-testid": "work-back" },
      "Back"
    ),
}));

vi.mock("../../views/Home/Garden/WorkViewSection", () => ({
  WorkViewSection: (props: Record<string, unknown>) => {
    mockWorkViewSectionProps.current = props;
    return createElement(
      "div",
      { "data-testid": "work-view-mode" },
      String(props.viewingMode ?? "")
    );
  },
}));

import { GardenWork } from "../../views/Home/Garden/Work";

describe("Home garden work detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkViewSectionProps.current = null;
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseWorks.mockReturnValue({ works: [] });
    mockUseUser.mockReturnValue({ user: null, smartAccountClient: null });
    mockCanManageGarden.mockReturnValue(false);
    mockIsUserAddress.mockReturnValue(false);
    mockUseWorkApprovalActions.mockReturnValue({
      feedbackMode: null,
      inlineFeedback: "",
      setInlineFeedback: vi.fn(),
      confidence: "NONE",
      setConfidence: vi.fn(),
      optimisticStatus: null,
      effectiveStatus: "pending",
      handleApprovePress: vi.fn(),
      handleRejectPress: vi.fn(),
      handleCancelFeedback: vi.fn(),
      handleSubmitApproval: vi.fn(),
      workApprovalMutation: { mutate: vi.fn(), isPending: false },
    });
  });

  it("falls back to the route garden id when back navigation state is missing", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1/work/work-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages: {} },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/home/:id/work/:workId",
              element: createElement(GardenWork),
            })
          )
        )
      )
    );

    fireEvent.click(screen.getByTestId("work-back"));

    expect(mockNavigate).toHaveBeenCalledWith("/home/garden-1");
  });

  it("does not show approval mode for evaluator-only access", () => {
    mockUseUser.mockReturnValue({
      user: { id: "0x1111111111111111111111111111111111111111" },
      smartAccountClient: null,
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          owners: [],
          operators: [],
          evaluators: ["0x1111111111111111111111111111111111111111"],
        },
      ],
      isLoading: false,
    });
    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "work-1",
          actionUID: "1",
          gardenerAddress: "0x2222222222222222222222222222222222222222",
          status: "pending",
          createdAt: Date.now(),
          media: [],
        },
      ],
    });
    mockCanManageGarden.mockReturnValue(false);

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1/work/work-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages: {} },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/home/:id/work/:workId",
              element: createElement(GardenWork),
            })
          )
        )
      )
    );

    expect(screen.getByTestId("work-view-mode")).toHaveTextContent("viewer");
    expect(mockUseWorkApprovalActions).toHaveBeenCalledWith(
      expect.objectContaining({ viewingMode: "viewer" })
    );
  });

  it("shows approval mode for owner or operator access", () => {
    mockUseUser.mockReturnValue({
      user: { id: "0x3333333333333333333333333333333333333333" },
      smartAccountClient: null,
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          owners: [],
          operators: ["0x3333333333333333333333333333333333333333"],
          evaluators: [],
        },
      ],
      isLoading: false,
    });
    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "work-1",
          actionUID: "1",
          gardenerAddress: "0x2222222222222222222222222222222222222222",
          status: "pending",
          createdAt: Date.now(),
          media: [],
        },
      ],
    });
    mockCanManageGarden.mockReturnValue(true);

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1/work/work-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages: {} },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/home/:id/work/:workId",
              element: createElement(GardenWork),
            })
          )
        )
      )
    );

    expect(screen.getByTestId("work-view-mode")).toHaveTextContent("operator");
    expect(mockUseWorkApprovalActions).toHaveBeenCalledWith(
      expect.objectContaining({ viewingMode: "operator" })
    );
  });
});
