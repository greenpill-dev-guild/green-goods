/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth provider
const mockUseAuthContext = vi.fn();
const mockUsePrimaryAddress = vi.fn();
const mockUseDeploymentRegistry = vi.fn();
const TEST_CHAIN_ID = 11155111;

vi.mock("../../providers/Auth", () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

vi.mock("../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockUsePrimaryAddress(),
}));

vi.mock("../../hooks/blockchain/useDeploymentRegistry", () => ({
  useDeploymentRegistry: () => mockUseDeploymentRegistry(),
}));

vi.mock("../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

// Mock React Query
const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryFn?: () => Promise<unknown> }) => mockUseQuery(options),
}));

// Mock the GraphQL client
vi.mock("../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: vi.fn().mockResolvedValue({ data: { Garden: [] } }),
  },
}));

vi.mock("../../modules/data/graphql", () => ({
  greenGoodsGraphQL: vi.fn((query: string) => query),
}));

vi.mock("../../config/react-query", () => ({
  STALE_TIMES: {
    baseLists: 60000,
    works: 15000,
    queue: 5000,
    merged: 5000,
  },
}));

vi.mock("../query-keys", () => ({
  queryKeys: {
    role: {
      operatorGardens: (address?: string, chainId?: number) => [
        "greengoods",
        "role",
        "operatorGardens",
        address,
        chainId,
      ],
    },
  },
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
      isReady: true,
      isAuthenticated: false,
    });
    mockUsePrimaryAddress.mockReturnValue(null);
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: false,
      isOwner: false,
      isInAllowlist: false,
      loading: false,
    });
    // Mock React Query's useQuery response
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it("should return deployer role when user can deploy", () => {
    mockUsePrimaryAddress.mockReturnValue("0x123");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
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
    mockUsePrimaryAddress.mockReturnValue("0x456");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
    mockUseQuery.mockReturnValue({
      data: [
        { id: "0x123", name: "Test Garden" },
        { id: "0x456", name: "Another Garden" },
      ],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("operator");
    expect(result.current.isDeployer).toBe(false);
    expect(result.current.isOperator).toBe(true);
    expect(result.current.operatorGardens).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it("should return user role for unknown address without operator gardens", () => {
    mockUsePrimaryAddress.mockReturnValue("0x789");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
    mockUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("user");
    expect(result.current.isDeployer).toBe(false);
    expect(result.current.isOperator).toBe(false);
    expect(result.current.operatorGardens).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it("should show loading state when auth is not ready", () => {
    mockUsePrimaryAddress.mockReturnValue(null);
    mockUseAuthContext.mockReturnValue({ isReady: false, isAuthenticated: false });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should show loading state when query is fetching", () => {
    mockUsePrimaryAddress.mockReturnValue("0x123");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.loading).toBe(true);
  });

  it("should show loading state when deployment registry is loading", () => {
    mockUsePrimaryAddress.mockReturnValue("0x123");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
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
    mockUsePrimaryAddress.mockReturnValue("0x123");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
    mockUseDeploymentRegistry.mockReturnValue({
      canDeploy: true,
      isOwner: true,
      isInAllowlist: true,
      loading: false,
    });
    mockUseQuery.mockReturnValue({
      data: [{ id: "0x123", name: "Test Garden" }],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("deployer");
    expect(result.current.isDeployer).toBe(true);
    expect(result.current.isOperator).toBe(true); // Can still be operator
    expect(result.current.operatorGardens).toHaveLength(1);
  });

  it("uses the address that usePrimaryAddress returns (smart account in passkey mode)", () => {
    // Passkey mode: usePrimaryAddress returns smartAccountAddress regardless of
    // any wagmi connection. The previous wagmi-first chain in useRole could
    // outrank this and produce zero operator gardens for an authenticated
    // operator on the smart account; that bug must not regress.
    const SMART_ACCOUNT = "0xSmartAccount123";
    mockUsePrimaryAddress.mockReturnValue(SMART_ACCOUNT);
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
    mockUseQuery.mockReturnValue({
      data: [{ id: "0xGardenA", name: "Operator Garden" }],
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useRole());

    expect(result.current.role).toBe("operator");
    expect(result.current.isOperator).toBe(true);
    expect(result.current.operatorGardens).toHaveLength(1);
  });

  it("should return deployment permissions from hook state", () => {
    mockUsePrimaryAddress.mockReturnValue("0x123");
    mockUseAuthContext.mockReturnValue({ isReady: true, isAuthenticated: true });
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
