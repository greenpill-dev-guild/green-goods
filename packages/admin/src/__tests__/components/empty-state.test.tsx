/**
 * Empty State Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const { mockNavigate, mockEligibleAdminGardens } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockEligibleAdminGardens: {
    current: {
      eligibleGardens: [],
      resolvedDefaultGarden: null,
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
    cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    NavigationBar: ({
      slots,
    }: {
      slots: Array<{ id: string; label: string; visible: boolean; path: string }>;
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
    useEffectiveToolbarPermissions: () => ({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    }),
    useGardenUrlSync: vi.fn(),
    useStaleGardenGuard: vi.fn(),
  };
});

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

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div data-testid="page-content">Page Transition</div>,
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";

describe("Canvas no-garden access state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEligibleAdminGardens.current = {
      eligibleGardens: [],
      resolvedDefaultGarden: null,
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };
  });

  it("renders a create-garden CTA when the user can create gardens", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create garden/i })).toBeInTheDocument();
    expect(screen.queryByTestId("page-content")).not.toBeInTheDocument();
  });

  it("navigates to /garden/create from the CTA", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create garden/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/garden/create");
  });

  it("hides the create CTA when the user cannot create gardens", () => {
    mockEligibleAdminGardens.current = {
      ...mockEligibleAdminGardens.current,
      canCreateGarden: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create garden/i })).not.toBeInTheDocument();
  });

  it.each([
    "/hub",
    "/garden",
    "/community",
  ])("redirects to home from %s when no eligible gardens exist", (route) => {
    renderWithProviders(
      <MemoryRouter initialEntries={[route]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
