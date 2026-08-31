import { act, render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseWorks = vi.fn();
const mockUseActions = vi.fn();
const mockUseGardenPermissions = vi.fn();
const mockSetSelectedGarden = vi.fn();
const mockNavigate = vi.fn();
const mockUseRouteBackedLeftSheetConfig = vi.fn();
const mockTrackWorkApprovalPresentationFailed = vi.fn();
let capturedReviewSuccess: ((approved: boolean) => void) | undefined;
let mockAdminGardenContextError = false;
let mockSelectedGarden: { id: string; name: string } | null = {
  id: "0xGarden",
  name: "Demo Garden",
};

vi.mock("@green-goods/shared/config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => mockUseActions(),
  useGardens: () => mockUseGardens(),
}));

vi.mock("@green-goods/shared/hooks/garden/useAdminGardenContext", () => ({
  useAdminGardenContext: () => ({
    activeGarden: mockSelectedGarden,
    activeGardenId: mockSelectedGarden?.id ?? null,
    isError: mockAdminGardenContextError,
    selectGarden: mockSetSelectedGarden,
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: mockSelectedGarden,
    setSelectedGarden: mockSetSelectedGarden,
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => mockUseGardenPermissions(),
}));

vi.mock("@green-goods/shared/hooks/work/useWorks", () => ({
  useWorks: () => mockUseWorks(),
}));

vi.mock("@green-goods/shared/modules/app/analytics-events", () => ({
  trackWorkApprovalPresentationFailed: (properties: unknown) =>
    mockTrackWorkApprovalPresentationFailed(properties),
}));

vi.mock("@green-goods/shared/stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: any) => any) =>
    selector({
      selectedGarden: mockSelectedGarden,
      setSelectedGarden: mockSetSelectedGarden,
    }),
}));

vi.mock("@green-goods/shared/types/domain", () => ({
  Confidence: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
}));

vi.mock("@green-goods/shared/utils/action/templates", () => ({
  instructionTemplates: {
    "solar.install_milestone": {
      description:
        "Record installation progress milestones for solar panels, batteries, internet equipment, or retrofits.",
    },
  },
}));

vi.mock("@green-goods/shared/utils/action/translations", () => ({
  getReviewedActionTranslation: () => null,
  localizeAction: (action: unknown) => action,
}));

vi.mock("@green-goods/shared/utils/navigation/admin-routes", () => ({
  adminRoutes: {
    hub: (search?: Record<string, string>) => {
      const query = search ? new URLSearchParams(search).toString() : "";
      return query ? `/hub?${query}` : "/hub";
    },
  },
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
  useNavigate: () => mockNavigate,
  useParams: () => ({ workId: "0xWork" }),
}));

vi.mock("@/components/Layout", () => ({
  useRouteBackedLeftSheetConfig: (config: unknown) => mockUseRouteBackedLeftSheetConfig(config),
}));

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    React.createElement(
      "div",
      { "data-testid": "page-header" },
      React.createElement("h1", null, title),
      description ? React.createElement("p", null, description) : null
    ),
}));

vi.mock("@/views/Hub/components/MediaEvidence", () => ({
  MediaEvidence: () => React.createElement("div", { "data-testid": "media-evidence" }),
}));

vi.mock("@/views/Hub/components/WorkStatusBadge", () => ({
  WorkStatusBadge: () => React.createElement("div", { "data-testid": "work-status-badge" }),
}));

vi.mock("@/views/Hub/components/WorkSubmissionDetails", () => ({
  WorkSubmissionDetails: () =>
    React.createElement("div", { "data-testid": "work-submission-details" }),
}));

vi.mock("@/views/Garden/WorkDetail/ReviewForm", () => ({
  ReviewForm: ({
    canReview,
    actionSlug,
    onSuccess,
  }: {
    canReview: boolean;
    actionSlug?: string;
    onSuccess?: (approved: boolean) => void;
  }) => {
    capturedReviewSuccess = onSuccess;
    const actions = mockUseActions.mock.results.at(-1)?.value?.data ?? [];
    const permissions = mockUseGardenPermissions.mock.results.at(-1)?.value;
    const matchedAction = actions.find((action: { slug?: string }) => action.slug === actionSlug);
    const isExpired =
      typeof matchedAction?.endTime === "number" && matchedAction.endTime < Date.now();
    const isSteward = permissions?.isStewardOfGarden?.() ?? false;
    const isOwner = permissions?.isOwnerOfGarden?.() ?? false;

    if (isExpired) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement("div", null, "Action expired"),
        React.createElement("div", null, "approval decisions are blocked")
      );
    }

    if (canReview && !isSteward && !isOwner) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement("div", null, "Owner or steward access required"),
        React.createElement(
          "div",
          null,
          "Only garden owners or stewards can approve or reject work"
        )
      );
    }

    return canReview
      ? React.createElement("div", { "data-testid": "work-review-panel" })
      : React.createElement("div", null, "Review blocked");
  },
}));

vi.mock("@/views/Garden/WorkDetail/SubmissionDetails", () => ({
  SubmissionDetails: () => React.createElement("div", { "data-testid": "submission-details" }),
}));

import WorkDetail, { WorkDetailPanel } from "@/views/Garden/WorkDetail";
import { HubSheetDescriptor } from "@/views/Hub/components/HubSheetDescriptor";

const messages = {
  "app.garden.admin.backToGarden": "Back to Garden",
  "app.work.detail.loading": "Loading work...",
  "app.work.detail.loadingDescription": "Fetching work details.",
  "app.work.detail.loadError":
    "Work details could not be loaded. Check your connection and try again.",
  "app.work.detail.title": "Work Detail",
  "app.work.detail.notFoundDescription": "The requested work submission could not be found.",
  "app.work.detail.notFound": "Work not found",
  "app.work.detail.reviewTitle": "Review Work",
  "app.work.detail.stewardReview": "Steward Review",
  "app.work.detail.noPermission": "You don't have permission to review work in this garden.",
  "app.work.detail.reviewBlocked.stewardTitle": "Owner or steward access required",
  "app.work.detail.reviewBlocked.stewardMessage":
    "Only garden owners or stewards can approve or reject work for this garden.",
  "app.work.detail.reviewBlocked.expiredTitle": "Action expired",
  "app.work.detail.reviewBlocked.expiredMessage":
    "This action is no longer active, so new approval decisions are blocked.",
  "app.work.status.pending": "Pending",
  "app.work.status.approved": "Approved",
  "app.work.status.rejected": "Rejected",
} satisfies Record<string, string>;

function renderWithIntl(
  locale: "en" | "pt" = "en",
  children: React.ReactNode = React.createElement(WorkDetail)
) {
  return render(
    React.createElement(IntlProvider, {
      locale,
      messages: locale === "pt" ? ptMessages : messages,
      children,
    })
  );
}

describe("WorkDetail view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedGarden = {
      id: "0xGarden",
      name: "Demo Garden",
    };
    mockAdminGardenContextError = false;
    mockNavigate.mockReset();
    mockUseRouteBackedLeftSheetConfig.mockReset();
    mockTrackWorkApprovalPresentationFailed.mockReset();
    capturedReviewSuccess = undefined;

    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0xGarden",
          name: "Demo Garden",
          stewards: ["0xsteward"],
          works: [
            {
              id: "0xWork",
              title: "Mulch beds",
              actionUID: 1,
              gardenAddress: "0xGarden",
              gardenerAddress: "0xgardener",
              metadata: "{}",
              media: [],
              status: "pending",
            },
          ],
        },
        {
          id: "0xAltGarden",
          name: "Alt Garden",
          stewards: ["0xsteward"],
          works: [],
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "0xWork",
          title: "Mulch beds",
          actionUID: 1,
          gardenAddress: "0xGarden",
          gardenerAddress: "0xgardener",
          metadata: "{}",
          media: [],
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    mockUseActions.mockReturnValue({
      data: [
        {
          id: "1",
          title: "Mulching",
          slug: "agro.mulch",
          endTime: Date.now() + 60_000,
        },
      ],
    });

    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isStewardOfGarden: () => true,
      isOwnerOfGarden: () => false,
    });
  });

  it("blocks the review panel for expired actions and shows a warning", () => {
    mockUseActions.mockReturnValue({
      data: [
        {
          id: "1",
          title: "Mulching",
          slug: "agro.mulch",
          endTime: Date.now() - 60_000,
        },
      ],
    });

    renderWithIntl();

    expect(screen.getByText("Action expired")).toBeInTheDocument();
    expect(screen.getByText(/approval decisions are blocked/i)).toBeInTheDocument();
    expect(screen.queryByTestId("work-review-panel")).not.toBeInTheDocument();
  });

  it("blocks evaluators without steward access from submitting approvals", () => {
    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isStewardOfGarden: () => false,
      isOwnerOfGarden: () => false,
    });

    renderWithIntl();

    expect(screen.getByText("Owner or steward access required")).toBeInTheDocument();
    expect(
      screen.getByText(/only garden owners or stewards can approve or reject work/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("work-review-panel")).not.toBeInTheDocument();
  });

  it("allows garden owners to review even when they are not listed as stewards", () => {
    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isStewardOfGarden: () => false,
      isOwnerOfGarden: () => true,
    });

    renderWithIntl();

    expect(screen.getByTestId("work-review-panel")).toBeInTheDocument();
    expect(screen.queryByText("Owner or steward access required")).not.toBeInTheDocument();
  });

  it("recovers the matched garden when the selected garden does not own the work", () => {
    mockSelectedGarden = {
      id: "0xGarden",
      name: "Demo Garden",
    };

    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0xGarden",
          name: "Demo Garden",
          stewards: ["0xsteward"],
          works: [],
        },
        {
          id: "0xAltGarden",
          name: "Alt Garden",
          stewards: ["0xsteward"],
          works: [
            {
              id: "0xWork",
              title: "Mulch beds",
              actionUID: 1,
              gardenAddress: "0xAltGarden",
              gardenerAddress: "0xgardener",
              metadata: "{}",
              media: [],
              status: "pending",
            },
          ],
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "0xWork",
          title: "Mulch beds",
          actionUID: 1,
          gardenAddress: "0xAltGarden",
          gardenerAddress: "0xgardener",
          metadata: "{}",
          media: [],
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    renderWithIntl();

    expect(screen.getByText("Mulching")).toBeInTheDocument();
    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "0xAltGarden", name: "Alt Garden" }),
      { replace: true }
    );
    expect(screen.queryByText("Work not found")).not.toBeInTheDocument();
  });

  it("keeps the rendered inspector stable when the reviewed work leaves the pending collection", () => {
    const panel = React.createElement(WorkDetailPanel, {
      workId: "0xWork",
      layout: "sheet",
    });
    const rendered = renderWithIntl("en", panel);

    expect(screen.getByTestId("submission-details")).toBeInTheDocument();

    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0xGarden",
          name: "Demo Garden",
          stewards: ["0xsteward"],
          works: [],
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "0xUnrelated",
          title: "Plant windbreak",
          actionUID: 1,
          gardenAddress: "0xGarden",
          gardenerAddress: "0xgardener",
          metadata: "{}",
          media: [],
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    rendered.rerender(
      React.createElement(IntlProvider, {
        locale: "en",
        messages,
        children: React.createElement(WorkDetailPanel, {
          workId: "0xWork",
          layout: "sheet",
        }),
      })
    );

    expect(screen.queryByText("Work not found")).not.toBeInTheDocument();
    expect(screen.getByTestId("submission-details")).toBeInTheDocument();
  });

  it("closes the route-backed inspector exactly once after review success", () => {
    const onBeforeClose = vi.fn();
    const onNavigateToBase = vi.fn();

    renderWithIntl(
      "en",
      React.createElement(HubSheetDescriptor, {
        routeSheetContentId: "work-detail:0xWork",
        routeWorkId: "0xWork",
        routeCertificationId: undefined,
        activeWorkDetailId: null,
        selectedWork: mockUseWorks().works[0],
        selectedCertification: undefined,
        isResolvingSelection: false,
        canManage: true,
        hubContext: { gardenId: "0xGarden", sort: "newest" },
        closeTo: "/hub/work?gardenId=0xGarden&sort=newest",
        onNavigateToBase,
        onBeforeClose,
      })
    );

    const config = mockUseRouteBackedLeftSheetConfig.mock.calls.at(-1)?.[0] as {
      content: React.ReactElement<{ onSuccess?: () => void }>;
    };
    act(() => config.content.props.onSuccess?.());

    expect(onBeforeClose).toHaveBeenCalledTimes(1);
    expect(onNavigateToBase).toHaveBeenCalledTimes(1);
  });

  it("records a privacy-safe presentation failure separately after transaction success", () => {
    const onSuccess = vi.fn();
    const rendered = renderWithIntl(
      "en",
      React.createElement(WorkDetailPanel, {
        workId: "0xWork",
        layout: "sheet",
        onSuccess,
      })
    );
    const completedReview = capturedReviewSuccess;

    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Garden query failed"),
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Works query failed"),
    });
    rendered.rerender(
      React.createElement(IntlProvider, {
        locale: "en",
        messages,
        children: React.createElement(WorkDetailPanel, {
          workId: "0xUnexpected",
          layout: "sheet",
          onSuccess,
        }),
      })
    );

    act(() => completedReview?.(true));

    expect(mockTrackWorkApprovalPresentationFailed).toHaveBeenCalledWith({
      approved: true,
      failureReason: "detail-resolution",
      resolutionStatus: "error",
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockTrackWorkApprovalPresentationFailed.mock.calls[0]?.[0]).not.toHaveProperty(
      "gardenAddress"
    );
    expect(mockTrackWorkApprovalPresentationFailed.mock.calls[0]?.[0]).not.toHaveProperty(
      "walletAddress"
    );
    expect(mockTrackWorkApprovalPresentationFailed.mock.calls[0]?.[0]).not.toHaveProperty(
      "workUID"
    );
  });

  it("shows not found for an unknown work only after detail resolution settles", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
    });
    const panel = React.createElement(WorkDetailPanel, {
      workId: "0xUnknown",
      layout: "sheet",
    });
    const rendered = renderWithIntl("en", panel);

    expect(screen.getByRole("status")).toHaveTextContent("Loading work...");
    expect(screen.queryByText("Work not found")).not.toBeInTheDocument();

    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    rendered.rerender(
      React.createElement(IntlProvider, {
        locale: "en",
        messages,
        children: React.createElement(WorkDetailPanel, {
          workId: "0xUnknown",
          layout: "sheet",
        }),
      })
    );

    expect(screen.getByText("Work not found")).toBeInTheDocument();
  });

  it("does not report a query failure as an unknown work", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Garden query failed"),
    });
    mockUseWorks.mockReturnValue({
      works: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new Error("Works query failed"),
    });

    renderWithIntl(
      "en",
      React.createElement(WorkDetailPanel, { workId: "0xWork", layout: "sheet" })
    );

    expect(
      screen.getByText("Work details could not be loaded. Check your connection and try again.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Work not found")).not.toBeInTheDocument();
  });

  it("localizes infrastructure milestone titles in the Portuguese Hub detail", () => {
    mockUseWorks.mockReturnValue({
      works: [
        {
          id: "0xWork",
          title: "Infrastructure Milestone - 2026-07-07T16:36:37.231Z - 2026-07-07T16:36:37.366Z",
          actionUID: 1,
          gardenAddress: "0xGarden",
          gardenerAddress: "0xgardener",
          metadata: "{}",
          media: [],
          status: "pending",
        },
      ],
      isLoading: false,
    });
    mockUseActions.mockReturnValue({
      data: [
        {
          id: "1",
          title: "Infrastructure Milestone - 2026-07-07T16:36:37.231Z",
          slug: "solar.install_milestone",
          endTime: Date.now() + 60_000,
        },
      ],
    });

    renderWithIntl(
      "pt",
      React.createElement(WorkDetailPanel, { workId: "0xWork", layout: "sheet" })
    );

    expect(
      screen.getByText("Marco de infraestrutura - 2026-07-07T16:36:37.231Z")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Infrastructure Milestone/)).not.toBeInTheDocument();
  });
});
