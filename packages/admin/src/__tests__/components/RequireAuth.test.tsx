import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireAuth from "@/routes/RequireAuth";

const mockUseAuth = vi.fn();

vi.mock("@green-goods/shared/providers", () => ({
  useWalletAuth: () => mockUseAuth(),
}));

const mockUseLocation = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) =>
      React.createElement("div", {
        "data-testid": "navigate",
        "data-to": to,
      }),
    Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Protected Content"),
    useLocation: () => mockUseLocation(),
  };
});

function buildAuthState(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  return {
    address: undefined,
    isConnected: false,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ready: true,
    ...overrides,
  };
}

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({
      pathname: "/dashboard",
      search: "",
      hash: "",
    });
  });

  it("renders the layout skeleton while auth state is resolving", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        ready: false,
      })
    );

    render(<RequireAuth />);

    expect(screen.getByTestId("dashboard-layout-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("redirects to login when the user is disconnected", () => {
    mockUseAuth.mockReturnValue(buildAuthState());

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate).toHaveAttribute("data-to", "/login?redirectTo=%2Fdashboard");
  });

  it("redirects to login when the user lacks an address", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isConnected: true,
        address: undefined,
      })
    );

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate).toHaveAttribute("data-to", "/login?redirectTo=%2Fdashboard");
  });

  it("renders protected content when authenticated", () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        isConnected: true,
        address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
      })
    );

    render(<RequireAuth />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("preserves redirect path including search and hash", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/gardens/123",
      search: "?tab=details",
      hash: "#section1",
    });
    mockUseAuth.mockReturnValue(buildAuthState());

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toHaveAttribute(
      "data-to",
      "/login?redirectTo=%2Fgardens%2F123%3Ftab%3Ddetails%23section1"
    );
  });
});
