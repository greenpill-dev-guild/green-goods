/**
 * Empty State Tests
 * @vitest-environment jsdom
 *
 * Tests the empty state UX for operators/evaluators with no gardens.
 * These will be RED until the empty state component is implemented.
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockUseGardens, mockUseRole, mockNavigate } = vi.hoisted(() => ({
  mockUseGardens: vi.fn(),
  mockUseRole: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  NavigationBar: ({
    slots,
    activePath,
  }: {
    slots: Array<{ id: string; label: string; visible: boolean; path: string }>;
    activePath: string;
  }) => (
    <nav data-testid="navigation-bar">
      <ul>
        {slots
          .filter((slot) => slot.visible)
          .map((slot) => (
            <li key={slot.id}>{slot.label}</li>
          ))}
      </ul>
    </nav>
  ),
  GardenChip: () => <div>Garden Chip</div>,
  TopContextBar: (props: {
    gardenChip: React.ReactNode;
    onOpenSearch?: () => void;
    onOpenSettings?: () => void;
    userAvatar?: React.ReactNode;
  }) => <div data-testid="top-context-bar">{props.gardenChip}</div>,
  useAdminStore: (selector: (state: any) => unknown) =>
    selector({
      selectedGarden: null,
      setSelectedGarden: vi.fn(),
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
  useGardens: mockUseGardens,
  useRole: mockUseRole,
  useGardenUrlSync: vi.fn(),
  useStaleGardenGuard: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/SettingsSheet", () => ({
  SettingsSheet: () => null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div data-testid="page-content">Page Transition</div>,
}));

import { CockpitLayout } from "@/components/Layout/CockpitLayout";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseRole.mockReturnValue({ role: "operator" });
  });

  it("renders 'Create Garden' CTA when operator has no gardens", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseRole.mockReturnValue({ role: "operator" });

    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    // The empty state should display a CTA to create a garden.
    // This will be RED until CockpitWorkspaceSelectionState (or equivalent)
    // renders an empty state when gardens list is empty.
    // For now, verify the layout renders without error.
    const createBtn = screen.queryByRole("button", { name: /create garden/i });
    // RED: This will fail because the empty state CTA doesn't exist yet
    expect(createBtn).toBeInTheDocument();
  });

  it("CTA click navigates to /gardens/create", async () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseRole.mockReturnValue({ role: "operator" });

    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    const createBtn = screen.queryByRole("button", { name: /create garden/i });
    // RED: Button doesn't exist yet
    if (createBtn) {
      const { default: userEvent } = await import("@testing-library/user-event");
      const user = userEvent.setup();
      await user.click(createBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/gardens/create");
    } else {
      // Fail explicitly until the feature is implemented
      expect(createBtn).not.toBeNull();
    }
  });

  it("does not render CTA for evaluator-only role", () => {
    mockUseGardens.mockReturnValue({ data: [], isLoading: false });
    mockUseRole.mockReturnValue({ role: "evaluator" });

    renderWithProviders(
      <MemoryRouter initialEntries={["/work"]}>
        <CockpitLayout />
      </MemoryRouter>
    );

    // Evaluators can't create gardens, so no CTA should appear
    const createBtn = screen.queryByRole("button", { name: /create garden/i });
    expect(createBtn).not.toBeInTheDocument();
  });
});
