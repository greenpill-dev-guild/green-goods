/**
 * Empty State Tests
 * @vitest-environment jsdom
 *
 * The unauthenticated / no-eligible-gardens home shell now lives in
 * IndexRoute (mounted at "/"), not CanvasLayout. These tests render
 * IndexRoute directly plus the CanvasLayout redirect safety net that
 * kicks users back to "/" when they lose garden membership mid-session.
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
    MainSheet: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="main-sheet">{children}</div>
    ),
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
    useAdminAccessState: () => {
      const eligible = mockEligibleAdminGardens.current;
      if (!eligible.isLoaded) {
        return { status: "checking" };
      }
      if (eligible.eligibleGardens.length > 0) {
        return {
          status: "ready",
          eligibleGardens: eligible.eligibleGardens,
          resolvedDefaultGarden: eligible.resolvedDefaultGarden,
          hasStaleBaseList: false,
        };
      }
      return { status: "no-access", canCreateGarden: eligible.canCreateGarden };
    },
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
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div data-testid="page-content">Page Transition</div>,
}));

import IndexRoute from "@/routes/IndexRoute";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";

describe("IndexRoute no-garden access state", () => {
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
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create garden/i })).toBeInTheDocument();
  });

  it("navigates to /garden/create from the CTA", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
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
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create garden/i })).not.toBeInTheDocument();
  });

  it("redirects authenticated users with eligible gardens to /hub", () => {
    mockEligibleAdminGardens.current = {
      ...mockEligibleAdminGardens.current,
      eligibleGardens: [{ id: "garden-1", name: "Garden One", location: "Quito" }],
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/hub/work");
    expect(screen.queryByTestId("canvas-no-garden-access")).not.toBeInTheDocument();
  });
});

describe("CanvasLayout redirect safety net", () => {
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
