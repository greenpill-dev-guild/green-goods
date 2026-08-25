import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@green-goods/shared/types/domain";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseMyWorks = vi.fn();
const mockUseMyOnlineWorks = vi.fn();
let mockReviewerGardenIds: string[] = [];
let mockReviewerWorksState: {
  data: Work[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = {
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
let mockReviewExclusionRefetch = vi.fn();
let mockMyApprovalsRefetch = vi.fn();
let mockReviewExclusionQueryState: {
  data: Array<{ workUID: string }> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
} = {
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
};
let mockMyApprovalsQueryState: {
  data:
    | Array<{
        workUID: string;
        actionUID: string;
        gardenerAddress: string;
        feedback?: string;
        createdAt: number;
        approved: boolean;
      }>
    | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
} = {
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
};

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@green-goods/shared/utils/blockchain/address", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/utils/blockchain/address")>()),
  compareAddresses: (left?: string, right?: string) =>
    Boolean(left && right && left.toLowerCase() === right.toLowerCase()),
  isUserAddress: (address?: string, activeAddress?: string) =>
    Boolean(address && activeAddress && address.toLowerCase() === activeAddress.toLowerCase()),
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/utils/work/pending-review", () => ({
  collectApprovalRecipientsForWorks: (gardenIds: string[]) => gardenIds,
  collectApprovedWorkUIDs: (approvals: Array<{ workUID: string }>) =>
    new Set(approvals.map((approval) => approval.workUID)),
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
}));

vi.mock("@green-goods/shared/config/query-keys/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/config/query-keys/constants")>()),
  DEFAULT_RETRY_COUNT: 0,
  STALE_TIME_MEDIUM: 30_000,
}));

vi.mock("@green-goods/shared/hooks/work/useAggregatedApprovals", () => ({
  fetchApprovalsByRecipients: vi.fn(async () => []),
}));

vi.mock("@green-goods/shared/utils/time", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/utils/time")>()),
  filterByTimeRange: (items: unknown[]) => items,
}));

vi.mock("@green-goods/shared/utils/app/haptics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/utils/app/haptics")>()),
  hapticLight: vi.fn(),
}));

vi.mock("@green-goods/shared/modules/app/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared/modules/app/logger")>();
  return { ...actual, logger: { ...actual.logger, error: vi.fn() } };
});

vi.mock("@green-goods/shared/config/query-keys/registry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/config/query-keys/registry")>();
  return {
    ...actual,
    queryKeys: {
      ...actual.queryKeys,
      approvals: {
        ...actual.queryKeys.approvals,
        byMyWorkGardens: (...args: unknown[]) => ["approvals", "mine", ...args],
        forWorkReview: (...args: unknown[]) => ["approvals", "forWorkReview", ...args],
      },
    },
  };
});

vi.mock("@green-goods/shared/components/Spinner", () => ({
  Spinner: ({ label }: { label?: string }) => createElement("div", { role: "status" }, label),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/components/Toast/toast.service")>();
  return { ...actual, toastService: { ...actual.toastService, error: vi.fn() } };
});

vi.mock("@green-goods/shared/hooks/work/useDrafts", () => ({
  useDrafts: () => ({ draftCount: 0 }),
}));

vi.mock("@green-goods/shared/hooks/utils/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/work/useMyWorks", () => ({
  useMyWorks: (...args: unknown[]) => mockUseMyWorks(...args),
}));

vi.mock("@green-goods/shared/hooks/work/useReviewerGardenIds", () => ({
  useReviewerGardenIds: () => ({ reviewerGardenIds: mockReviewerGardenIds }),
}));

vi.mock("@green-goods/shared/hooks/work/useReviewerWorks", () => ({
  useReviewerWorks: () => mockReviewerWorksState,
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
  useTimeout: () => ({ set: vi.fn((fn: () => void) => fn()) }),
}));

vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: (selector: (s: { workDashboardInitialTab?: string }) => unknown) =>
    selector({ workDashboardInitialTab: undefined }),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ user: { id: "0xabc" } }),
}));

vi.mock("@green-goods/shared/hooks/work/useWorkApprovals", () => ({
  useWorkApprovals: () => mockWorkApprovalsState,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => {
      const queryKey = options.queryKey ?? [];
      const isReviewExclusionQuery = queryKey[1] === "forWorkReview";
      const state = isReviewExclusionQuery
        ? mockReviewExclusionQueryState
        : mockMyApprovalsQueryState;
      return {
        ...state,
        refetch: isReviewExclusionQuery ? mockReviewExclusionRefetch : mockMyApprovalsRefetch,
      };
    },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("../../components/Cards", () => ({
  MinimalWorkCard: ({
    work,
    onClick,
  }: {
    work: { title: string; feedback?: string };
    onClick: () => void;
  }) =>
    createElement(
      "button",
      { type: "button", onClick },
      work.title,
      work.feedback ? createElement("span", null, work.feedback) : null
    ),
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
        { locale: "en", messages: { "app.common.loading": "Loading" } },
        createElement(WorkDashboard, { onClose: vi.fn() })
      )
    )
  );
}

describe("WorkDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewerGardenIds = [];
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
    mockReviewExclusionRefetch = vi.fn();
    mockMyApprovalsRefetch = vi.fn();
    mockReviewExclusionQueryState = {
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
    };
    mockMyApprovalsQueryState = {
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
    };
    mockUseMyWorks.mockReturnValue({
      data: [
        {
          id: "job-1",
          title: "Queued tree planting",
          actionUID: 1,
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

  it("waits for review-exclusion approvals before showing steward work as needing review", () => {
    mockReviewerGardenIds = ["garden-1"];
    mockReviewerWorksState = {
      data: [
        {
          id: "reviewed-work",
          title: "Already reviewed planting",
          actionUID: 1,
          gardenerAddress: "0xdef",
          gardenAddress: "garden-1",
          feedback: "",
          metadata: "",
          media: [],
          createdAt: 1_700_000_100,
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
    mockUseMyWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockReviewExclusionQueryState = {
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      isSuccess: false,
    };

    renderDashboard();

    expect(screen.getByText("Loading pending work...")).toBeInTheDocument();
    expect(screen.queryByText("Already reviewed planting")).not.toBeInTheDocument();
  });

  it("refreshes the review-exclusion approvals query from the Pending tab", () => {
    mockUseMyWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderDashboard();

    fireEvent.click(screen.getByText("Refresh"));

    expect(mockReviewExclusionRefetch).toHaveBeenCalled();
  });

  it("opens the original work route from the My work reviewed completed filter", () => {
    mockUseMyWorks.mockReturnValue({
      data: [
        {
          id: "reviewed-work",
          title: "Reviewed planting",
          actionUID: "1",
          gardenerAddress: "0xabc",
          gardenAddress: "garden-42",
          feedback: "",
          metadata: "",
          media: [],
          createdAt: 1_700_000_100,
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockMyApprovalsQueryState = {
      data: [
        {
          workUID: "reviewed-work",
          actionUID: "1",
          gardenerAddress: "0xabc",
          feedback: "Looks good",
          createdAt: 1_700_000_200,
          approved: true,
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
    };

    renderDashboard();

    fireEvent.click(screen.getByTestId("tab-completed"));
    fireEvent.change(screen.getByDisplayValue("Reviewed by you"), {
      target: { value: "myWorkReviewed" },
    });
    fireEvent.click(screen.getByText("Reviewed planting"));

    expect(mockNavigate).toHaveBeenCalledWith("/home/garden-42/work/reviewed-work", {
      state: { from: "dashboard", returnTo: "/home" },
      viewTransition: true,
    });
  });

  it("does not show original submission feedback as review feedback", () => {
    mockUseMyWorks.mockReturnValue({
      data: [
        {
          id: "reviewed-work",
          title: "Reviewed planting",
          actionUID: "1",
          gardenerAddress: "0xabc",
          gardenAddress: "garden-42",
          feedback: "Original field notes from the submitter",
          metadata: "",
          media: [],
          createdAt: 1_700_000_100,
          status: "pending",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockMyApprovalsQueryState = {
      data: [
        {
          workUID: "reviewed-work",
          actionUID: "1",
          gardenerAddress: "0xabc",
          createdAt: 1_700_000_200,
          approved: true,
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
    };

    renderDashboard();

    fireEvent.click(screen.getByTestId("tab-completed"));
    fireEvent.change(screen.getByDisplayValue("Reviewed by you"), {
      target: { value: "myWorkReviewed" },
    });

    expect(screen.getByText("Reviewed planting")).toBeInTheDocument();
    expect(screen.queryByText("Original field notes from the submitter")).not.toBeInTheDocument();
  });
});
