import messages from "@green-goods/shared/i18n/en.json";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import {
  MemoryRouter,
  type NavigateFunction,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    records,
    assessmentFetchStatus,
  }: {
    records: Array<{ summary: { id: string } }>;
    assessmentFetchStatus: "pending" | "success" | "error";
  }) =>
    createElement(
      "div",
      { "data-testid": "garden-assessments" },
      `${assessmentFetchStatus}:${records.map((record) => record.summary.id).join(",")}`
    )
);
const mockUseGardenAssessmentRecords = vi.fn((_gardenAddress?: string, _chainId?: number) => ({
  records: [] as Array<{ summary: { id: string } }>,
  status: "pending" as "pending" | "success" | "error",
}));

vi.mock("@green-goods/shared/hooks/assessment/useGardenAssessmentRecords", () => ({
  useGardenAssessmentRecords: (gardenAddress?: string, chainId?: number) =>
    mockUseGardenAssessmentRecords(gardenAddress, chainId),
}));

vi.mock("@green-goods/shared/config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// The tabs are held still; the access predicate (`useGardenAccess`) runs for real on the
// garden's record and the mocked reads below.
vi.mock("@green-goods/shared/hooks/garden/useGardenTabs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/hooks/garden/useGardenTabs")>()),
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

vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  isAddress: () => true,
}));

vi.mock("@/components/Sheets", () => ({
  ConvictionSheet: () => createElement("div", { "data-testid": "conviction-drawer" }),
  EndowmentSheet: () => null,
}));

vi.mock("@/components/Errors/AppErrorBoundary", () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "garden-boundary" }, children),
}));

vi.mock("@/components/Features", () => ({
  GardenAssessments: (props: {
    records: Array<{ summary: { id: string } }>;
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
    onShareClick,
  }: {
    onBackClick?: () => void;
    showGovernanceButton?: boolean;
    onShareClick?: () => void;
  }) =>
    createElement(
      "div",
      null,
      createElement(
        "button",
        { type: "button", onClick: onBackClick, "data-testid": "top-nav-back" },
        showGovernanceButton ? "Governance" : "Back"
      ),
      onShareClick
        ? createElement("button", { type: "button", onClick: onShareClick }, "Share Garden")
        : null
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

  it("says a garden read failed and offers it again, rather than calling the garden missing", () => {
    const refetch = vi.fn();
    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: true,
      refetch,
    } as never);
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

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this garden");
    expect(screen.queryByText("Garden not found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  // The garden list carries no assessments: they are attestations read from EAS,
  // each with detail stored on IPFS.
  it("renders the insights tab from the garden's assessment records, not the garden snapshot", () => {
    mockUseGardenTabs.mockReturnValue({
      activeTab: "Insights",
      setActiveTab: vi.fn(),
    });
    mockUseGardenAssessmentRecords.mockReturnValue({
      records: [{ summary: { id: "assessment-1" } }],
      status: "success",
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

    expect(screen.getByTestId("garden-assessments")).toHaveTextContent("success:assessment-1");
    expect(mockGardenAssessments).toHaveBeenCalledWith(
      expect.objectContaining({
        records: [{ summary: { id: "assessment-1" } }],
        assessmentFetchStatus: "success",
        description: "Garden description",
      })
    );
    expect(mockUseGardenAssessmentRecords).toHaveBeenLastCalledWith("garden-1", 11155111);
    expect(screen.queryByTestId("conviction-drawer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /governance/i })).not.toBeInTheDocument();
  });

  // An EAS read and two IPFS files per assessment are not spent on a tab most
  // visits never open.
  it("reads no assessments until the reader opens Insights", () => {
    mockUseGardens.mockReturnValue({
      data: [
        {
          id: "garden-1",
          name: "Test Garden",
          bannerImage: "/banner.png",
          location: "Test Location",
          createdAt: Date.now(),
          description: "Garden description",
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

    expect(mockUseGardenAssessmentRecords).toHaveBeenLastCalledWith(undefined, 11155111);
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

describe("Home garden visit", () => {
  const gardenRecord = (id: string, name: string) => ({
    id,
    name,
    location: "Here",
    createdAt: 0,
    assessments: [],
    gardeners: [],
    stewards: [],
    openJoining: false,
  });

  let navigate: NavigateFunction;
  let location = "";
  function Probe() {
    navigate = useNavigate();
    location = useLocation().pathname;
    return null;
  }

  /** Explore, then the garden's page with its child work page, as the app routes them. */
  const renderVisit = () =>
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/explore"] },
        createElement(
          IntlProvider,
          { locale: "en", messages },
          createElement(Probe),
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/home/explore",
              element: createElement("p", null, "Explore gardens"),
            }),
            createElement(
              Route,
              { path: "/home/:id", element: createElement(Garden) },
              createElement(Route, {
                path: "work/:workId",
                element: createElement("p", null, "Work detail"),
              })
            )
          )
        )
      )
    );
  const visitFromExplore = (id = "garden-1") =>
    act(() => {
      void navigate(`/home/${id}`, { state: { returnTo: "/home/explore" } });
    });
  const back = () => fireEvent.click(screen.getByTestId("top-nav-back"));

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = null;
    mockUseGardenTabs.mockReturnValue({ activeTab: "Work", setActiveTab: vi.fn() });
    mockUseGardens.mockReturnValue({
      data: [gardenRecord("garden-1", "Garden One"), gardenRecord("garden-2", "Garden Two")],
      isLoading: false,
      isFetching: false,
    });
  });

  it("goes back to Explore from a garden visited there, by stepping back rather than pushing", () => {
    renderVisit();
    visitFromExplore();
    expect(screen.getByRole("heading", { level: 1, name: "Garden One" })).toBeInTheDocument();

    back();
    expect(location).toBe("/home/explore");
    expect(screen.getByText("Explore gardens")).toBeInTheDocument();
    // The visit was popped, not covered: forward returns to it.
    act(() => {
      void navigate(1);
    });
    expect(location).toBe("/home/garden-1");
  });

  it("keeps the return target across the garden's child pages, replacing the page they return to", () => {
    renderVisit();
    visitFromExplore();
    // A work's page pushes the garden's page again on its own Back, without Explore's state.
    act(() => {
      void navigate("/home/garden-1/work/work-1");
    });
    expect(screen.getByText("Work detail")).toBeInTheDocument();
    act(() => {
      void navigate("/home/garden-1");
    });

    back();
    expect(location).toBe("/home/explore");
    // The garden's second entry was replaced, so Back from here is the work page, and nothing
    // was pushed: the history never grows from pressing Back.
    act(() => {
      void navigate(-1);
    });
    expect(location).toBe("/home/garden-1/work/work-1");
  });

  it("goes Home from a garden opened by link, replacing the entry rather than stacking on it", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/home/garden-1"] },
        createElement(
          IntlProvider,
          { locale: "en", messages },
          createElement(Probe),
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/home", element: createElement("p", null, "Home") }),
            createElement(Route, { path: "/home/:id", element: createElement(Garden) })
          )
        )
      )
    );

    back();
    expect(location).toBe("/home");
    act(() => {
      void navigate(-1);
    });
    // Nothing before the link to go back to: the entry was replaced, so Back stays put.
    expect(location).toBe("/home");
  });

  it("starts the garden's page afresh when the garden changes, so its open tab resets", () => {
    renderVisit();
    visitFromExplore("garden-1");
    const first = screen.getByTestId("garden-header");

    act(() => {
      void navigate("/home/garden-2");
    });
    expect(screen.getByRole("heading", { level: 1, name: "Garden Two" })).toBeInTheDocument();
    // A new page element: the tabs' state, which lives in the page, started over with it.
    expect(screen.getByTestId("garden-header")).not.toBe(first);
  });
});

describe("Home garden header spacer", () => {
  const HEADER_HEIGHT = 291;
  const resizeObservers = new Set<FakeResizeObserver>();
  const originalResizeObserver = globalThis.ResizeObserver;

  class FakeResizeObserver {
    private readonly targets = new Set<Element>();

    constructor(private readonly callback: ResizeObserverCallback) {
      resizeObservers.add(this);
    }

    observe(target: Element) {
      this.targets.add(target);
    }

    unobserve(target: Element) {
      this.targets.delete(target);
    }

    disconnect() {
      this.targets.clear();
      resizeObservers.delete(this);
    }

    /** Browsers report a target removed from the document as 0 × 0. */
    report() {
      const entries = [...this.targets].map((target) => ({
        target,
        contentRect: { height: target.isConnected ? HEADER_HEIGHT : 0 },
      }));
      if (entries.length === 0) return;
      this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
    }
  }

  const flushResizeObservations = () =>
    act(() => {
      for (const observer of [...resizeObservers]) observer.report();
    });

  const garden = {
    id: "garden-1",
    name: "Test Garden",
    location: "Here",
    createdAt: 0,
    assessments: [],
    gardeners: [],
    stewards: [],
    openJoining: false,
  };

  let navigate: NavigateFunction;
  function CaptureNavigate() {
    navigate = useNavigate();
    return null;
  }

  const gardenRoutes = () =>
    createElement(
      MemoryRouter,
      { initialEntries: ["/home/garden-1"] },
      createElement(
        IntlProvider,
        { locale: "en", messages },
        createElement(CaptureNavigate),
        createElement(
          Routes,
          null,
          createElement(
            Route,
            { path: "/home/:id", element: createElement(Garden) },
            createElement(Route, {
              path: "work/:workId",
              element: createElement("p", null, "Work detail"),
            })
          )
        )
      )
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrimaryAddress = null;
    mockUseGardenTabs.mockReturnValue({ activeTab: "Work", setActiveTab: vi.fn() });
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    resizeObservers.clear();
  });

  it("keeps the list below the header after returning from a work", () => {
    mockUseGardens.mockReturnValue({ data: [garden], isLoading: false, isFetching: false });
    render(gardenRoutes());
    flushResizeObservations();
    expect(screen.getByTestId("garden-header-spacer")).toHaveStyle({
      height: `${HEADER_HEIGHT}px`,
    });

    // Approving a work, or pressing Back, returns to the garden route while Garden stays mounted.
    act(() => {
      void navigate("/home/garden-1/work/work-1");
    });
    expect(screen.getByText("Work detail")).toBeInTheDocument();
    expect(screen.queryByTestId("garden-header")).not.toBeInTheDocument();
    flushResizeObservations();

    act(() => {
      void navigate("/home/garden-1");
    });
    flushResizeObservations();
    expect(screen.getByTestId("garden-header-spacer")).toHaveStyle({
      height: `${HEADER_HEIGHT}px`,
    });
  });

  it("measures the header when the garden arrives after the route mounts", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: true, isFetching: true });
    const view = render(gardenRoutes());
    expect(screen.getByText("Loading garden...")).toBeInTheDocument();

    mockUseGardens.mockReturnValue({ data: [garden], isLoading: false, isFetching: false });
    view.rerender(gardenRoutes());
    flushResizeObservations();
    expect(screen.getByTestId("garden-header-spacer")).toHaveStyle({
      height: `${HEADER_HEIGHT}px`,
    });
  });
});
