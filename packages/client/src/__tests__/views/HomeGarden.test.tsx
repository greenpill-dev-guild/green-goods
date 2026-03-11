import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockUseGardenTabs = vi.fn(() => ({
  activeTab: "Work",
  setActiveTab: vi.fn(),
}));
const mockUseGardens = vi.fn(() => ({
  data: [],
  isLoading: false,
  isFetching: true,
}));
const mockUseGardenAssessments = vi.fn(() => ({
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
}));
const mockGardenAssessments = vi.fn(
  ({
    assessments,
    assessmentFetchStatus,
  }: {
    assessments: Array<{ id: string }>;
    assessmentFetchStatus: "pending" | "success" | "error";
  }) =>
    createElement(
      "div",
      { "data-testid": "garden-assessments" },
      `${assessmentFetchStatus}:${assessments.map((assessment) => assessment.id).join(",")}`
    )
);

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  GardenTab: {
    Work: "Work",
    Insights: "Insights",
    Gardeners: "Gardeners",
  },
  GardenBannerFallback: ({ name, className }: { name: string; className?: string }) =>
    createElement("div", { "data-testid": "garden-banner-fallback", className }, name),
  ImageWithFallback: ({
    src,
    alt,
    className,
    backgroundFallback,
  }: {
    src: string;
    alt: string;
    className?: string;
    loading?: string;
    backgroundFallback?: React.ReactNode;
  }) =>
    src
      ? createElement("img", { src, alt, className })
      : (backgroundFallback ?? createElement("img", { src: "", alt, className })),
  isGardenMember: vi.fn(() => false),
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
  useActions: () => ({ data: [], isLoading: false }),
  useGardenAssessments: (...args: unknown[]) => mockUseGardenAssessments(...args),
  useBrowserNavigation: vi.fn(),
  useConvictionStrategies: () => ({ strategies: [] }),
  useGardeners: () => ({ data: [] }),
  useGardenTabs: (...args: unknown[]) => mockUseGardenTabs(...args),
  useGardenVaults: () => ({ vaults: [] }),
  useGardens: (...args: unknown[]) => mockUseGardens(...args),
  useHasRole: () => ({ hasRole: false }),
  useJoinGarden: () => ({
    joinGarden: vi.fn(),
    isJoining: false,
  }),
  useNavigateToTop: () => mockNavigate,
  useScrollToTop: vi.fn(),
  useUIStore: Object.assign(
    vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isEndowmentDrawerOpen: false,
        openEndowmentDrawer: vi.fn(),
        closeEndowmentDrawer: vi.fn(),
      })
    ),
    {
      getState: () => ({
        isEndowmentDrawerOpen: false,
        openEndowmentDrawer: vi.fn(),
        closeEndowmentDrawer: vi.fn(),
      }),
    }
  ),
  useUser: () => ({ primaryAddress: null }),
  useVaultDeposits: () => ({ deposits: [] }),
  useWorks: () => ({
    works: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("viem", () => ({
  isAddress: () => true,
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label }: { label: string }) => createElement("button", null, label),
}));

vi.mock("@/components/Dialogs", () => ({
  ConvictionDrawer: () => null,
  EndowmentDrawer: () => null,
}));

vi.mock("@/components/Errors", () => ({
  GardenErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "garden-boundary" }, children),
}));

vi.mock("@/components/Features", () => ({
  GardenAssessments: (props: {
    assessments: Array<{ id: string }>;
    assessmentFetchStatus: "pending" | "success" | "error";
    description?: string | null;
  }) => mockGardenAssessments(props),
  GardenGardeners: () => createElement("div", null, "Gardeners"),
  GardenWork: () => createElement("div", null, "Work"),
}));

vi.mock("@/components/Navigation", () => ({
  StandardTabs: () => createElement("div", null, "Tabs"),
  TopNav: ({ onBackClick }: { onBackClick?: () => void }) =>
    createElement(
      "button",
      { type: "button", onClick: onBackClick, "data-testid": "top-nav-back" },
      "Back"
    ),
}));

import { Garden } from "../../views/Home/Garden";

const messages = {
  "app.garden.loading": "Loading garden...",
  "app.garden.notFound": "Garden not found",
};

describe("Home garden route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardenTabs.mockReturnValue({
      activeTab: "Work",
      setActiveTab: vi.fn(),
    });
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
    });
    mockUseGardenAssessments.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
    });
  });

  it("shows the loading state while placeholder garden data is still fetching", () => {
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: true,
      isFetching: true,
    });
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/home/:id", element: createElement(Garden) })
          )
        )
      )
    );

    expect(screen.getByText("Loading garden...")).toBeInTheDocument();
    expect(screen.queryByText("Garden not found")).not.toBeInTheDocument();
  });

  it("renders the insights tab from shared assessment data instead of the garden snapshot", () => {
    mockUseGardenTabs.mockReturnValue({
      activeTab: "Insights",
      setActiveTab: vi.fn(),
    });
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          name: "Test Garden",
          bannerImage: "/banner.png",
          location: "Test Location",
          createdAt: Date.now(),
          description: "Garden description",
          assessments: [
            {
              id: "assessment-1",
              title: "Soil Health",
            },
          ],
          gardeners: [],
          operators: [],
          openJoining: false,
        },
      ],
      isLoading: false,
      isFetching: false,
    });
    mockUseGardenAssessments.mockReturnValue({
      data: [
        {
          id: "assessment-1",
          title: "Soil Health",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
    });

    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/home/:id", element: createElement(Garden) })
          )
        )
      )
    );

    expect(screen.getByTestId("garden-assessments")).toHaveTextContent("success:assessment-1");
    expect(mockGardenAssessments).toHaveBeenCalledWith(
      expect.objectContaining({
        assessments: [expect.objectContaining({ id: "assessment-1" })],
        assessmentFetchStatus: "success",
        description: "Garden description",
      })
    );
  });
});
