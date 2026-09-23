import type { Work } from "@green-goods/shared/types/domain";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseMyWorks = vi.fn();
const mockUseMyOnlineWorks = vi.fn();
let mockReviewerGardenIds: string[] = [];
let mockIsOnline = true;
const ok = async () => ({ status: "success" });
let mockNeedsReviewState: {
  allWorks: Work[];
  works: Work[];
  decidedHere: Work[];
  ready: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  savedAt: number | undefined;
  refetch: ReturnType<typeof vi.fn>;
} = {
  allWorks: [],
  works: [],
  decidedHere: [],
  ready: true,
  isLoading: false,
  isFetching: false,
  isError: false,
  savedAt: undefined,
  refetch: vi.fn(async () => true),
};
let mockWorkApprovalsState = {
  completedApprovals: [] as Array<Record<string, unknown>>,
  isLoading: false,
  hasError: false,
  errorMessage: undefined as string | undefined,
  dataUpdatedAt: 0,
  refetch: vi.fn(ok),
};
let mockMyApprovalsRefetch = vi.fn(ok);
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
  dataUpdatedAt?: number;
} = {
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
};

function idleUploads() {
  return {
    readyCount: 0,
    preparingCount: 0,
    attentionCount: 0,
    queuedCount: 0,
    pausedForDataSaver: false,
    isPreparing: false,
    isUploading: false,
    waitingDecisionWorkIds: new Set<string>() as ReadonlySet<string>,
    decisionFor: () => undefined,
    statusOf: () => undefined,
    upload: vi.fn(async () => undefined),
    prepareNow: vi.fn(),
  };
}
let mockUploads = idleUploads();

function work(overrides: Partial<Work> & { id: string }): Work {
  return {
    title: overrides.id,
    actionUID: 1,
    gardenerAddress: "0xdef",
    gardenAddress: "0x00000000000000000000000000000000000000a1",
    feedback: "",
    metadata: "",
    media: [],
    createdAt: 1_700_000_100,
    status: "pending",
    ...overrides,
  } as Work;
}

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
  useReviewerGardenIds: () => ({ reviewerGardenIds: mockReviewerGardenIds, isLoading: false }),
}));

vi.mock("@green-goods/shared/hooks/work/useNeedsReview", () => ({
  useNeedsReview: () => mockNeedsReviewState,
}));

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => mockIsOnline,
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
  useTimeout: () => ({ set: vi.fn((fn: () => void) => fn()), clear: vi.fn() }),
}));

const mockRegisterOpenSheet = vi.fn(() => () => undefined);

vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: (
    selector: (s: {
      workDashboardInitialTab?: string;
      workDashboardInitialPendingFilter?: string;
      rememberWorkDashboard: () => void;
      registerOpenSheet: () => () => void;
    }) => unknown
  ) =>
    selector({
      workDashboardInitialTab: undefined,
      workDashboardInitialPendingFilter: undefined,
      rememberWorkDashboard: vi.fn(),
      registerOpenSheet: mockRegisterOpenSheet,
    }),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ user: { id: "0xabc" } }),
}));

vi.mock("@green-goods/shared/hooks/work/useWorkApprovals", () => ({
  useWorkApprovals: () => mockWorkApprovalsState,
}));

vi.mock("@green-goods/shared/hooks/work/useWorkUploads", () => ({
  useWorkUploads: () => mockUploads,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ ...mockMyApprovalsQueryState, refetch: mockMyApprovalsRefetch }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("../../components/Cards", () => ({
  MinimalWorkCard: ({
    work,
    onClick,
    presentation,
  }: {
    work: { title: string; feedback?: string };
    onClick: () => void;
    presentation?: { statusLabel?: string; contextLabel?: string; supportingText?: string };
  }) =>
    createElement(
      "button",
      { type: "button", onClick },
      createElement("span", null, work.title),
      work.feedback ? createElement("span", null, work.feedback) : null,
      presentation?.statusLabel && createElement("span", null, presentation.statusLabel),
      presentation?.contextLabel && createElement("span", null, presentation.contextLabel),
      presentation?.supportingText && createElement("span", null, presentation.supportingText)
    ),
}));

vi.mock("../../views/Home/WorkDashboard/Drafts", () => ({
  DraftsTab: () => createElement("div", null, "Drafts panel"),
}));

import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { WorkDashboard } from "../../views/Home/WorkDashboard";

function renderDashboard(onClose = vi.fn()) {
  const view = render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        IntlProvider,
        { locale: "en", messages: { "app.common.loading": "Loading" } },
        createElement(WorkDashboard, { onClose })
      )
    )
  );
  return { ...view, onClose };
}

describe("WorkDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewerGardenIds = [];
    mockIsOnline = true;
    mockUploads = idleUploads();
    mockNeedsReviewState = {
      allWorks: [],
      works: [],
      decidedHere: [],
      ready: true,
      isLoading: false,
      isFetching: false,
      isError: false,
      savedAt: undefined,
      refetch: vi.fn(async () => true),
    };
    mockWorkApprovalsState = {
      completedApprovals: [],
      isLoading: false,
      hasError: false,
      errorMessage: undefined,
      dataUpdatedAt: 0,
      refetch: vi.fn(ok),
    };
    mockMyApprovalsRefetch = vi.fn(ok);
    mockMyApprovalsQueryState = {
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
    };
    mockUseMyWorks.mockReturnValue({
      data: [
        work({
          id: "job-1",
          title: "Queued tree planting",
          gardenerAddress: "0xabc",
          createdAt: 1_700_000_000,
          status: "syncing",
        }),
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(ok),
    });
    mockUseMyOnlineWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    document.getElementById("app-scroll")?.remove();
    document.documentElement.classList.remove("modal-open");
  });

  it("opens on Pending and shows offline-included submitted work after submission", () => {
    renderDashboard();

    expect(screen.getByTestId("tab-drafts")).toBeInTheDocument();
    expect(screen.getByTestId("tab-pending")).toBeInTheDocument();
    expect(screen.getByTestId("tab-completed")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-recent")).not.toBeInTheDocument();
    // The dashboard rides the shared bottom sheet and its header names the dialog (DL-028).
    expect(screen.getByTestId("app-sheet")).toHaveAttribute("data-component", "PwaSheet");
    expect(screen.getByRole("dialog", { name: "Your Work" })).toBeInTheDocument();
    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(mockUseMyWorks).toHaveBeenCalledWith({ includeOffline: true });
    expect(mockUseMyOnlineWorks).not.toHaveBeenCalled();
  });

  it("keeps queued submissions visible when review-side queries fail", () => {
    mockNeedsReviewState = { ...mockNeedsReviewState, isError: true, ready: false };
    mockWorkApprovalsState = {
      ...mockWorkApprovalsState,
      hasError: true,
      errorMessage: "Approvals unavailable",
    };

    renderDashboard();

    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(screen.queryByText("Error loading data. Please try again.")).not.toBeInTheDocument();
  });

  it("keeps queued submissions visible while review-side queries are loading", () => {
    mockNeedsReviewState = { ...mockNeedsReviewState, isLoading: true, isFetching: true };
    mockWorkApprovalsState = { ...mockWorkApprovalsState, isLoading: true };

    renderDashboard();

    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(screen.queryByText("Loading your work...")).not.toBeInTheDocument();
  });

  it("lists Needs review from the garden reads and files a review made here under Completed", () => {
    mockReviewerGardenIds = ["0x00000000000000000000000000000000000000a1"];
    mockNeedsReviewState = {
      ...mockNeedsReviewState,
      works: [work({ id: "0xwaiting", title: "Waiting planting" })],
      decidedHere: [work({ id: "0xdecided", title: "Just approved planting", status: "approved" })],
    };
    mockUseMyWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(ok),
    });

    renderDashboard();

    expect(screen.getByText("Waiting planting")).toBeInTheDocument();
    expect(screen.queryByText("Just approved planting")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("tab-completed"));
    expect(screen.getByText("Just approved planting")).toBeInTheDocument();
  });

  it("offers Upload all only in Pending while online", () => {
    mockUploads = { ...idleUploads(), readyCount: 2, queuedCount: 2 };

    renderDashboard();

    const uploadAll = screen.getByTestId("upload-all");
    expect(uploadAll).toHaveTextContent("Upload all (2)");
    const actions = screen.getByTestId("work-list-actions");
    expect(within(actions).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(within(actions).getByTestId("upload-all")).toBe(uploadAll);
    expect(within(actions).queryByRole("combobox", { name: "Pending work filter" })).toBeNull();
    fireEvent.click(uploadAll);
    expect(mockUploads.upload).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("tab-completed"));
    expect(screen.queryByTestId("upload-all")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-drafts"));
    expect(screen.queryByTestId("upload-all")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-pending"));
    expect(screen.getByTestId("upload-all")).toHaveTextContent("Upload all (2)");

    fireEvent.change(screen.getByRole("combobox", { name: "Pending work filter" }), {
      target: { value: "mySubmissions" },
    });
    expect(screen.queryByTestId("upload-all")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Pending work filter" }), {
      target: { value: "all" },
    });
    expect(screen.getByTestId("upload-all")).toHaveTextContent("Upload all (2)");
  });

  it("does not offer an upload control while offline", () => {
    mockUploads = { ...idleUploads(), readyCount: 2, queuedCount: 2 };
    mockIsOnline = false;
    renderDashboard();
    expect(screen.queryByTestId("upload-all")).not.toBeInTheDocument();
  });

  it("shows no upload bar when nothing waits to upload", () => {
    mockUploads = { ...idleUploads(), attentionCount: 1, queuedCount: 1 };

    renderDashboard();

    expect(screen.queryByTestId("upload-all")).not.toBeInTheDocument();
  });

  it("marks a decision made here as waiting to upload until Upload all sends it", () => {
    mockNeedsReviewState = {
      ...mockNeedsReviewState,
      decidedHere: [
        work({ id: "0xDECIDED", title: "Queued approval", status: "approved" }),
        work({ id: "0xsent", title: "Sent approval", status: "approved" }),
      ],
    };
    mockUploads = {
      ...idleUploads(),
      readyCount: 1,
      queuedCount: 1,
      waitingDecisionWorkIds: new Set(["0xdecided"]),
    };

    renderDashboard();
    const queued = screen.getByRole("button", { name: /Queued approval/ });
    expect(within(queued).getByText("Reviewed by you")).toBeInTheDocument();
    expect(within(queued).getByText("To upload")).toBeInTheDocument();
    expect(within(queued).getByText("Approval saved on this device")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-completed"));
    expect(screen.queryByRole("button", { name: /Queued approval/ })).not.toBeInTheDocument();
    const sent = screen.getByRole("button", { name: /Sent approval/ });
    expect(within(sent).queryByText("Approval saved on this device")).not.toBeInTheDocument();
  });

  it("keeps an on-chain submission out of Pending until its review read lands", () => {
    mockUseMyWorks.mockReturnValue({
      data: [
        work({
          id: "job-1",
          title: "Queued tree planting",
          gardenerAddress: "0xabc",
          status: "offline",
        }),
        work({ id: "0xonchain", title: "Submitted planting", gardenerAddress: "0xabc" }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(ok),
    });
    mockMyApprovalsQueryState = { ...mockMyApprovalsQueryState, data: undefined, isError: true };

    renderDashboard();

    expect(screen.getByText("Queued tree planting")).toBeInTheDocument();
    expect(screen.queryByText("Submitted planting")).not.toBeInTheDocument();
  });

  it("re-reads everything the dashboard shows from one Refresh", async () => {
    const refetchMyWorks = vi.fn(ok);
    mockUseMyWorks.mockReturnValue({
      data: [work({ id: "0xmine", title: "My planting", gardenerAddress: "0xabc" })],
      isLoading: false,
      isError: false,
      refetch: refetchMyWorks,
    });

    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(mockNeedsReviewState.refetch).toHaveBeenCalledOnce());
    expect(refetchMyWorks).toHaveBeenCalledOnce();
    expect(mockWorkApprovalsState.refetch).toHaveBeenCalledOnce();
    expect(mockMyApprovalsRefetch).toHaveBeenCalledOnce();
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it("shows a toast when a refresh someone asked for fails", async () => {
    mockNeedsReviewState = { ...mockNeedsReviewState, refetch: vi.fn(async () => false) };

    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() =>
      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Couldn't refresh. Try again." })
      )
    );
  });

  it("says when the list was saved while offline and hides Refresh", () => {
    mockIsOnline = false;
    mockNeedsReviewState = { ...mockNeedsReviewState, savedAt: Date.now() - 60_000 };

    renderDashboard();

    expect(screen.getByText(/^Offline · /)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("shows the My submissions view without waiting for Needs review to load", () => {
    mockNeedsReviewState = { ...mockNeedsReviewState, isLoading: true, isFetching: true };
    mockUseMyWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(ok),
    });

    renderDashboard();
    fireEvent.change(screen.getByDisplayValue("All"), { target: { value: "mySubmissions" } });

    expect(screen.queryByText("Loading your work...")).not.toBeInTheDocument();
    expect(screen.getByText("No pending work")).toBeInTheDocument();
  });

  it("offers no Retry on a failed load while offline", () => {
    mockIsOnline = false;
    mockNeedsReviewState = { ...mockNeedsReviewState, isError: true, ready: false };
    mockUseMyWorks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(ok),
    });

    renderDashboard();

    expect(screen.getByText("Unable to load work")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("keeps Completed loading while the gardener's own work is still being read", () => {
    mockUseMyWorks.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(ok),
    });

    renderDashboard();
    fireEvent.click(screen.getByTestId("tab-completed"));

    expect(screen.getByText("Loading your work...")).toBeInTheDocument();
    expect(screen.queryByText("No completed work")).not.toBeInTheDocument();
  });

  it("opens the original work route from the My work reviewed completed filter", () => {
    const onClose = vi.fn();
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

    renderDashboard(onClose);

    fireEvent.click(screen.getByTestId("tab-completed"));
    // Completed opens on All, so a gardener sees their reviewed work without filtering.
    expect(screen.getByText("Reviewed planting")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: /completed work filter/i }), {
      target: { value: "myWorkReviewed" },
    });
    fireEvent.click(screen.getByText("Reviewed planting"));

    expect(onClose).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/home/garden-42/work/reviewed-work", {
      state: { from: "dashboard", returnTo: "/home", workStatus: "approved" },
      viewTransition: true,
    });
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0]
    );
  });

  it("owns dashboard scrolling explicitly and resets that owner on tab changes", () => {
    const appScroll = document.createElement("div");
    appScroll.id = "app-scroll";
    appScroll.scrollTop = 900;
    document.body.append(appScroll);

    renderDashboard();

    const dashboardScroll = document.getElementById("work-dashboard-scroll");
    expect(dashboardScroll).not.toBeNull();
    if (!dashboardScroll) throw new Error("WorkDashboard scroll owner is missing");
    dashboardScroll.scrollTop = 420;

    fireEvent.click(screen.getByTestId("tab-completed"));

    expect(dashboardScroll.scrollTop).toBe(0);
    expect(appScroll.scrollTop).toBe(900);
    expect(dashboardScroll.querySelector(".overflow-y-auto")).toBeNull();
    // A tabbed workspace holds the full sheet tier so tab switches never resize
    // it (DL-014), and it registers as open so the AppBar steps aside (DL-015).
    expect(screen.getByTestId("app-sheet")).toHaveAttribute("data-sheet-size", "full");
    expect(mockRegisterOpenSheet).toHaveBeenCalled();
  });

  it("closes from Escape while focus is inside the dialog", () => {
    const { onClose } = renderDashboard();
    const closeButton = screen.getByTestId("app-sheet-close");
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
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
    fireEvent.change(screen.getByRole("combobox", { name: /completed work filter/i }), {
      target: { value: "myWorkReviewed" },
    });

    expect(screen.getByText("Reviewed planting")).toBeInTheDocument();
    expect(screen.queryByText("Original field notes from the submitter")).not.toBeInTheDocument();
  });
});
