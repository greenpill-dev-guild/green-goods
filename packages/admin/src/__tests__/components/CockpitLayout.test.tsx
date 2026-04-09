/**
 * CockpitLayout Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const {
  mockUseGardenUrlSync,
  mockUseStaleGardenGuard,
  mockSetSelectedGarden,
  mockTopContextBarProps,
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
  mockTopContextBarProps: vi.fn(),
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
    TopContextBar: (props: {
      gardenChip: React.ReactNode;
      onOpenSearch?: () => void;
      onOpenSettings?: () => void;
      userAvatar?: React.ReactNode;
    }) => {
      mockTopContextBarProps(props);
      return (
        <div data-testid="top-context-bar">
          <div data-testid="top-context-garden">{props.gardenChip}</div>
          <div data-testid="top-context-avatar">{props.userAvatar}</div>
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
    useAuth: () => ({
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890",
    }),
    useEffectiveToolbarPermissions: () => ({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    }),
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

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div>Page Transition</div>,
}));

import { CockpitLayout } from "@/components/Layout/CockpitLayout";

describe("CockpitLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts cockpit state sync hooks and exposes Actions in the toolbar", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/actions"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    expect(mockUseGardenUrlSync).toHaveBeenCalledTimes(1);
    expect(mockUseStaleGardenGuard).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByTestId("active-path")).toHaveTextContent("/actions");
  });

  it("renders TopContextBar above the main workspace and keeps NavigationBar pure", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("top-context-bar")).toBeInTheDocument();
    expect(screen.getByTestId("top-context-garden")).toHaveTextContent("Garden Chip");
    expect(screen.getByTestId("top-context-avatar")).toHaveTextContent("O");
    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
    expect(mockTopContextBarProps.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        onOpenSearch: expect.any(Function),
        onOpenSettings: expect.any(Function),
      })
    );
  });

  it("does not apply pl-20 padding on main content", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    const main = document.getElementById("main-content");
    expect(main).toBeTruthy();
    expect(main?.className).not.toContain("pl-20");
  });

  it("applies bottom padding for nav clearance", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    const main = document.getElementById("main-content");
    expect(main?.className).toContain("pb-24");
  });
});
