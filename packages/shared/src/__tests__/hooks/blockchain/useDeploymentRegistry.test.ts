/**
 * useDeploymentRegistry Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the deployment registry permission-checking hook. This hook creates a
 * viem PublicClient and reads on-chain state (owner, isInAllowlist) to determine
 * if the connected user has deploy permissions.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ADDRESSES } from "../../test-utils/mock-factories";

// ============================================
// Mocks
// ============================================

const mockReadContract = vi.fn();

// Mock viem's createPublicClient to return a client with a mockable readContract
vi.mock("viem", () => ({
  createPublicClient: () => ({
    readContract: (...args: unknown[]) => mockReadContract(...args),
  }),
  http: (url: string) => ({ url }),
}));

// Track auth state for testing
let mockAuthContext = {
  isReady: true,
  isAuthenticated: true,
  walletAddress: MOCK_ADDRESSES.deployer as string | null,
  smartAccountAddress: null as string | null,
};

vi.mock("../../../providers/Auth", () => ({
  useAuthContext: () => mockAuthContext,
}));

// Track wagmi state for testing
let mockWagmiAccount = {
  address: MOCK_ADDRESSES.deployer as string | undefined,
  isConnected: true,
};

vi.mock("wagmi", () => ({
  useAccount: () => mockWagmiAccount,
}));

// Admin store with selectedChainId
let mockSelectedChainId: number | null = null;

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number | null }) => unknown) =>
    selector({ selectedChainId: mockSelectedChainId }),
}));

// Mock blockchain config
vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getNetworkConfig: () => ({
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  }),
}));

// Mock network contracts
const mockDeploymentRegistryAddress = "0xDeploymentRegistry1234567890123456789012";

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    deploymentRegistry: mockDeploymentRegistryAddress,
  }),
  getChain: () => ({ id: 11155111, name: "Sepolia" }),
}));

// Mock address comparison
vi.mock("../../../utils/blockchain/address", () => ({
  compareAddresses: (a: string, b: string) => a?.toLowerCase() === b?.toLowerCase(),
  isZeroAddress: (addr: string | undefined | null) =>
    !addr || addr.toLowerCase() === "0x0000000000000000000000000000000000000000",
}));

// Mock logger
vi.mock("../../../modules/app/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock appkit config
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { useDeploymentRegistry } from "../../../hooks/blockchain/useDeploymentRegistry";

// ============================================
// Test helpers
// ============================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("useDeploymentRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = {
      isReady: true,
      isAuthenticated: true,
      walletAddress: MOCK_ADDRESSES.deployer,
      smartAccountAddress: null,
    };
    mockWagmiAccount = {
      address: MOCK_ADDRESSES.deployer,
      isConnected: true,
    };
    mockSelectedChainId = null;
  });

  // ------------------------------------------
  // Loading state
  // ------------------------------------------

  describe("loading state", () => {
    it("starts in loading state", () => {
      mockReadContract.mockResolvedValue(MOCK_ADDRESSES.deployer);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
    });

    it("stays in loading state when not connected", async () => {
      mockWagmiAccount = { address: undefined, isConnected: false };
      mockAuthContext = {
        ...mockAuthContext,
        isReady: true,
        isAuthenticated: false,
        walletAddress: null,
      };

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      // Should remain loading since no address is available
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Owner check
  // ------------------------------------------

  describe("owner permissions", () => {
    it("detects when user is the owner", async () => {
      // First call: owner() returns user's address
      // Second call: isInAllowlist() returns false
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(false);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });

    it("detects when user is NOT the owner", async () => {
      mockReadContract
        .mockResolvedValueOnce("0xSomeOtherOwner123456789012345678901234")
        .mockResolvedValueOnce(false);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Allowlist check
  // ------------------------------------------

  describe("allowlist permissions", () => {
    it("detects when user is in the allowlist", async () => {
      mockReadContract
        .mockResolvedValueOnce("0xSomeOtherOwner123456789012345678901234")
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });

    it("canDeploy is true when user is both owner AND in allowlist", async () => {
      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(true);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(true);
      expect(result.current.isInAllowlist).toBe(true);
      expect(result.current.canDeploy).toBe(true);
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("sets error state and returns all-false on RPC failure", async () => {
      mockReadContract.mockRejectedValue(new Error("RPC connection failed"));

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("RPC connection failed");
      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(false);
      expect(result.current.canDeploy).toBe(false);
    });

    it("handles non-Error exceptions gracefully", async () => {
      mockReadContract.mockRejectedValue("string error");

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Unknown error");
      expect(result.current.canDeploy).toBe(false);
    });
  });

  // ------------------------------------------
  // Address priority
  // ------------------------------------------

  describe("address priority", () => {
    it("prefers wagmi address when available", async () => {
      mockWagmiAccount = { address: MOCK_ADDRESSES.deployer, isConnected: true };
      mockAuthContext = {
        ...mockAuthContext,
        walletAddress: MOCK_ADDRESSES.operator,
      };

      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.deployer).mockResolvedValueOnce(false);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should be owner because wagmi address matches
      expect(result.current.isOwner).toBe(true);
    });

    it("falls back to auth walletAddress when wagmi is disconnected", async () => {
      mockWagmiAccount = { address: undefined, isConnected: false };
      mockAuthContext = {
        isReady: true,
        isAuthenticated: true,
        walletAddress: MOCK_ADDRESSES.operator,
        smartAccountAddress: null,
      };

      mockReadContract.mockResolvedValueOnce(MOCK_ADDRESSES.operator).mockResolvedValueOnce(false);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(true);
    });
  });

  // ------------------------------------------
  // Zero address registry (placed last because vi.spyOn overrides module mock)
  // ------------------------------------------

  describe("unconfigured registry", () => {
    it("returns all-false when registry is zero address", async () => {
      // Override getNetworkContracts to return zero address via vi.spyOn
      const contractsMock = await import("../../../utils/blockchain/contracts");
      const spy = vi.spyOn(contractsMock, "getNetworkContracts").mockReturnValue({
        deploymentRegistry: "0x0000000000000000000000000000000000000000",
      } as ReturnType<typeof contractsMock.getNetworkContracts>);

      const { result } = renderHook(() => useDeploymentRegistry(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isOwner).toBe(false);
      expect(result.current.isInAllowlist).toBe(false);
      expect(result.current.canDeploy).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();

      // Restore the spy to avoid leaking into other tests
      spy.mockRestore();
    });
  });
});
