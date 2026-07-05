import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseMyWorks = vi.fn();
const mockUseMyOnlineWorks = vi.fn();
let mockReviewerWorksState = {
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};
let mockWorkApprovalsState = {
  completedApprovals: [],
  isLoading: false,
  hasError: false,
  errorMessage: undefined as string | undefined,
  refetch: vi.fn(),
};

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  collectApprovalRecipientsForWorks: (gardenIds: string[]) => gardenIds,
  collectApprovedWorkUIDs: (approvals: Array<{ workUID: string }>) =>
    new Set(approvals.map((approval) => approval.workUID)),
  DEFAULT_RETRY_COUNT: 0,
  fetchApprovalsByRecipients: vi.fn(async () => []),
  filterByTimeRange: (items: unknown[]) => items,
  filterPendingNeedsReview: (
    works: Array<{ id: string; gardenerAddress?: string }>,
    approvedWorkUIDs: Set<string>,
    viewerAddress?: string
  ) =>
    works.filter(
      (work) =>
        !approvedWorkUIDs.has(work.id) &&
        !(
          work.gardenerAddress &&
          viewerAddress &&
          work.gardenerAddress.toLowerCase() === viewerAddress.toLowerCase()
        )
    ),
  hapticLight: vi.fn(),
  isUserAddress: (address?: string, activeAddress?: string) =>
    Boolean(address && activeAddress && address.toLowerCase() === activeAddress.toLowerCase()),
  logger: { error: vi.fn() },
  queryKeys: {
    approvals: {
      byMyWorkGardens: (...args: unknown[]) => ["approvals", "mine", ...args],
      forWorkReview: (...args: unknown[]) => ["approvals", "forWorkReview", ...args],
    },
  },
  STALE_TIME_MEDIUM: 30_000,
  toastService: { error: vi.fn() },
  useDrafts: () => ({ draftCount: 0 }),
  useFocusTrap: vi.fn(),
  useMyOnlineWorks: (...args: unknown[]) => mockUseMyOnlineWorks(...args),
  useMyWorks: (...args: unknown[]) => mockUseMyWorks(...args),
  useReviewerGardenIds: () => ({ reviewerGardenIds: [] }),
  useReviewerWorks: () => mockReviewerWorksState,
  useTimeout: () => ({ set: vi.fn((fn: () => void) => fn()) }),
  useUIStore: (selector: (s: { workDashboardInitialTab?: string }) => unknown) =>
    selector({ workDashboardInitialTab: undefined }),
  useUser: () => ({ user: { id: "0xabc" } }),
  useWorkApprovals: () => mockWorkApprovalsState,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("../../components/Cards", () => ({
  MinimalWorkCard: ({ work, onClick }: { work: { title: string }; onClick: () => void }) =>
    createElement("button", { type: "button", onClick }, work.title),
}));

vi.mock("../../views/Home/WorkDashboard/Drafts", () => ({
  DraftsTab: () => createElement("div", null, "Drafts panel"),
}));

import { WorkDashboard } from "../../views/Home/WorkDashboard";

function renderDashboard() {
  return render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: {} },
        createElement(WorkDashboard, { onClose: vi.fn() })
      )
    )
  );
}

describe("WorkDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewerWorksState = {
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
    mockWorkApprovalsState = {
      completedApprovals: [],
      isLoading: false,
      hasError: false,
      errorMessage: undefined,
      refetch: vi.fn(),
    };
    mockUseMyWorks.mockReturnValue({
      data: [
        {
          id: "job-1",
          title: "Queued tree planting",
          actionUID: "1",
          gardenerAddress: "0xabc",
          gardenAddress: "garden-1",
          feedback: "",
          metadata: "",
          media: [],
          createdAt: 1_700_000_000,
          status: "syncing",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseMyOnlineWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("opens on Pending and shows offline-included submitted work after submission", () => {
    renderDashboard();

    expect(screen.getByTestId("tab-drafts")).toBeInTheDocument();
    expect(screen.getByTestId("tab-pending")).toBeInTheDocument();
    expect(screen.getByTestId("tab-completed")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-recent")).not.toBeInTheDocument();
    expect(screen.getByTestId("modal-drawer").className).toContain("rounded-t-[var(--radius-lg)]");
    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(mockUseMyWorks).toHaveBeenCalledWith({ includeOffline: true });
    expect(mockUseMyOnlineWorks).not.toHaveBeenCalled();
  });

  it("keeps queued submissions visible when review-side queries fail", () => {
    mockReviewerWorksState = {
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch: vi.fn(),
    };
    mockWorkApprovalsState = {
      completedApprovals: [],
      isLoading: false,
      hasError: true,
      errorMessage: "Approvals unavailable",
      refetch: vi.fn(),
    };

    renderDashboard();

    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(screen.queryByText("Error loading data. Please try again.")).not.toBeInTheDocument();
  });

  it("keeps queued submissions visible while review-side queries are loading", () => {
    mockReviewerWorksState = {
      data: [],
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    };
    mockWorkApprovalsState = {
      completedApprovals: [],
      isLoading: true,
      hasError: false,
      errorMessage: undefined,
      refetch: vi.fn(),
    };

    renderDashboard();

    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(screen.queryByText("Loading pending work...")).not.toBeInTheDocument();
  });
});
