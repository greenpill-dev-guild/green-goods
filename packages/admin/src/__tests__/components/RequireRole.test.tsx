import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequireRole from "@/routes/RequireRole";

const mockUseRole = vi.fn();

vi.mock("@green-goods/shared/hooks", () => ({
  useRole: () => mockUseRole(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Outlet: () => React.createElement("div", { "data-testid": "outlet" }, "Authorized Content"),
  };
});

type RoleOverrides = {
  role?: "deployer" | "operator" | "user";
  loading?: boolean;
  isDeployer?: boolean;
  isOperator?: boolean;
  operatorGardens?: Array<{ id: string; name: string }>;
  deploymentPermissions?: {
    canDeploy?: boolean;
    isOwner?: boolean;
    isInAllowlist?: boolean;
  };
};

function buildRoleState(overrides: RoleOverrides = {}) {
  const { deploymentPermissions, ...rest } = overrides;
  return {
    role: "user" as const,
    loading: false,
    isDeployer: false,
    isOperator: false,
    operatorGardens: [] as Array<{ id: string; name: string }>,
    deploymentPermissions: {
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
      ...deploymentPermissions,
    },
    ...rest,
  };
}

describe("RequireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the layout skeleton while roles are loading", () => {
    mockUseRole.mockReturnValue(
      buildRoleState({
        loading: true,
      })
    );

    render(<RequireRole allowedRoles={["deployer"]} />);

    expect(screen.getByTestId("dashboard-layout-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });

  it("renders nested routes when user has an allowed role", () => {
    mockUseRole.mockReturnValue(
      buildRoleState({
        role: "deployer",
        isDeployer: true,
        deploymentPermissions: {
          canDeploy: true,
          isOwner: true,
          isInAllowlist: true,
        },
      })
    );

    render(<RequireRole allowedRoles={["deployer"]} />);

    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByText("Unauthorized")).not.toBeInTheDocument();
  });

  it("shows guidance when a general user is unauthorized", () => {
    mockUseRole.mockReturnValue(buildRoleState());

    render(<RequireRole allowedRoles={["deployer"]} />);

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to access this area.")).toBeInTheDocument();
    expect(screen.getByText("To access this area, you need to be:")).toBeInTheDocument();
    expect(
      screen.getByText("Added to the deployment registry allowlist for contract management")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-layout-skeleton")).not.toBeInTheDocument();
  });

  it("shows an unauthorized message without user guidance for operators", () => {
    mockUseRole.mockReturnValue(
      buildRoleState({
        role: "operator",
        isOperator: true,
        operatorGardens: [{ id: "1", name: "Test Garden" }],
      })
    );

    render(<RequireRole allowedRoles={["deployer"]} />);

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to access this area.")).toBeInTheDocument();
    expect(
      screen.queryByText("Added to the deployment registry allowlist for contract management")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
  });
});
