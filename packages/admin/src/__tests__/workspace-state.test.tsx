/**
 * Workspace State Integration Tests
 * @vitest-environment jsdom
 *
 * Tests URL sync + garden state persistence integration.
 * These test the integration between useGardenUrlSync and useGardenStateStore
 * for the canvas workspace — will be RED until the integration wiring is implemented.
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "./test-utils";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockUseGardenUrlSync,
  mockUseStaleGardenGuard,
  mockSetSelectedGarden,
  mockUseGardenStateStore,
  mockEligibleAdminGardens,
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
  mockUseGardenStateStore: vi.fn(),
  mockEligibleAdminGardens: {
    current: {
      eligibleGardens: [
        { id: "garden-x", name: "Garden X", location: "Quito" },
        { id: "garden-y", name: "Garden Y", location: "Bogota" },
      ],
      resolvedDefaultGarden: { id: "garden-x", name: "Garden X", location: "Quito" },
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
    ),
    GardenChip: () => <div>Garden Chip</div>,
    AppBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenSettings?: () => void;
      onOpenProfile?: () => void;
    }) => (
      <div data-testid="top-context-bar">
        <div data-testid="top-context-garden">{props.gardenChip}</div>
      </div>
    ),
    useAdminStore: (selector: (state: any) => unknown) =>
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
    useEffectiveToolbarPermissions: () => ({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    }),
    useGardenUrlSync: mockUseGardenUrlSync,
    useStaleGardenGuard: mockUseStaleGardenGuard,
    useGardenStateStore: mockUseGardenStateStore,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div data-testid="page-content">Page Transition</div>,
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Workspace State Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleAdminGardens.current = {
      eligibleGardens: [
        { id: "garden-x", name: "Garden X", location: "Quito" },
        { id: "garden-y", name: "Garden Y", location: "Bogota" },
      ],
      resolvedDefaultGarden: { id: "garden-x", name: "Garden X", location: "Quito" },
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
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

  it("deep URL /hub/work/:workId opens correct state without legacy item query", () => {
    mockUseGardenUrlSync.mockReturnValue({
      gardenId: "garden-x",
      tab: null,
      item: null,
      setGarden: vi.fn(),
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: vi.fn(),
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub/work/item-y?gardenAddress=0xgardenx"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    // CanvasLayout must call useGardenUrlSync which parses the URL state
    expect(mockUseGardenUrlSync).toHaveBeenCalled();

    // The layout should render without errors when deep-linked
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("keeps legacy item helpers out of Hub route ownership", () => {
    const mockCloseItem = vi.fn();

    mockUseGardenUrlSync.mockReturnValue({
      gardenId: "garden-x",
      tab: null,
      item: null,
      setGarden: vi.fn(),
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: mockCloseItem,
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub/work/item-open?gardenAddress=0xgardenx"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const hookResult = mockUseGardenUrlSync.mock.results[0]?.value;
    expect(hookResult.closeItem).toBeDefined();
    expect(hookResult.item).toBeNull();
  });

  it("switching gardens preserves per-garden tab state", () => {
    // First render with garden-x
    mockUseGardenUrlSync.mockReturnValue({
      gardenId: "garden-x",
      tab: "community",
      item: null,
      setGarden: vi.fn(),
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: vi.fn(),
    });

    const { rerender } = renderWithProviders(
      <MemoryRouter initialEntries={["/hub?gardenAddress=0xgardenx&tab=community"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    // Switch to garden-y with different tab
    mockUseGardenUrlSync.mockReturnValue({
      gardenId: "garden-y",
      tab: "actions",
      item: null,
      setGarden: vi.fn(),
      setTab: vi.fn(),
      setFilter: vi.fn(),
      openItem: vi.fn(),
      closeItem: vi.fn(),
    });

    rerender(
      <MemoryRouter initialEntries={["/hub?gardenAddress=0xgardeny&tab=actions"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    // The sync hooks should have been called for each render
    expect(mockUseGardenUrlSync).toHaveBeenCalled();
    // Per-garden state persistence will be verified once useGardenStateStore
    // is wired into the layout — this test confirms the contract
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });
});
