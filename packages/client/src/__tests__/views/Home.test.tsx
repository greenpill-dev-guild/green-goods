/**
 * Home View Smoke Tests
 *
 * Tests that the Home view renders without crashing.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared hooks
vi.mock("@green-goods/shared/hooks", () => ({
  queryKeys: { gardens: { all: ["gardens"] } },
  useAuth: () => ({
    smartAccountAddress: "0x1234567890abcdef1234567890abcdef12345678",
    walletAddress: null,
  }),
  useBrowserNavigation: vi.fn(),
  useFilteredGardens: (gardens: unknown[], _filters: unknown, _address: unknown) => ({
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
}));

vi.mock("@green-goods/shared/stores", () => ({
  useUIStore: () => ({
    isGardenFilterOpen: false,
    openGardenFilter: vi.fn(),
    closeGardenFilter: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  gardenHasMember: (address: string, gardeners: string[]) =>
    gardeners.includes(address.toLowerCase()),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

// Mock components
vi.mock("@/components/Cards", () => ({
  GardenCard: ({ garden, onClick }: { garden: { name: string }; onClick?: () => void }) =>
    createElement("button", { "data-testid": "garden-card", onClick, type: "button" }, garden.name),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-skeleton" }),
}));

vi.mock("../../views/Home/GardenFilters", () => ({
  GardenFilterScope: {},
  GardenSortOrder: {},
  GardensFilterDrawer: () => null,
}));

vi.mock("../../views/Home/WorkDashboard/Icon", () => ({
  WorkDashboardIcon: () => createElement("button", { "data-testid": "work-dashboard-icon" }),
}));

// Import after mocks
import Home from "../../views/Home";

const messages = {
  "app.home": "Home",
  "app.home.filters.button": "Filters",
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

  afterEach(() => {
    cleanup();
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
