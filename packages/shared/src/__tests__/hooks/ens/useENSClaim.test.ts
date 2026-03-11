/**
 * useENSClaim Hook Tests
 *
 * Tests the ENS subdomain claim mutation hook which supports both
 * passkey (sponsored) and wallet (user-funded) registration paths.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// MOCKS — declared before imports that use them
// ============================================================================

const mockSendTransaction = vi.fn();
const mockWriteContract = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

let mockAuthMode: "passkey" | "wallet" | "embedded" | null = null;
let mockWalletAddress: string | undefined = "0x1234567890123456789012345678901234567890";
let mockWalletClientData: { writeContract: ReturnType<typeof vi.fn> } | undefined = {
  writeContract: mockWriteContract,
};
const mockSmartAccountClient = {
  account: { address: "0xSmartAccount1234567890123456789012345678" },
  sendTransaction: mockSendTransaction,
};

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: mockWalletAddress,
  })),
  useWalletClient: vi.fn(() => ({
    data: mockWalletClientData,
  })),
}));

vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: vi.fn(() => ({
    authMode: mockAuthMode,
    smartAccountClient: mockAuthMode === "passkey" ? mockSmartAccountClient : null,
  })),
}));

const ENS_ADDRESS = "0xENSContract000000000000000000000000000001" as const;

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "claimNameSponsored", type: "function", inputs: [{ name: "slug", type: "string" }] },
    { name: "claimName", type: "function", inputs: [{ name: "slug", type: "string" }] },
    {
      name: "getRegistrationFee",
      type: "function",
      inputs: [
        { name: "slug", type: "string" },
        { name: "sender", type: "address" },
        { name: "nameType", type: "uint8" },
      ],
    },
  ],
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: vi.fn((error: Error) => ({
    name: error.message,
    message: error.message,
  })),
}));

import { toastService } from "../../../components/toast";
// Import after mocks
import { useENSClaim } from "../../../hooks/ens/useENSClaim";
import { queryKeys } from "../../../hooks/query-keys";
import { logger } from "../../../modules/app/logger";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// ============================================================================
// TESTS
// ============================================================================

describe("useENSClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMode = null;
    mockWalletAddress = "0x1234567890123456789012345678901234567890";
    mockWalletClientData = { writeContract: mockWriteContract };

    // Default receipt with no matching event logs
    mockWaitForTransactionReceipt.mockResolvedValue({
      logs: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Passkey (Sponsored) Flow
  // --------------------------------------------------------------------------

  describe("passkey user flow (sponsored)", () => {
    beforeEach(() => {
      mockAuthMode = "passkey";
    });

    it("calls claimNameSponsored via smart account", async () => {
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { queryClient, wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ENS_ADDRESS,
        })
      );
      expect(result.current.data?.slug).toBe("alice");
    });

    it("returns txHash and submittedAt on success", async () => {
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.txHash).toBe(MOCK_TX_HASH);
      expect(result.current.data?.submittedAt).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Wallet (User-Funded) Flow
  // --------------------------------------------------------------------------

  describe("wallet user flow (user-funded)", () => {
    beforeEach(() => {
      mockAuthMode = "wallet";
    });

    it("reads fee and calls claimName with value", async () => {
      const mockFee = BigInt(100000);
      mockReadContract.mockResolvedValue(mockFee);
      mockWriteContract.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "bob" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should have read the fee first
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getRegistrationFee",
        })
      );

      // Then called writeContract with the fee as value
      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          value: mockFee,
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Error Cases
  // --------------------------------------------------------------------------

  describe("error handling", () => {
    it("throws when no auth mode (no connected account)", async () => {
      mockAuthMode = null;
      mockWalletAddress = undefined;
      mockWalletClientData = undefined;

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("No connected account");
    });

    it("throws when ENS module not configured (zero address)", async () => {
      mockAuthMode = "wallet";

      // Override getNetworkContracts to return zero address
      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: "0x0000000000000000000000000000000000000000",
      });

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("ENS module not configured for this network");
    });

    it("calls logger.error on failure", async () => {
      mockAuthMode = "wallet";
      mockReadContract.mockRejectedValue(new Error("RPC error"));

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(logger.error).toHaveBeenCalledWith("ENS claim failed", expect.any(Object));
    });

    it("shows toast error on failure", async () => {
      mockAuthMode = "wallet";
      mockReadContract.mockRejectedValue(new Error("InsufficientFee"));

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(toastService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Registration failed",
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // onSuccess Behavior
  // --------------------------------------------------------------------------

  describe("onSuccess", () => {
    it("seeds registration status query with pending data", async () => {
      mockAuthMode = "passkey";
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { queryClient, wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Check that query data was seeded
      const seededData = queryClient.getQueryData(queryKeys.ens.registrationStatus("alice"));
      expect(seededData).toEqual(
        expect.objectContaining({
          status: "pending",
          submittedAt: expect.any(Number),
        })
      );
    });

    it("shows success toast", async () => {
      mockAuthMode = "passkey";
      mockSendTransaction.mockResolvedValue(MOCK_TX_HASH);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useENSClaim(), { wrapper });

      result.current.mutate({ slug: "alice" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(toastService.success).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Name registration started",
        })
      );
    });
  });
});
