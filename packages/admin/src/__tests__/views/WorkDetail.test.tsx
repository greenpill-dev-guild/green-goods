import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseWorks = vi.fn();
const mockUseActions = vi.fn();
const mockUseGardenPermissions = vi.fn();

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  useActions: () => mockUseActions(),
  useGardenPermissions: () => mockUseGardenPermissions(),
  useGardens: () => mockUseGardens(),
  useWorks: () => mockUseWorks(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "0xGarden", workId: "0xWork" }),
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

vi.mock("@/components/Work/MediaEvidence", () => ({
  MediaEvidence: () => React.createElement("div", { "data-testid": "media-evidence" }),
}));

vi.mock("@/components/Work/WorkStatusBadge", () => ({
  WorkStatusBadge: () => React.createElement("div", { "data-testid": "work-status-badge" }),
}));

vi.mock("@/components/Work/WorkSubmissionDetails", () => ({
  WorkSubmissionDetails: () =>
    React.createElement("div", { "data-testid": "work-submission-details" }),
}));

vi.mock("@/components/Work/WorkReviewPanel", () => ({
  WorkReviewPanel: () => React.createElement("div", { "data-testid": "work-review-panel" }),
}));

import WorkDetail from "@/views/Gardens/Garden/WorkDetail";

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

    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "0xGarden",
          name: "Demo Garden",
          operators: ["0xoperator"],
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
});
