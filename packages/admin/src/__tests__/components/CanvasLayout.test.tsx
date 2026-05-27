/**
 * CanvasLayout Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderWithProviders, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { useSheetOrchestratorStore } from "@green-goods/shared";

const {
  mockUseGardenUrlSync,
  mockUseStaleGardenGuard,
  mockEnsureBaseLists,
  mockSetUrlGarden,
  mockSetSelectedGarden,
  mockGardenChipProps,
  mockAppBarProps,
  mockNavigationBarProps,
  mockAuthState,
  mockEligibleAdminGardens,
  mockAdminAccessState,
  mockRouteLeftSheetConfig,
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockEnsureBaseLists: vi.fn(),
  mockSetUrlGarden: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
  mockGardenChipProps: vi.fn(),
  mockAppBarProps: vi.fn(),
  mockNavigationBarProps: vi.fn(),
  mockRouteLeftSheetConfig: {
    current: null as null | {
      title: string;
      content: React.ReactNode;
      closeTo: string;
    },
  },
  mockAuthState: {
    current: {
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890" as string | null,
      isReady: true,
      authMode: "wallet" as "wallet" | "embedded" | null,
      signOut: vi.fn(),
    },
  },
  mockEligibleAdminGardens: {
    current: {
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    },
  },
  mockAdminAccessState: {
    current: {
      status: "ready" as const,
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      hasStaleBaseList: false,
    },
  },
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    NavigationBar: ({
      slots,
      activePath,
      onNavigate,
    }: {
      slots: Array<{ id: string; label: string; visible: boolean; path: string }>;
      activePath: string;
      onNavigate: (path: string) => void;
    }) => {
      mockNavigationBarProps({ slots, activePath, onNavigate });
      return (
        <div data-testid="navigation-bar">
          <div data-testid="active-path">{activePath}</div>
          <ul>
            {slots
              .filter((slot) => slot.visible)
              .map((slot) => (
                <li key={slot.id}>{slot.label}</li>
              ))}
          </ul>
        </div>
      );
    },
    GardenChip: (props: {
      gardens: Array<{ id: string; name: string }>;
      selectedGarden: { id: string; name: string } | null;
      onSelectGarden: (garden: { id: string; name: string } | null) => void;
    }) => {
      mockGardenChipProps(props);
      return (
        <div>
          <div>Garden Chip</div>
          {props.gardens.map((garden) => (
            <button key={garden.id} type="button" onClick={() => props.onSelectGarden(garden)}>
              Select {garden.name}
            </button>
          ))}
          <button type="button" onClick={() => props.onSelectGarden(null)}>
            Select All Gardens
          </button>
        </div>
      );
    },
    AppBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenNotifications?: () => void;
      onOpenSettings?: () => void;
      onOpenProfile?: () => void;
    }) => {
      mockAppBarProps(props);
      return (
        <div data-testid="top-context-bar">
          <div data-testid="top-context-garden">{props.gardenChip}</div>
          {props.onOpenSettings ? (
            <button type="button" onClick={props.onOpenSettings}>
              Open Settings
            </button>
          ) : null}
          {props.onOpenNotifications ? (
            <button type="button" onClick={props.onOpenNotifications}>
              Open Notifications
            </button>
          ) : null}
          {props.onOpenProfile ? (
            <button type="button" onClick={props.onOpenProfile}>
              Open Profile
            </button>
          ) : null}
        </div>
      );
    },
    useAdminStore: (
      selector: (state: {
        selectedGarden: null;
        setSelectedGarden: typeof mockSetSelectedGarden;
      }) => unknown
    ) =>
      selector({
        selectedGarden: null,
        setSelectedGarden: mockSetSelectedGarden,
      }),
    useAuth: () => mockAuthState.current,
    NotificationPanel: ({
      items = [],
      isLoading = false,
    }: {
      items?: Array<{ id: string; title: string }>;
      isLoading?: boolean;
    }) => (
      <div
        data-testid="notification-panel"
        data-count={String(items.length)}
        data-loading={String(isLoading)}
      >
        {items.map((item) => (
          <div key={item.id}>{item.title}</div>
        ))}
      </div>
    ),
    formatRelativeTime: () => "5 minutes ago",
    useAdminGardenWorkspaceSelection: () => ({
      eligibleGardens: mockEligibleAdminGardens.current.eligibleGardens,
      selectedGarden: mockEligibleAdminGardens.current.resolvedDefaultGarden,
      setSelectedGarden: mockSetSelectedGarden,
      gardenOptions: mockEligibleAdminGardens.current.eligibleGardens.map((garden) => ({
        id: garden.id,
        name: garden.name,
        location: garden.location,
      })),
      handleSelectGarden: vi.fn(),
    }),
    useEligibleAdminGardens: () => mockEligibleAdminGardens.current,
    useEffectiveToolbarPermissions: () => ({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    }),
    useGardenDetailData: (id?: string) => ({
      garden: id ? { id: "garden-1", name: "Garden One", chainId: 10 } : undefined,
      fetching: false,
      error: null,
      assessments: [],
      fetchingAssessments: false,
      assessmentsError: null,
      roleMembers: {
        owner: [],
        operator: [],
        evaluator: [],
        gardener: [],
        funder: [],
        community: [],
      },
      gardenVaults: [],
      vaultsLoading: false,
      vaultNetDeposited: 0n,
      allocations: [],
      allocationsLoading: false,
      works: [],
      worksLoading: false,
      hypercerts: [],
      hypercertsLoading: false,
    }),
    useGardenDerivedState: ({
      openSection,
    }: {
      openSection: (tab: "work", section: string) => void;
    }) => ({
      overviewAlerts: [
        {
          key: "work-critical",
          severity: "critical",
          label: "3 work submissions need review",
          onAction: () => openSection("work", "queue"),
        },
      ],
      activityEvents: [
        {
          id: "activity-1",
          title: "Impact report minted",
          description: "Hypercert created",
          timestamp: Date.now(),
          href: "/garden/impact/hypercerts/hc-1",
        },
      ],
    }),
    useGardenUrlSync: mockUseGardenUrlSync,
    useStaleGardenGuard: mockUseStaleGardenGuard,
    useAdminAccessState: () => mockAdminAccessState.current,
    ensureBaseLists: mockEnsureBaseLists,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));

vi.mock("@/components/Layout/PageTransition", async () => {
  const ReactModule = await import("react");
  const { useRouteBackedLeftSheetConfig } = await import("@green-goods/shared");

  return {
    PageTransition: () => {
      useRouteBackedLeftSheetConfig(mockRouteLeftSheetConfig.current);
      return ReactModule.createElement("div", null, "Page Transition");
    },
  };
});

vi.mock("@/components/Layout/AccountProfilePanel", () => ({
  AccountProfilePanel: () => <div>Profile Panel</div>,
}));

vi.mock("@/components/Layout/AccountSettingsPanel", () => ({
  AccountSettingsPanel: () => <div>Settings Panel</div>,
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import CanvasShell from "@/routes/CanvasShell";

describe("CanvasLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mockAuthState.current = {
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890",
      isReady: true,
      authMode: "wallet",
      signOut: vi.fn(),
    };
    mockEligibleAdminGardens.current = {
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };
    mockUseGardenUrlSync.mockReturnValue({
      gardenId: null,
      tab: null,
      item: null,
      setGarden: mockSetUrlGarden,
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: vi.fn(),
    });
    mockRouteLeftSheetConfig.current = null;
    useSheetOrchestratorStore.setState({
      activeSheet: null,
      activeContentId: null,
      viewStates: {},
    });
  });

  it("mounts canvas state sync hooks and exposes Actions in the toolbar", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/actions"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(mockUseGardenUrlSync).toHaveBeenCalled();
    expect(mockUseStaleGardenGuard).toHaveBeenCalled();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByTestId("active-path")).toHaveTextContent("/actions");
  });

  it.each([
    ["/hub/work/attestation-1", "/hub"],
    ["/hub/work/submit", "/hub"],
    ["/community/treasury/vault", "/community"],
    ["/garden/impact/hypercerts/hc-123", "/garden"],
    ["/actions/action-1", "/actions"],
    ["/profile", "/profile"],
  ])("maps %s to the %s navigation slot", (route, expectedActivePath) => {
    renderWithProviders(
      <MemoryRouter initialEntries={[route]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("active-path")).toHaveTextContent(expectedActivePath);
  });

  it("keeps NavigationBar props stable across Hub tab route changes", async () => {
    const router = createMemoryRouter([{ path: "*", element: <CanvasLayout /> }], {
      initialEntries: ["/hub/work"],
    });

    renderWithProviders(<RouterProvider router={router} />);

    expect(screen.getByTestId("active-path")).toHaveTextContent("/hub");
    expect(mockNavigationBarProps).toHaveBeenCalledTimes(1);
    const firstProps = mockNavigationBarProps.mock.calls[0]?.[0];

    await act(async () => {
      await router.navigate("/hub/assess");
    });
    await act(async () => {
      await router.navigate("/hub/certify");
    });
    await act(async () => {
      await router.navigate("/hub/history");
    });

    expect(screen.getByTestId("active-path")).toHaveTextContent("/hub");
    expect(mockNavigationBarProps).toHaveBeenCalledTimes(1);
    expect(mockNavigationBarProps.mock.calls[0]?.[0].slots).toBe(firstProps.slots);
    expect(mockNavigationBarProps.mock.calls[0]?.[0].activePath).toBe("/hub");
    expect(mockNavigationBarProps.mock.calls[0]?.[0].onNavigate).toBe(firstProps.onNavigate);
  });

  it("renders AppBar above the main workspace and keeps NavigationBar pure", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("top-context-bar")).toBeInTheDocument();
    expect(screen.getByTestId("top-context-garden")).toHaveTextContent("Garden Chip");
    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
    expect(mockGardenChipProps).toHaveBeenCalledWith(
      expect.objectContaining({
        gardens: [{ id: "garden-1", name: "Garden One" }],
      })
    );
    expect(mockAppBarProps.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        onOpenSearch: expect.any(Function),
        onOpenNotifications: expect.any(Function),
      })
    );
  });

  it("switches gardens through the URL-aware selector", async () => {
    const user = userEvent.setup();
    const gardenOne = {
      id: "garden-1",
      tokenAddress: "0x1111111111111111111111111111111111111111",
      name: "Garden One",
      location: "Quito",
    };
    const gardenTwo = {
      id: "garden-2",
      tokenAddress: "0x2222222222222222222222222222222222222222",
      name: "Garden Two",
      location: "Lisbon",
    };
    mockEligibleAdminGardens.current = {
      eligibleGardens: [gardenOne, gardenTwo],
      resolvedDefaultGarden: gardenOne,
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };

    renderWithProviders(
      <MemoryRouter
        initialEntries={["/hub/work?gardenAddress=0x1111111111111111111111111111111111111111"]}
      >
        <CanvasLayout />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Select Garden Two" }));

    expect(mockSetUrlGarden).toHaveBeenCalledWith(gardenTwo);
    expect(mockSetSelectedGarden).not.toHaveBeenCalledWith(gardenTwo);
  });

  it("passes onOpenProfile to AppBar on desktop", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(mockAppBarProps.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        onOpenProfile: expect.any(Function),
        onOpenSettings: expect.any(Function),
      })
    );
  });

  it("opens RightSheet with settings content from the desktop settings trigger", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Open Settings" }));

    await waitFor(() => {
      expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
    });
  });

  it("opens RightSheet with profile content from the desktop profile trigger", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Open Profile" }));

    await waitFor(() => {
      expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
    });
  });

  it("opens RightSheet with data-backed notifications content", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Open Notifications" }));

    await waitFor(() => {
      expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
    });
    expect(screen.getByTestId("notification-panel")).toHaveAttribute("data-loading", "false");
    expect(screen.getByText("3 work submissions need review")).toBeInTheDocument();
    expect(screen.getByText("Impact report minted")).toBeInTheDocument();
  });

  it("keeps notifications empty until a garden detail record exists", async () => {
    mockEligibleAdminGardens.current = {
      eligibleGardens: [],
      resolvedDefaultGarden: null,
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };

    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Open Notifications" }));

    await waitFor(() => {
      expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
    });
    expect(screen.getByTestId("notification-panel")).toHaveAttribute("data-count", "0");
  });

  it("clears stale unregistered right-sheet content", async () => {
    useSheetOrchestratorStore.getState().openSheet("right", "legacy-right-panel");

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(useSheetOrchestratorStore.getState().activeSheet).toBeNull();
    });
    expect(screen.queryByTestId("right-sheet")).not.toBeInTheDocument();
  });

  it("does not apply pl-20 padding on main content", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const main = document.getElementById("main-content");
    expect(main).toBeTruthy();
    expect(main?.className).not.toContain("pl-20");
  });

  it("applies bottom padding for nav clearance", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const main = document.getElementById("main-content");
    expect(main?.getAttribute("style")).toContain("padding-bottom");
  });

  it("bounds the mobile bottom sheet to the canvas sheet layer", async () => {
    mockRouteLeftSheetConfig.current = {
      title: "Mobile inspector",
      content: <div>Inspector content</div>,
      closeTo: "/actions",
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/actions/action-1"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const sheetLayer = await screen.findByTestId("canvas-sheet-layer");
    const dialog = await screen.findByTestId("bottom-sheet-dialog");

    expect(dialog).toHaveAttribute("data-boundary", "bounded");
    expect(sheetLayer).toContainElement(dialog);
  });
});

function renderCanvasShell(initialEntry = "/hub/work") {
  const router = createMemoryRouter([{ path: "*", element: <CanvasShell /> }], {
    initialEntries: [initialEntry],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe("CanvasShell access states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAccessState.current = {
      status: "ready",
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      hasStaleBaseList: false,
    };
  });

  it("renders the shared disconnected state for direct canvas bookmarks", () => {
    mockAdminAccessState.current = { status: "disconnected" };

    renderCanvasShell("/hub/work");

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByTestId("top-context-bar")).toBeInTheDocument();
    expect(screen.queryByText("Page Transition")).not.toBeInTheDocument();
  });

  it("renders the shared embedded-wallet state for direct canvas bookmarks", () => {
    const signOut = vi.fn();
    mockAdminAccessState.current = { status: "embedded-wallet", signOut };

    renderCanvasShell("/hub/work");

    expect(screen.getByTestId("wallet-required-shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByText("Page Transition")).not.toBeInTheDocument();
  });

  it("renders the shared no-access state for direct canvas bookmarks", () => {
    mockAdminAccessState.current = { status: "no-access", canCreateGarden: false };

    renderCanvasShell("/hub/work");

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.queryByText("Page Transition")).not.toBeInTheDocument();
  });

  it("renders the shared indexer-error state for direct canvas bookmarks", () => {
    mockAdminAccessState.current = { status: "indexer-error" };

    renderCanvasShell("/hub/work");

    expect(screen.getByTestId("canvas-indexer-error")).toBeInTheDocument();
    expect(screen.queryByText("Page Transition")).not.toBeInTheDocument();
  });

  it("keeps CanvasLayout as the ready shell for direct canvas bookmarks", () => {
    renderCanvasShell("/hub/work");

    expect(mockEnsureBaseLists).toHaveBeenCalled();
    expect(screen.getByText("Page Transition")).toBeInTheDocument();
    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
  });
});
