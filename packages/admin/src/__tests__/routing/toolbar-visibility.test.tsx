/**
 * Toolbar Visibility Tests
 * @vitest-environment jsdom
 *
 * RED phase — verifies that CockpitLayout correctly filters NavigationBar
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
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
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
    TopContextBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenSettings?: () => void;
      userAvatar?: React.ReactNode;
    }) => (
      <div data-testid="top-context-bar">
        {props.gardenChip}
      </div>
    ),
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
    }),
    useEffectiveToolbarPermissions: () => mockPermissions.current,
    useGardens: () => ({
      data: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
    }),
    useRole: () => ({ role: "operator" }),
    useGardenUrlSync: mockUseGardenUrlSync,
    useStaleGardenGuard: mockUseStaleGardenGuard,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/SettingsSheet", () => ({
  SettingsSheet: () => null,
}));

vi.mock("@/components/ui/PageTransition", () => ({
  PageTransition: () => <div>Page Transition</div>,
}));

import { CockpitLayout } from "@/components/Layout/CockpitLayout";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Toolbar Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to all-visible default
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    };
  });

  it("evaluator sees only Work nav item", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: false,
      showCommunity: false,
      showActions: false,
      isLoading: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-work")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-garden")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-community")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-actions")).not.toBeInTheDocument();
  });

  it("operator sees Work + Garden + Community", () => {
    mockPermissions.current = {
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: false,
      isLoading: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-work")).toBeInTheDocument();
    expect(screen.getByTestId("nav-garden")).toBeInTheDocument();
    expect(screen.getByTestId("nav-community")).toBeInTheDocument();
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
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
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
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-work")).toBeInTheDocument();
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
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    const nav = screen.getByTestId("navigation-bar");
    // Should only have 2 children (Work + Actions), no empty placeholders
    const navLinks = nav.querySelectorAll("a");
    expect(navLinks).toHaveLength(2);
    expect(navLinks[0]).toHaveTextContent("Work");
    expect(navLinks[1]).toHaveTextContent("Actions");
  });
});
