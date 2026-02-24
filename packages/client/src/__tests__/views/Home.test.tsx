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
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  queryKeys: { gardens: { all: ["gardens"] } },
  toastService: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
  useAuth: () => ({
    smartAccountAddress: "0x1234567890abcdef1234567890abcdef12345678",
    walletAddress: null,
    isAuthenticated: true,
  }),
  useBrowserNavigation: vi.fn(),
  useFilteredGardens: (gardens: unknown[]) => ({
    filteredGardens: gardens,
    myGardensCount: 1,
    isFilterActive: false,
    activeFilterCount: 0,
  }),
  useGardens: () => ({
    data: [
      {
        id: "garden-1",
        name: "Test Garden",
        location: "Test Location",
        bannerImage: "",
        gardeners: ["0x1234567890abcdef1234567890abcdef12345678"],
        operators: [],
        createdAt: Date.now(),
      },
    ],
    isFetching: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useLoadingWithMinDuration: () => ({
    showSkeleton: false,
    timedOut: false,
    reset: vi.fn(),
  }),
  useNavigateToTop: () => vi.fn(),
  useOffline: () => ({ isOnline: true }),
  usePrimaryAddress: () => "0x1234567890abcdef1234567890abcdef12345678",
  useTimeout: () => ({
    set: vi.fn(),
    clear: vi.fn(),
    isPending: vi.fn(() => false),
  }),
  useUIStore: (selector: (s: any) => any) => {
    const state = {
      isGardenFilterOpen: false,
      openGardenFilter: vi.fn(),
      closeGardenFilter: vi.fn(),
    };
    return selector(state);
  },
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
vi.mock("@remixicon/react", () => ({
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
