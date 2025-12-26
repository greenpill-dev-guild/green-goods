/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth provider
const mockUseAuthContext = vi.fn();
const mockUseAccount = vi.fn();
const mockUseDeploymentRegistry = vi.fn();

vi.mock("../../providers/Auth", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

vi.mock("../../hooks/blockchain/useDeploymentRegistry", () => ({
  useDeploymentRegistry: () => mockUseDeploymentRegistry(),
}));

// Mock URQL
const mockUseQuery = vi.fn();
vi.mock("urql", () => ({
  useQuery: () => mockUseQuery(),
}));

vi.mock("gql.tada", () => ({
  graphql: vi.fn((query: string) => query),
}));

// Import after mocks - using dynamic import inside tests to ensure mocks are applied
let useRole: typeof import("../../hooks/gardener/useRole").useRole;

beforeAll(async () => {
  const module = await import("../../hooks/gardener/useRole");
  useRole = module.useRole;
});

describe("useRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock values - not logged in
    mockUseAuthContext.mockReturnValue({
      smartAccountAddress: null,
      isReady: true,
      isAuthenticated: false,
    });
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
      loading: false,
    });
    mockUseQuery.mockReturnValue([
      {
        data: { Garden: [] },
        fetching: false,
        error: null,
      },
    ]);
  });

  it("should return deployer role when user can deploy (wallet mode)", () => {
    mockUseAccount.mockReturnValue({
      address: "0x123",
      isConnected: true,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: true,
      isOwner: true,
      isInAllowlist: true,
      loading: false,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("deployer");
    expect(result.current.isDeployer).toBe(true);
    expect(result.current.isOperator).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("should return operator role for user with operator gardens", () => {
    mockUseAccount.mockReturnValue({
      address: "0x456",
      isConnected: true,
    });
    mockUseQuery.mockReturnValue([
      {
        data: {
          Garden: [
            { id: "0x123", name: "Test Garden" },
            { id: "0x456", name: "Another Garden" },
          ],
        },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("operator");
    expect(result.current.isDeployer).toBe(false);
    expect(result.current.isOperator).toBe(true);
    expect(result.current.operatorGardens).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it("should return user role for unknown address without operator gardens", () => {
    mockUseAccount.mockReturnValue({
      address: "0x789",
      isConnected: true,
    });
    mockUseQuery.mockReturnValue([
      {
        data: { Garden: [] },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("user");
    expect(result.current.isDeployer).toBe(false);
    expect(result.current.isOperator).toBe(false);
    expect(result.current.operatorGardens).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it("should show loading state when not connected", () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    });
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: true,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should show loading state when query is fetching", () => {
    mockUseAccount.mockReturnValue({
      address: "0x123",
      isConnected: true,
    });
    mockUseQuery.mockReturnValue([
      {
        data: null,
        fetching: true,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should show loading state when deployment registry is loading", () => {
    mockUseAccount.mockReturnValue({
      address: "0x123",
      isConnected: true,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
      loading: true,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should deployer take precedence over operator role", () => {
    // Deployer address that also has operator gardens
    mockUseAccount.mockReturnValue({
      address: "0x123",
      isConnected: true,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: true,
      isOwner: true,
      isInAllowlist: true,
      loading: false,
    });
    mockUseQuery.mockReturnValue([
      {
        data: {
          Garden: [{ id: "0x123", name: "Test Garden" }],
        },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("deployer");
    expect(result.current.isDeployer).toBe(true);
    expect(result.current.isOperator).toBe(true); // Can still be operator
    expect(result.current.operatorGardens).toHaveLength(1);
  });

  it("should use smart account address when wagmi is not connected (passkey mode)", () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    });
    mockUseAuthContext.mockReturnValue({
      smartAccountAddress: "0xSmartAccount123",
      isReady: true,
      isAuthenticated: true,
    });
    mockUseQuery.mockReturnValue([
      {
        data: { Garden: [] },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("user");
    expect(result.current.loading).toBe(false);
  });

  it("should return deployment permissions from hook state", () => {
    mockUseAccount.mockReturnValue({
      address: "0x123",
      isConnected: true,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
      loading: false,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.deploymentPermissions).toEqual({
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
    });
  });

  it("should prioritize wagmi address over smart account address", () => {
    // Both wagmi and passkey auth available - wagmi should take precedence
    mockUseAccount.mockReturnValue({
      address: "0xWagmiAddress",
      isConnected: true,
    });
    mockUseAuthContext.mockReturnValue({
      smartAccountAddress: "0xSmartAccount123",
      isReady: true,
      isAuthenticated: true,
    });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: true,
      isOwner: true,
      isInAllowlist: false,
      loading: false,
    });
    mockUseQuery.mockReturnValue([
      {
        data: { Garden: [] },
        fetching: false,
        error: null,
      },
    ]);

    const { result } = renderHook(() => useRole());

    // Should detect deployer role using wagmi address
    expect(result.current.role).toBe("deployer");
    expect(result.current.isDeployer).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});
