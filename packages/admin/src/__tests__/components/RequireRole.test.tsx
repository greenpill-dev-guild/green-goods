import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import React from "react";
import { RequireRole } from "@/components/RequireRole";

// Mock the useRole hook
const mockUseRole = vi.fn();
vi.mock("@/hooks/useRole", () => ({
  useRole: () => mockUseRole(),
}));

// Mock react-router-dom Outlet
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Authorized Content"),
  };
});

describe("RequireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading spinner when role is loading", () => {
    mockUseRole.mockReturnValue({
      role: "unauthorized",
      loading: true,
      isAdmin: false,
      isOperator: false,
      operatorGardens: [],
    });

    render(<RequireRole allowedRoles={["admin"]} />);

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("should render content when user has required admin role", () => {
    mockUseRole.mockReturnValue({
      role: "admin",
      loading: false,
      isAdmin: true,
      isOperator: false,
      operatorGardens: [],
    });

    render(<RequireRole allowedRoles={["admin"]} />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByText("Authorized Content")).toBeInTheDocument();
    expect(screen.queryByText("Unauthorized")).not.toBeInTheDocument();
  });

  it("should render content when user has required operator role", () => {
    mockUseRole.mockReturnValue({
      role: "operator",
      loading: false,
      isAdmin: false,
      isOperator: true,
      operatorGardens: [{ id: "0x123", name: "Test Garden" }],
    });

    render(<RequireRole allowedRoles={["operator"]} />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByText("Authorized Content")).toBeInTheDocument();
  });

  it("should render content when user has any of multiple allowed roles", () => {
    mockUseRole.mockReturnValue({
      role: "operator",
      loading: false,
      isAdmin: false,
      isOperator: true,
      operatorGardens: [{ id: "0x123", name: "Test Garden" }],
    });

    render(<RequireRole allowedRoles={["admin", "operator"]} />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByText("Authorized Content")).toBeInTheDocument();
  });

  it("should show unauthorized message for unauthorized users", () => {
    mockUseRole.mockReturnValue({
      role: "unauthorized",
      loading: false,
      isAdmin: false,
      isOperator: false,
      operatorGardens: [],
    });

    render(<RequireRole allowedRoles={["admin"]} />);

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to access this area.")).toBeInTheDocument();
    expect(screen.getByText("Contact an admin to be added as an operator.")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("should show unauthorized message for operators accessing admin-only areas", () => {
    mockUseRole.mockReturnValue({
      role: "operator",
      loading: false,
      isAdmin: false,
      isOperator: true,
      operatorGardens: [{ id: "0x123", name: "Test Garden" }],
    });

    render(<RequireRole allowedRoles={["admin"]} />);

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to access this area.")).toBeInTheDocument();
    expect(
      screen.queryByText("Contact an admin to be added as an operator.")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("should not show contact admin message for operators", () => {
    mockUseRole.mockReturnValue({
      role: "operator",
      loading: false,
      isAdmin: false,
      isOperator: true,
      operatorGardens: [{ id: "0x123", name: "Test Garden" }],
    });

    render(<RequireRole allowedRoles={["admin"]} />);

    expect(
      screen.queryByText("Contact an admin to be added as an operator.")
    ).not.toBeInTheDocument();
  });
});
