import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireAuth from "@/routes/RequireAuth";

const mockUseAuth = vi.fn();

vi.mock("@green-goods/shared/hooks", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Protected Content"),
  };
});

vi.mock("@/components/ConnectButton", () => ({
  ConnectButton: ({ className }: { className?: string }) => (
    <button className={className} type="button" data-testid="connect-wallet-button">
      Connect Wallet
    </button>
  ),
}));

function buildAuthState(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  return {
    eoaAddress: undefined,
    isAuthenticated: false,
    isAuthenticating: false,
    signOut: vi.fn(),
    isReady: true,
    ...overrides,
  };
}

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{}}>
      {ui}
    </IntlProvider>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading spinner while auth state is resolving", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isReady: false,
      })
    );

    renderWithIntl(<RequireAuth />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-prompt")).not.toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("shows an inline connect prompt when the user is not authenticated", () => {
    mockUseAuth.mockReturnValue(buildAuthState());

    renderWithIntl(<RequireAuth />);

    expect(screen.getByTestId("connect-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("connect-wallet-button")).toBeInTheDocument();
    expect(screen.getByText("Connect to continue")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("shows connect prompt when the user lacks an address", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAuthenticated: true,
        eoaAddress: undefined,
      })
    );

    renderWithIntl(<RequireAuth />);

    expect(screen.getByTestId("connect-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isAuthenticated: true,
        eoaAddress: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
      })
    );

    renderWithIntl(<RequireAuth />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-prompt")).not.toBeInTheDocument();
  });
});
