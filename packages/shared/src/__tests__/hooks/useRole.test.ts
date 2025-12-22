/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth providers with proper relative paths
const mockUseOptionalAuthContext = vi.fn();
const mockUseOptionalWalletAuth = vi.fn();
const mockUseDeploymentRegistry = vi.fn();

vi.mock("../../providers/Auth", () => ({
  useOptionalAuthContext: () => mockUseOptionalAuthContext(),
}));

vi.mock("../../providers/WalletAuth", () => ({
  useOptionalWalletAuth: () => mockUseOptionalWalletAuth(),
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
    mockUseOptionalAuthContext.mockReturnValue(null);
    mockUseOptionalWalletAuth.mockReturnValue(null);
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

  it("should return deployer role when user can deploy", () => {
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x123",
      smartAccountAddress: null,
      isReady: true,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x456",
      smartAccountAddress: null,
      isReady: true,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x789",
      smartAccountAddress: null,
      isReady: true,
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

  it("should show loading state when auth is not ready", () => {
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: null,
      smartAccountAddress: null,
      isReady: false,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x123",
      smartAccountAddress: null,
      isReady: true,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x123",
      smartAccountAddress: null,
      isReady: true,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x123",
      smartAccountAddress: null,
      isReady: true,
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

  it("should use wallet auth when auth provider is not available", () => {
    mockUseOptionalAuthContext.mockReturnValue(null);
    mockUseOptionalWalletAuth.mockReturnValue({
      address: "0xabc",
      ready: true,
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

  it("should use smart account address when wallet address is null", () => {
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: null,
      smartAccountAddress: "0xSmartAccount123",
      isReady: true,
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
    mockUseOptionalAuthContext.mockReturnValue({
      walletAddress: "0x123",
      smartAccountAddress: null,
      isReady: true,
    });
    // Note: The hook gets canDeploy from deploymentRegistry, so we test that it passes through
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
});
