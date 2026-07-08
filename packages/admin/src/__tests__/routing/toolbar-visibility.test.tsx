/**
 * Toolbar Visibility Tests
 * @vitest-environment jsdom
 *
 * RED phase — verifies that CanvasLayout correctly filters NavigationBar
 * slots based on useEffectiveToolbarPermissions return values.
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPermissions = vi.hoisted(() => ({
  current: {
    showWork: true,
    showGarden: true,
    showCommunity: true,
    showActions: true,
    isLoading: false,
  },
}));

const {
  mockUseGardenUrlSync,
  mockUseStaleGardenGuard,
  mockSetSelectedGarden,
  mockEligibleAdminGardens,
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
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
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    NavigationBar: ({
      slots,
      activePath,
    }: {
      slots: Array<{ id: string; label: string; visible: boolean; path: string }>;
      activePath: string;
    }) => (
      <nav data-testid="navigation-bar">
        {slots
          .filter((slot) => slot.visible)
          .map((slot) => (
            <a key={slot.id} data-testid={`nav-${slot.id}`} href={slot.path}>
              {slot.label}
            </a>
          ))}
      </nav>
    ),
    GardenChip: () => <div>Garden Chip</div>,
    AppBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenSettings?: () => void;
      onOpenProfile?: () => void;
    }) => <div data-testid="top-context-bar">{props.gardenChip}</div>,
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
    useAuth: () => ({
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890",
      isReady: true,
      authMode: "wallet",
      signOut: vi.fn(),
    }),
    useEligibleAdminGardens: () => mockEligibleAdminGardens.current,
    // CanvasLayout also calls useAdminGardenWorkspaceSelection directly
    // (independent of useEligibleAdminGardens above) — unstubbed, it falls
    // through to the real hook, which chains into useAdminGardenContext ->
    // usePrimaryAddress -> wagmi's useAccount(), and this test has no
    // WagmiProvider.
    useAdminGardenWorkspaceSelection: () => ({
      eligibleGardens: mockEligibleAdminGardens.current.eligibleGardens,
      selectedGarden: mockEligibleAdminGardens.current.resolvedDefaultGarden,
      setSelectedGarden: vi.fn(),
      gardenOptions: mockEligibleAdminGardens.current.eligibleGardens.map((g) => ({
        id: g.id,
        name: g.name,
        location: g.location,
      })),
      handleSelectGarden: vi.fn(),
    }),
    useEffectiveToolbarPermissions: () => mockPermissions.current,
    useGardenUrlSync: mockUseGardenUrlSync,
    useStaleGardenGuard: mockUseStaleGardenGuard,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div>Page Transition</div>,
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Toolbar Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleAdminGardens.current = {
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };
    // Reset to all-visible default
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    };
    mockUseGardenUrlSync.mockReturnValue({
      gardenId: null,
      tab: null,
      item: null,
      setGarden: vi.fn(),
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: vi.fn(),
    });
  });

  it("renders the fail-open toolbar while permissions are still loading", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: true,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
    expect(screen.getByTestId("nav-hub")).toBeInTheDocument();
    expect(screen.getByTestId("nav-garden")).toBeInTheDocument();
    expect(screen.getByTestId("nav-community")).toBeInTheDocument();
    expect(screen.getByTestId("nav-actions")).toBeInTheDocument();
  });

  it("evaluator sees only Hub plus the mobile Profile route", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: false,
      showCommunity: false,
      showActions: false,
      isLoading: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-hub")).toBeInTheDocument();
    expect(screen.getByTestId("nav-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-garden")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-community")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-actions")).not.toBeInTheDocument();
  });

  it("operator sees Hub + Garden + Community", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: false,
      isLoading: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-hub")).toBeInTheDocument();
    expect(screen.getByTestId("nav-garden")).toBeInTheDocument();
    expect(screen.getByTestId("nav-community")).toBeInTheDocument();
    expect(screen.getByTestId("nav-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-actions")).not.toBeInTheDocument();
  });

  it("switching garden scope updates visible slots", () => {
    // Start with operator-level permissions
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: false,
      isLoading: false,
    };

    const { rerender } = renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-garden")).toBeInTheDocument();

    // Simulate scope change -> now only evaluator in scoped garden
    mockPermissions.current = {
      showWork: true,
      showGarden: false,
      showCommunity: false,
      showActions: false,
      isLoading: false,
    };

    rerender(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-hub")).toBeInTheDocument();
    expect(screen.getByTestId("nav-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-garden")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-community")).not.toBeInTheDocument();
  });

  it("hidden slots produce no empty gaps in nav", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: false,
      showCommunity: false,
      showActions: true,
      isLoading: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const nav = screen.getByTestId("navigation-bar");
    const navLinks = nav.querySelectorAll("a");
    expect(navLinks).toHaveLength(3);
    expect(navLinks[0]).toHaveTextContent("Hub");
    expect(navLinks[1]).toHaveTextContent("Actions");
    expect(navLinks[2]).toHaveTextContent("Profile");
  });
});
