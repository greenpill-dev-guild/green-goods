import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseWorks = vi.fn();
const mockUseActions = vi.fn();
const mockUseGardenPermissions = vi.fn();
const mockSetSelectedGarden = vi.fn();
let mockSelectedGarden: { id: string; name: string } | null = {
  id: "0xGarden",
  name: "Demo Garden",
};

vi.mock("@green-goods/shared", () => ({
  adminRoutes: {
    hub: (search?: Record<string, string>) => {
      const query = search ? new URLSearchParams(search).toString() : "";
      return query ? `/hub?${query}` : "/hub";
    },
  },
  Confidence: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  DEFAULT_CHAIN_ID: 11155111,
  useAdminStore: (selector: (state: any) => any) =>
    selector({
      selectedGarden: mockSelectedGarden,
      setSelectedGarden: mockSetSelectedGarden,
    }),
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: mockSelectedGarden,
    setSelectedGarden: mockSetSelectedGarden,
  }),
  useActions: () => mockUseActions(),
  useGardenPermissions: () => mockUseGardenPermissions(),
  useGardens: () => mockUseGardens(),
  useResolvedWorkDetail: (workId: string | undefined) => {
    const gardenPermissions = mockUseGardenPermissions();
    const { data: gardens = [], isLoading: gardensLoading = false } = mockUseGardens();
    const matchedGarden = workId
      ? (gardens.find((garden: { works?: Array<{ id: string }> }) =>
          garden.works?.some((candidateWork) => candidateWork.id === workId)
        ) ?? null)
      : null;
    const gardenId = matchedGarden?.id ?? mockSelectedGarden?.id ?? null;
    const garden =
      gardens.find((candidateGarden: { id: string }) => candidateGarden.id === gardenId) ??
      matchedGarden;
    const { works = [], isLoading: worksLoading = false } = mockUseWorks();
    const work =
      works.find((candidateWork: { id: string }) => candidateWork.id === workId) ??
      matchedGarden?.works?.find((candidateWork: { id: string }) => candidateWork.id === workId);
    const { data: actions = [] } = mockUseActions();
    const action = actions.find(
      (candidateAction: { id: string | number }) =>
        work && Number(candidateAction.id) === work.actionUID
    );

    if (matchedGarden && matchedGarden.id !== mockSelectedGarden?.id) {
      mockSetSelectedGarden(matchedGarden);
    }

    return {
      garden,
      gardenId,
      work,
      action,
      canReview: garden ? gardenPermissions.canReviewGarden(garden) : false,
      canApproveOrReject: garden
        ? gardenPermissions.isOperatorOfGarden(garden) || gardenPermissions.isOwnerOfGarden(garden)
        : false,
      isReviewed: work?.status === "approved" || work?.status === "rejected",
      metadata: work?.metadata ? JSON.parse(work.metadata) : null,
      audioNoteCids: undefined,
      isLoading: gardensLoading || (gardenId ? worksLoading : false),
    };
  },
  useWorks: () => mockUseWorks(),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
  useParams: () => ({ workId: "0xWork" }),
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
  ReviewForm: ({ canReview, actionSlug }: { canReview: boolean; actionSlug?: string }) => {
    const actions = mockUseActions.mock.results.at(-1)?.value?.data ?? [];
    const permissions = mockUseGardenPermissions.mock.results.at(-1)?.value;
    const matchedAction = actions.find((action: { slug?: string }) => action.slug === actionSlug);
    const isExpired =
      typeof matchedAction?.endTime === "number" && matchedAction.endTime < Date.now();
    const isOperator = permissions?.isOperatorOfGarden?.() ?? false;
    const isOwner = permissions?.isOwnerOfGarden?.() ?? false;

    if (isExpired) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement("div", null, "Action expired"),
        React.createElement("div", null, "approval decisions are blocked")
      );
    }

    if (canReview && !isOperator && !isOwner) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement("div", null, "Owner or operator access required"),
        React.createElement(
          "div",
          null,
          "Only garden owners or operators can approve or reject work"
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

import WorkDetail from "@/views/Garden/WorkDetail";

const messages = {
  "app.garden.admin.backToGarden": "Back to garden",
  "app.work.detail.loading": "Loading work...",
  "app.work.detail.loadingDescription": "Fetching work details.",
  "app.work.detail.title": "Work Detail",
  "app.work.detail.notFoundDescription": "The requested work submission could not be found.",
  "app.work.detail.notFound": "Work not found",
  "app.work.detail.reviewTitle": "Review Work",
  "app.work.detail.operatorReview": "Operator Review",
  "app.work.detail.noPermission": "You don't have permission to review work in this garden.",
  "app.work.detail.reviewBlocked.operatorTitle": "Owner or operator access required",
  "app.work.detail.reviewBlocked.operatorMessage":
    "Only garden owners or operators can approve or reject work for this garden.",
  "app.work.detail.reviewBlocked.expiredTitle": "Action expired",
  "app.work.detail.reviewBlocked.expiredMessage":
    "This action is no longer active, so new approval decisions are blocked.",
  "app.work.status.pending": "Pending",
  "app.work.status.approved": "Approved",
  "app.work.status.rejected": "Rejected",
} satisfies Record<string, string>;

function renderWithIntl() {
  return render(
    React.createElement(IntlProvider, {
      locale: "en",
      messages,
      children: React.createElement(WorkDetail),
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

    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0xGarden",
          name: "Demo Garden",
          operators: ["0xoperator"],
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
          operators: ["0xoperator"],
          works: [],
        },
      ],
      isLoading: false,
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
      isOperatorOfGarden: () => true,
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

  it("blocks evaluators without operator access from submitting approvals", () => {
    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isOperatorOfGarden: () => false,
      isOwnerOfGarden: () => false,
    });

    renderWithIntl();

    expect(screen.getByText("Owner or operator access required")).toBeInTheDocument();
    expect(
      screen.getByText(/only garden owners or operators can approve or reject work/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("work-review-panel")).not.toBeInTheDocument();
  });

  it("allows garden owners to review even when they are not listed as operators", () => {
    mockUseGardenPermissions.mockReturnValue({
      canReviewGarden: () => true,
      isOperatorOfGarden: () => false,
      isOwnerOfGarden: () => true,
    });

    renderWithIntl();

    expect(screen.getByTestId("work-review-panel")).toBeInTheDocument();
    expect(screen.queryByText("Owner or operator access required")).not.toBeInTheDocument();
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
          operators: ["0xoperator"],
          works: [],
        },
        {
          id: "0xAltGarden",
          name: "Alt Garden",
          operators: ["0xoperator"],
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
    });

    renderWithIntl();

    expect(screen.getByText("Mulching")).toBeInTheDocument();
    expect(mockSetSelectedGarden).toHaveBeenCalledWith(
      expect.objectContaining({ id: "0xAltGarden", name: "Alt Garden" })
    );
    expect(screen.queryByText("Work not found")).not.toBeInTheDocument();
  });
});
