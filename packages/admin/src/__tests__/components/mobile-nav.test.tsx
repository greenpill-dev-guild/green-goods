/**
 * Mobile Navigation Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const { mockUseEffectiveToolbarPermissions, mockEligibleAdminGardens } = vi.hoisted(() => ({
  mockUseEffectiveToolbarPermissions: vi.fn(),
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
      <nav data-testid="navigation-bar" aria-label="Main navigation">
        <div data-testid="active-path">{activePath}</div>
        <ul>
          {slots
            .filter((slot) => slot.visible)
            .map((slot) => (
              <li key={slot.id} data-testid={`nav-item-${slot.id}`}>
                {slot.label}
              </li>
            ))}
        </ul>
      </nav>
    ),
    GardenChip: () => <div>Garden Chip</div>,
    AppBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenSettings?: () => void;
      onOpenProfile?: () => void;
    }) => <div data-testid="top-context-bar">{props.gardenChip}</div>,
    useAdminStore: (selector: (state: any) => unknown) =>
      selector({
        selectedGarden: null,
        setSelectedGarden: vi.fn(),
      }),
    useAuth: () => ({
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890",
      isReady: true,
      authMode: "wallet",
      signOut: vi.fn(),
    }),
    useEligibleAdminGardens: () => mockEligibleAdminGardens.current,
    useEffectiveToolbarPermissions: mockUseEffectiveToolbarPermissions,
    useGardenUrlSync: vi.fn(),
    useStaleGardenGuard: vi.fn(),
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div>Page Transition</div>,
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";

describe("Mobile Navigation", () => {
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
    mockEligibleAdminGardens.current = {
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
      resolvedDefaultGarden: { id: "garden-1", name: "Garden One", location: "Quito" },
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };
    mockUseEffectiveToolbarPermissions.mockReturnValue({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    });
  });

  afterEach(() => {
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
  });

  it("renders Profile as a real mobile navigation item", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-item-hub")).toHaveTextContent("Hub");
    expect(screen.getByTestId("nav-item-garden")).toHaveTextContent("Garden");
    expect(screen.getByTestId("nav-item-community")).toHaveTextContent("Community");
    expect(screen.getByTestId("nav-item-profile")).toHaveTextContent("Profile");
  });

  it("keeps Profile visible when only a single primary workspace slot is visible", () => {
    mockUseEffectiveToolbarPermissions.mockReturnValue({
      showWork: true,
      showGarden: false,
      showCommunity: false,
      showActions: false,
      isLoading: false,
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("nav-item-hub")).toBeInTheDocument();
    expect(screen.getByTestId("nav-item-profile")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-item-garden")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-item-community")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-item-actions")).not.toBeInTheDocument();
  });

  it("marks /profile as the active mobile navigation path", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/profile"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("active-path")).toHaveTextContent("/profile");
  });

  it("keeps the navigation mounted when the virtual keyboard shrinks the viewport", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 300,
        width: 375,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  });

  it("keeps navigation visible for authenticated users", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
  });
});
