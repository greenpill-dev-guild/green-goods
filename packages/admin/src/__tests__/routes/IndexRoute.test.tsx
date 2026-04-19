/**
 * IndexRoute Tests
 * @vitest-environment jsdom
 *
 * IndexRoute replaces the old CanvasLayout home-state ladder. It must
 * render exactly one of:
 *   - spinner (loading)
 *   - WalletRequiredConnectShell (embedded auth)
 *   - connect prompt (unauthenticated)
 *   - <Navigate to="/hub/work" /> (authenticated + eligible gardens)
 *   - CanvasGardenAccessState (authenticated + zero eligible gardens)
 */

import type React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../test-utils";

const { mockAuthState, mockEligibleAdminGardens } = vi.hoisted(() => ({
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
      eligibleGardens: [] as Array<{ id: string; name: string; location: string }>,
      resolvedDefaultGarden: null as { id: string; name: string; location: string } | null,
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
    AppBar: (props: { gardenChip: React.ReactNode }) => (
      <div data-testid="top-context-bar">{props.gardenChip}</div>
    ),
    MainSheet: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="main-sheet">{children}</div>
    ),
    useAuth: () => mockAuthState.current,
    useEligibleAdminGardens: () => mockEligibleAdminGardens.current,
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: () => <button type="button">Connect Wallet</button>,
}));

import IndexRoute from "@/routes/IndexRoute";

describe("IndexRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.current = {
      isAuthenticated: true,
      eoaAddress: "0x1234567890123456789012345678901234567890",
      isReady: true,
      authMode: "wallet",
      signOut: vi.fn(),
    };
    mockEligibleAdminGardens.current = {
      eligibleGardens: [],
      resolvedDefaultGarden: null,
      persistedGardenId: null,
      scopeKey: "0x123:10",
      canCreateGarden: true,
      isLoaded: true,
    };
  });

  it("renders a loading spinner while auth is not ready", () => {
    mockAuthState.current = { ...mockAuthState.current, isReady: false };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect wallet/i })).not.toBeInTheDocument();
  });

  it("renders a loading spinner while eligible gardens are still loading", () => {
    mockEligibleAdminGardens.current = {
      ...mockEligibleAdminGardens.current,
      isLoaded: false,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the wallet-required shell for embedded auth", () => {
    mockAuthState.current = { ...mockAuthState.current, authMode: "embedded" };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("wallet-required-shell")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & connect wallet/i })).toBeInTheDocument();
  });

  it("renders the connect prompt for unauthenticated users", () => {
    mockAuthState.current = {
      ...mockAuthState.current,
      isAuthenticated: false,
      eoaAddress: null,
      authMode: null,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByTestId("top-context-bar")).toBeInTheDocument();
  });

  it("redirects to /hub when authenticated with at least one eligible garden", () => {
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
  });

  it("renders the no-garden-access state when authenticated with zero gardens", () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-no-garden-access")).toBeInTheDocument();
  });
});
