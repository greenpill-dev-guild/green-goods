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
      isError: false,
      hasStaleBaseList: false,
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
    useAdminAccessState: () => {
      const auth = mockAuthState.current;
      const eligible = mockEligibleAdminGardens.current;
      if (!auth.isReady || (auth.isAuthenticated && !eligible.isLoaded)) {
        return { status: "checking" };
      }
      if (auth.authMode === "embedded") {
        return { status: "embedded-wallet", signOut: auth.signOut };
      }
      if (!auth.isAuthenticated || !auth.eoaAddress) {
        return { status: "disconnected" };
      }
      if (eligible.eligibleGardens.length > 0) {
        return {
          status: "ready",
          eligibleGardens: eligible.eligibleGardens,
          resolvedDefaultGarden: eligible.resolvedDefaultGarden,
          hasStaleBaseList: eligible.hasStaleBaseList,
        };
      }
      if (eligible.isError) {
        return { status: "indexer-error" };
      }
      return { status: "no-access", canCreateGarden: eligible.canCreateGarden };
    },
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
      isError: false,
      hasStaleBaseList: false,
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

  it("renders the indexer-error state when useEligibleAdminGardens reports isError", () => {
    mockEligibleAdminGardens.current = {
      ...mockEligibleAdminGardens.current,
      isError: true,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("canvas-indexer-error")).toBeInTheDocument();
    // The no-access copy must NOT show during an indexer outage — that was the
    // gaslight scenario the audit flagged.
    expect(screen.queryByTestId("canvas-no-garden-access")).not.toBeInTheDocument();
  });

  it("redirects to the hub when role-confirmed gardens land via the stale-base-list cross-check", () => {
    // Simulates the operator/no-garden symptom: useGardens returned [] but
    // useRole proved an operator garden, so useEligibleAdminGardens injected
    // a stub. IndexRoute must redirect to the hub instead of the no-access shell.
    mockEligibleAdminGardens.current = {
      ...mockEligibleAdminGardens.current,
      eligibleGardens: [{ id: "garden-stub", name: "Stub Garden", location: "" }],
      hasStaleBaseList: true,
    };

    renderWithProviders(
      <MemoryRouter initialEntries={["/"]}>
        <IndexRoute />
      </MemoryRouter>
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/hub/work");
  });
});
