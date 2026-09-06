vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
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
const mockUseWorkDetailController = vi.fn();
const mockUseAttributions = vi.fn();
const mockUseCommitment = vi.fn();
const mockUseWorkDecisions = vi.fn();
const mockWorkViewSectionProps: { current: Record<string, unknown> | null } = { current: null };

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => mockNavigate,
}));

vi.mock("@green-goods/shared/hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle", refetch: vi.fn() }),
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
  useTimeout: () => ({
    set: (fn: () => void) => fn,
  }),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: (...args: unknown[]) => mockUseUser(...args),
}));

vi.mock("@green-goods/shared/hooks/client-ui/work/useWorkDetailController", () => ({
  useWorkDetailController: () => mockUseWorkDetailController(),
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitment: (...args: unknown[]) => mockUseCommitment(...args),
  useCommitmentMetadataFor: () => ({ version: 1, title: "Prune the north beds" }),
  useCommitmentWorkDecisions: (...args: unknown[]) => mockUseWorkDecisions(...args),
  useCommitmentWorkAttributionsForWork: (...args: unknown[]) => mockUseAttributions(...args),
  useCommitmentPool: () => ({ pool: null }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
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
      String(props.viewingMode ?? ""),
      props.fulfills as React.ReactNode
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
    mockUseAttributions.mockReturnValue({ attributions: [] });
    mockUseCommitment.mockReturnValue({ detail: null });
    mockUseWorkDecisions.mockReturnValue({ byWorkUID: new Map(), readAvailable: true });
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
    mockUseWorkDetailController.mockReturnValue({
      ...mockUseWorkApprovalActions(),
      actionTitle: null,
      back: () => mockNavigate("/home/garden-1"),
      canViewAttestation: false,
      chainId: 11155111,
      downloadData: vi.fn(),
      downloadMedia: vi.fn(),
      garden: undefined,
      gardenId: "garden-1",
      gardensLoading: false,
      isActionExpired: false,
      isOfflineWork: false,
      isOnline: true,
      isRetrying: false,
      metadataError: null,
      metadataStatus: "idle",
      onChainWorkId: null,
      retry: vi.fn(),
      retryMetadata: vi.fn(),
      share: vi.fn(),
      viewAttestation: vi.fn(),
      viewingMode: "viewer",
      work: undefined,
      workMetadata: null,
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
          stewards: [],
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
    mockUseWorkDetailController.mockReturnValue({
      ...mockUseWorkDetailController(),
      viewingMode: "viewer",
      work: mockUseWorks().works[0],
    });

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
  });

  it("shows approval mode for owner or steward access", () => {
    mockUseUser.mockReturnValue({
      user: { id: "0x3333333333333333333333333333333333333333" },
      smartAccountClient: null,
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          owners: [],
          stewards: ["0x3333333333333333333333333333333333333333"],
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
    mockUseWorkDetailController.mockReturnValue({
      ...mockUseWorkDetailController(),
      viewingMode: "steward",
      work: mockUseWorks().works[0],
    });

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

    expect(screen.getByTestId("work-view-mode")).toHaveTextContent("steward");
  });

  it.each([
    ["awaitingApproval", "Linked · waiting for approval"],
    ["readyToReconcile", "Approved · waiting for a steward to count it"],
    ["needsFreshReview", "Approved again · needs a fresh review"],
    ["counted", "Counted toward this commitment"],
    ["unavailable", "Counting status unavailable"],
  ] as const)("shows the %s state on the Work detail with a way to its commitment", (state, label) => {
    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "0x" + "ab".repeat(32),
          actionUID: "1",
          gardenerAddress: "0x2222222222222222222222222222222222222222",
          status: "approved",
          createdAt: Date.now(),
          media: [],
        },
      ],
    });
    mockUseAttributions.mockReturnValue({
      attributions: [
        {
          workUID: "0x" + "ab".repeat(32),
          commitmentId: 9n,
          requirementIndex: 1,
          linked: true,
        },
      ],
    });
    mockUseCommitment.mockReturnValue({
      detail: { commitment: { commitmentId: 9n, unitLabel: "hours", targetUnits: 6n } },
    });
    mockUseWorkDecisions.mockReturnValue({
      byWorkUID: new Map([["0x" + "ab".repeat(32), { state }]]),
      readAvailable: true,
    });
    mockUseWorkDetailController.mockReturnValue({
      ...mockUseWorkDetailController(),
      canViewAttestation: true,
      onChainWorkId: "0x" + "ab".repeat(32),
      work: mockUseWorks().works[0],
    });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1/work/" + "0x" + "ab".repeat(32)] },
        createElement(
          IntlProvider,
          {
            locale: "en",
            messages: {
              "app.work.fulfills.label": "Fulfills",
              "app.work.fulfills.value": "{name} · row {row}",
              "app.commitment.work.awaitingApproval": "Linked · waiting for approval",
              "app.commitment.work.readyToReconcile":
                "Approved · waiting for a steward to count it",
              "app.commitment.work.needsFreshReview": "Approved again · needs a fresh review",
              "app.commitment.work.counted": "Counted toward this commitment",
              "app.commitment.work.unavailable": "Counting status unavailable",
            },
          },
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

    // The attribution is read only for a work that is on chain.
    expect(mockUseAttributions).toHaveBeenCalledWith(
      expect.objectContaining({ workUID: "0x" + "ab".repeat(32) })
    );
    const row = screen.getByRole("button", { name: /Prune the north beds · row 2/ });
    expect(row).toHaveTextContent("Fulfills");
    expect(row).toHaveAccessibleDescription(label);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(label);
    expect(status.closest("button")).toBeNull();
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith("/home/garden-1/commitments/9");
  });
});
