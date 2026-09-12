import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@green-goods/shared/i18n/en.json";

const mockShareLink = vi.fn().mockResolvedValue(undefined);
vi.mock("@green-goods/shared/utils/app/clipboard", () => ({
  shareLink: (...args: unknown[]) => mockShareLink(...args),
}));

const mockNavigate = vi.fn();
let mockPrimaryAddress: `0x${string}` | null = null;
const mockUseGardenTabs = vi.fn(() => ({
  activeTab: "Work",
  setActiveTab: vi.fn(),
}));
const mockUseGardens = vi.fn(() => ({
  data: [] as Array<Record<string, unknown>>,
  isLoading: false,
  isFetching: true,
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

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenTabs", () => ({
  GardenTab: {
    Work: "Work",
    Insights: "Insights",
    Gardeners: "Gardeners",
  },
  useGardenTabs: () => mockUseGardenTabs(),
}));

vi.mock("@green-goods/shared/components/Display/GardenBannerFallback", () => ({
  GardenBannerFallback: ({ name, className }: { name: string; className?: string }) =>
    createElement("div", { "data-testid": "garden-banner-fallback", className }, name),
}));

vi.mock("@green-goods/shared/components/Display/ImageWithFallback", () => ({
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
}));

vi.mock("@green-goods/shared/hooks/garden/useJoinGarden", () => ({
  isGardenMember: vi.fn(() => false),
  useJoinGarden: () => ({
    joinGarden: vi.fn(),
    isJoining: false,
  }),
  usePendingJoinsVersion: () => 0,
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [], isLoading: false }),
  useGardeners: () => ({ data: [] }),
  useGardens: () => mockUseGardens(),
}));

vi.mock("@green-goods/shared/hooks/app/useBrowserNavigation", () => ({
  useBrowserNavigation: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/conviction/useConvictionStrategies", () => ({
  useConvictionStrategies: () => ({ strategies: [{ id: "configured-strategy" }] }),
}));

vi.mock("@green-goods/shared/hooks/vault/useGardenVaults", () => ({
  useGardenVaults: () => ({ vaults: [] }),
}));

vi.mock("@green-goods/shared/hooks/roles/useHasRole", () => ({
  useHasRole: () => ({ hasRole: true }),
}));

vi.mock("@green-goods/shared/hooks/app/useNavigateToTop", () => ({
  useNavigateToTop: () => mockNavigate,
}));

vi.mock("@green-goods/shared/hooks/app/useScrollToTop", () => ({
  useScrollToTop: vi.fn(),
}));

vi.mock("@green-goods/shared/stores/useUIStore", () => ({
  useUIStore: Object.assign(
    vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        isEndowmentSheetOpen: false,
        openEndowmentSheet: vi.fn(),
        closeEndowmentSheet: vi.fn(),
      })
    ),
    {
      getState: () => ({
        isEndowmentSheetOpen: false,
        openEndowmentSheet: vi.fn(),
        closeEndowmentSheet: vi.fn(),
      }),
    }
  ),
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mockPrimaryAddress }),
}));

vi.mock("@green-goods/shared/hooks/vault/useVaultDeposits", () => ({
  useVaultDeposits: () => ({ deposits: [] }),
}));

vi.mock("@green-goods/shared/hooks/work/useWorks", () => ({
  useWorks: () => ({
    works: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitmentPools: () => ({ pools: [], availability: { status: "unknown-chain" } }),
}));

vi.mock("viem", () => ({
  isAddress: () => true,
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void }) =>
    createElement("button", { onClick }, label),
}));

vi.mock("@/components/Sheets", () => ({
  ConvictionSheet: () => createElement("div", { "data-testid": "conviction-drawer" }),
  EndowmentSheet: () => null,
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
  GardenJoinRequestDialog: () => createElement("div", { "data-testid": "join-request-dialog" }),
  GardenWork: () => createElement("div", null, "Work"),
  JoinGardenButton: ({ gardenName }: { gardenName: string }) =>
    createElement("button", { type: "button", "data-testid": "join-garden-button" }, gardenName),
}));

vi.mock("@/components/Navigation", () => ({
  StandardTabs: () => createElement("div", null, "Tabs"),
  TopNav: ({
    onBackClick,
    showGovernanceButton,
  }: {
    onBackClick?: () => void;
    showGovernanceButton?: boolean;
  }) =>
    createElement(
      "button",
      { type: "button", onClick: onBackClick, "data-testid": "top-nav-back" },
      showGovernanceButton ? "Governance" : "Back"
    ),
}));

import { Garden } from "../../views/Home/Garden";

describe("Home garden route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = null;
    mockUseGardenTabs.mockReturnValue({
      activeTab: "Work",
      setActiveTab: vi.fn(),
    });
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
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
          stewards: [],
          openJoining: false,
        },
      ],
      isLoading: false,
      isFetching: false,
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
    expect(screen.queryByTestId("conviction-drawer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /governance/i })).not.toBeInTheDocument();
  });

  it("does not offer a closed-garden join request to an owner", () => {
    mockPrimaryAddress = "0x9999999999999999999999999999999999999999";
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          name: "Owner Garden",
          bannerImage: "/banner.png",
          location: "Test Location",
          createdAt: Date.now(),
          description: "Garden description",
          assessments: [],
          gardeners: [],
          stewards: [],
          owners: [mockPrimaryAddress],
          openJoining: false,
        },
      ],
      isLoading: false,
      isFetching: false,
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

    expect(screen.queryByTestId("join-request-dialog")).not.toBeInTheDocument();
  });
  it("shares the garden record rather than the current browser route", async () => {
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          name: "Test Garden",
          location: "Here",
          createdAt: 0,
          assessments: [],
          gardeners: [],
          stewards: [],
          openJoining: false,
        },
      ],
      isLoading: false,
      isFetching: false,
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
    expect(screen.queryByTestId("conviction-drawer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /governance/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Share Garden" }));
    await waitFor(() =>
      expect(mockShareLink).toHaveBeenCalledWith({
        title: "Test Garden",
        url: `${window.location.origin}/home/garden-1`,
      })
    );
  });

  it("offers Join Garden on an open garden the viewer has not joined", () => {
    mockPrimaryAddress = "0x00000000000000000000000000000000000000aa";
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          name: "Open Garden",
          bannerImage: "/banner.png",
          location: "Test Location",
          createdAt: Date.now(),
          description: "Garden description",
          assessments: [],
          gardeners: [],
          stewards: [],
          openJoining: true,
        },
      ],
      isLoading: false,
      isFetching: false,
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

    expect(screen.getByTestId("join-garden-button")).toHaveTextContent("Open Garden");
  });
});
