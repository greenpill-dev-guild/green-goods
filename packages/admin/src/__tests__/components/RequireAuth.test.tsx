import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import React from "react";
import { RequireAuth } from "@/components/RequireAuth";

// Mock the user provider
const mockUseUser = vi.fn();
vi.mock("@/providers/user", () => ({
  useUser: () => mockUseUser(),
}));

// Mock Privy
const mockUsePrivy = vi.fn();
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => mockUsePrivy(),
}));

// Mock react-router-dom
const mockUseLocation = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => React.createElement("div", { 
      "data-testid": "navigate", 
      "data-to": to 
    }),
    Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Protected Content"),
    useLocation: () => mockUseLocation(),
  };
});

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({
      pathname: "/dashboard",
      search: "",
      hash: "",
    });
  });

  it("should show loading spinner when user is not ready", () => {
    mockUseUser.mockReturnValue({
      ready: false,
      address: null,
    });
    mockUsePrivy.mockReturnValue({
      authenticated: false,
    });

    render(<RequireAuth />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("should redirect to login when not authenticated", () => {
    mockUseUser.mockReturnValue({
      ready: true,
      address: null,
    });
    mockUsePrivy.mockReturnValue({
      authenticated: false,
    });

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate).toHaveAttribute("data-to", "/login?redirectTo=%2Fdashboard");
  });

  it("should redirect to login when authenticated but no address", () => {
    mockUseUser.mockReturnValue({
      ready: true,
      address: null,
    });
    mockUsePrivy.mockReturnValue({
      authenticated: true,
    });

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate).toHaveAttribute("data-to", "/login?redirectTo=%2Fdashboard");
  });

  it("should render protected content when authenticated with address", () => {
    mockUseUser.mockReturnValue({
      ready: true,
      address: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    });
    mockUsePrivy.mockReturnValue({
      authenticated: true,
    });

    render(<RequireAuth />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("should preserve redirect path with search and hash", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/gardens/123",
      search: "?tab=details",
      hash: "#section1",
    });
    mockUseUser.mockReturnValue({
      ready: true,
      address: null,
    });
    mockUsePrivy.mockReturnValue({
      authenticated: false,
    });

    render(<RequireAuth />);

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toHaveAttribute(
      "data-to",
      "/login?redirectTo=%2Fgardens%2F123%3Ftab%3Ddetails%23section1"
    );
  });
});
