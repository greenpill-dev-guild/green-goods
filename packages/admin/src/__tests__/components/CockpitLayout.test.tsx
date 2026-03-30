/**
 * CockpitLayout Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const { mockUseGardenUrlSync, mockUseStaleGardenGuard, mockSetSelectedGarden } = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    FloatingToolbar: ({
      slots,
      activePath,
    }: {
      slots: Array<{ id: string; label: string; visible: boolean; path: string }>;
      activePath: string;
    }) => (
      <div>
        <div data-testid="active-path">{activePath}</div>
        <ul>
          {slots.filter((slot) => slot.visible).map((slot) => (
            <li key={slot.id}>{slot.label}</li>
          ))}
        </ul>
      </div>
    ),
    GardenChip: () => <div>Garden Chip</div>,
    TopContextBar: ({ userAvatar }: { userAvatar?: React.ReactNode }) => (
      <div>
        <span>Top Context</span>
        {userAvatar}
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

vi.mock("@/components/ui/PageTransition", () => ({
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
});
