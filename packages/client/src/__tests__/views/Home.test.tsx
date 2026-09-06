/**
 * Home View Smoke Tests
 *
 * Tests that the Home view renders without crashing.
 */

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the shared barrel — Home imports all hooks/stores/utils from @green-goods/shared
vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/config/query-keys/registry", () => ({
  queryKeys: { gardens: { all: ["gardens"] } },
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@green-goods/shared/hooks/app/useArrivalState", () => ({
  useArrivalState: () => ({ kind: "none", myGardenIds: [], needsReviewCount: 0 }),
}));

vi.mock("@green-goods/shared/hooks/auth/useAuth", () => ({
  useAuthState: () => ({
    isAuthenticated: true,
  }),
}));

vi.mock("@green-goods/shared/hooks/app/useBrowserNavigation", () => ({
  useBrowserNavigation: vi.fn(),
}));

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("@green-goods/shared/hooks/garden/useFilteredGardens", () => ({
  useFilteredGardens: (gardens: unknown[]) => ({
    filteredGardens: gardens,
    myGardensCount: 1,
    isFilterActive: false,
    activeFilterCount: 0,
  }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({
    data: [
      {
        id: "garden-1",
        name: "Test Garden",
        location: "Test Location",
        bannerImage: "",
        gardeners: ["0x1234567890abcdef1234567890abcdef12345678"],
        stewards: [],
        createdAt: Date.now(),
      },
    ],
    isFetching: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/app/useLoadingWithMinDuration", () => ({
  useLoadingWithMinDuration: () => ({
    showSkeleton: false,
    timedOut: false,
    reset: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@green-goods/shared/hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1234567890abcdef1234567890abcdef12345678",
}));

vi.mock("@green-goods/shared/hooks/utils/useTimeout", () => ({
  useTimeout: () => ({
    set: vi.fn(),
    clear: vi.fn(),
    isPending: vi.fn(() => false),
  }),
}));

vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: (selector: (s: any) => any) => {
    const state = {
      isGardenFilterOpen: false,
      openGardenFilter: vi.fn(),
      closeGardenFilter: vi.fn(),
      openWorkDashboard: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentsInbox: () => ({
    live: [],
    settled: [],
    liveActCount: 0,
    settledActCount: 0,
    totalActCount: 0,
    availability: { status: "unknown-chain" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCommitmentsToConfirm: () => ({
    groups: [],
    count: 0,
    isSteward: false,
    availability: { status: "unknown-chain" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

// Mock @remixicon/react
vi.mock("@remixicon/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remixicon/react")>()),
  RiFilterLine: (props: any) => createElement("span", { "data-testid": "filter-icon", ...props }),
}));

// Mock local components
vi.mock("@/components/Inputs", () => ({
  PullToRefresh: ({ children }: { children: any }) =>
    createElement("div", { "data-testid": "pull-to-refresh" }, children),
}));

vi.mock("../../views/Home/GardenList", () => ({
  GardenList: ({ gardens, onCardClick }: { gardens: any[]; onCardClick: (id: string) => void }) =>
    createElement(
      "div",
      { "data-testid": "garden-list" },
      gardens.map((g: any) =>
        createElement(
          "button",
          {
            key: g.id,
            "data-testid": "garden-card",
            type: "button",
            onClick: () => onCardClick(g.id),
          },
          g.name
        )
      )
    ),
}));

vi.mock("../../views/Home/GardenFilters", () => ({
  GardenFilterScope: {},
  GardenSortOrder: {},
  GardensFilterDrawer: () => null,
}));

vi.mock("../../views/Home/WalletDrawer/Icon", () => ({
  WalletDrawerIcon: () => createElement("button", { "data-testid": "wallet-drawer-icon" }),
}));

vi.mock("../../views/Home/CommitmentsDrawer/Icon", () => ({
  CommitmentsDrawerIcon: () =>
    createElement("button", { "data-testid": "commitments-drawer-icon" }),
}));

vi.mock("../../views/Home/CommitmentsDrawer", () => ({
  CommitmentsDrawer: () => null,
}));

vi.mock("../../views/Home/WalletDrawer", () => ({
  WalletDrawer: () => null,
}));

vi.mock("../../views/Home/WorkDashboard/Icon", () => ({
  WorkDashboardIcon: () => createElement("button", { "data-testid": "work-dashboard-icon" }),
}));

// Import after mocks
import Home from "../../views/Home";

const messages = {
  "app.home": "Home",
  "app.home.filters.button": "Filters",
  "app.home.pullToRefresh": "Pull to refresh gardens",
  "app.home.messages.noGardensFound": "No gardens found",
};

const renderWithProviders = (initialRoute = "/home") => {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialRoute] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/home/*", element: createElement(Home) })
        )
      )
    )
  );
};

describe("Home View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    renderWithProviders();

    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("displays home title", () => {
    renderWithProviders();

    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("renders garden cards when data is available", () => {
    renderWithProviders();

    expect(screen.getByTestId("garden-card")).toBeInTheDocument();
    expect(screen.getByText("Test Garden")).toBeInTheDocument();
  });

  it("shows filter button", () => {
    renderWithProviders();

    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
  });

  it("shows work dashboard icon", () => {
    renderWithProviders();

    expect(screen.getByTestId("work-dashboard-icon")).toBeInTheDocument();
  });
});
