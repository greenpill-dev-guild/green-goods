/**
 * CanvasLayout Tests
 * @vitest-environment jsdom
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

const {
  mockUseGardenUrlSync,
  mockUseStaleGardenGuard,
  mockSetSelectedGarden,
  mockTopContextBarProps,
  mockAuthState,
  mockEligibleAdminGardens,
} = vi.hoisted(() => ({
  mockUseGardenUrlSync: vi.fn(),
  mockUseStaleGardenGuard: vi.fn(),
  mockSetSelectedGarden: vi.fn(),
  mockTopContextBarProps: vi.fn(),
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
          {props.onOpenSettings ? (
            <button type="button" onClick={props.onOpenSettings}>
              Open Settings
            </button>
          ) : null}
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
    useAuth: () => mockAuthState.current,
    useEligibleAdminGardens: () => mockEligibleAdminGardens.current,
    useEffectiveToolbarPermissions: () => ({
      showWork: true,
      showGarden: true,
      showCommunity: true,
      showActions: true,
      isLoading: false,
    }),
    useGardenUrlSync: mockUseGardenUrlSync,
    useStaleGardenGuard: mockUseStaleGardenGuard,
  };
});

vi.mock("@/components/Layout/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));

vi.mock("@/components/Layout/AccountSheet", () => ({
  AccountSheet: ({ open, activeTab }: { open: boolean; activeTab: "profile" | "settings" }) =>
    open ? <div data-testid="account-sheet">{activeTab}</div> : null,
}));

vi.mock("@/components/Layout/PageTransition", () => ({
  PageTransition: () => <div>Page Transition</div>,
}));

vi.mock("@/components/Layout/UserAvatar", () => ({
  UserAvatar: ({ onOpenProfile }: { onOpenProfile: () => void }) => (
    <button type="button" onClick={onOpenProfile}>
      Avatar
    </button>
  ),
}));

import { CanvasLayout } from "@/components/Layout/CanvasLayout";

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
  });

  it("mounts canvas state sync hooks and exposes Actions in the toolbar", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/actions"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(mockUseGardenUrlSync).toHaveBeenCalledTimes(1);
    expect(mockUseStaleGardenGuard).toHaveBeenCalledTimes(1);
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

  it("renders TopContextBar above the main workspace and keeps NavigationBar pure", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("top-context-bar")).toBeInTheDocument();
    expect(screen.getByTestId("top-context-garden")).toHaveTextContent("Garden Chip");
    expect(screen.getByTestId("navigation-bar")).toBeInTheDocument();
    expect(mockTopContextBarProps.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        onOpenSearch: expect.any(Function),
        onOpenNotifications: expect.any(Function),
      })
    );
  });

  it("opens the account sheet on the profile tab from the desktop avatar", async () => {
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

    await user.click(screen.getByRole("button", { name: "Avatar" }));

    expect(screen.getByTestId("account-sheet")).toHaveTextContent("profile");
  });

  it("opens the account sheet on the settings tab from the desktop settings trigger", async () => {
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

    expect(screen.getByTestId("account-sheet")).toHaveTextContent("settings");
  });

  it("redirects desktop /profile visits to /hub and reopens the requested account tab in a sheet", async () => {
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
      <MemoryRouter initialEntries={["/profile?tab=settings"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("account-sheet")).toHaveTextContent("settings");
    });

    expect(screen.getByTestId("active-path")).toHaveTextContent("/hub");
  });

  it("renders ConnectShell only for unauthenticated users", () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: false,
      eoaAddress: null,
      authMode: null,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("connect-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("top-context-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("navigation-bar")).not.toBeInTheDocument();
  });

  it("renders the wallet-required shell for embedded auth", () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      authMode: "embedded",
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/hub"]}>
        <CanvasLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId("wallet-required-shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByTestId("navigation-bar")).not.toBeInTheDocument();
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
});
