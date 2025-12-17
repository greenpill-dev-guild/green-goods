/**
 * useJoinGarden Hook Tests
 *
 * Tests for joining gardens with openJoining enabled.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock wagmi
vi.mock("wagmi", () => ({
  useWriteContract: vi.fn(() => ({
    writeContractAsync: vi.fn().mockResolvedValue("0xTxHash"),
    isPending: false,
  })),
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(),
}));

// Mock user hook
const mockUseUser = vi.fn();
vi.mock("../../hooks/auth/useUser", () => ({
  useUser: () => mockUseUser(),
}));

// Mock gardens hook
const mockUseGardens = vi.fn();
vi.mock("../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => mockUseGardens(),
}));

// Mock config
vi.mock("../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
  getDefaultChain: () => ({
    chainId: 84532,
    rootGarden: { address: "0xRootGarden" },
  }),
}));

// Mock utilities
vi.mock("../../utils/blockchain/address", () => ({
  isAddressInList: vi.fn((address, list) =>
    list?.some((a: string) => a.toLowerCase() === address?.toLowerCase())
  ),
}));

vi.mock("../../utils/contract/simulation", () => ({
  simulateJoinGarden: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../utils/blockchain/contracts", () => ({
  GardenAccountABI: [
    {
      name: "joinGarden",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [],
      outputs: [],
    },
    {
      name: "openJoining",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "bool" }],
    },
  ],
}));

vi.mock("../../utils/errors/contract-errors", () => ({
  isAlreadyGardenerError: vi.fn((error) => error?.message?.includes("AlreadyGardener")),
}));

import { readContract } from "@wagmi/core";
import { checkGardenOpenJoining, useJoinGarden } from "../../hooks/garden/useJoinGarden";
import { createMockSmartAccountClient, MOCK_ADDRESSES, MOCK_TX_HASH } from "../test-utils";

describe("hooks/garden/useJoinGarden", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default mocks
    mockUseUser.mockReturnValue({
      smartAccountAddress: MOCK_ADDRESSES.smartAccount,
      smartAccountClient: createMockSmartAccountClient(),
      eoa: null,
    });

    mockUseGardens.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("checkGardenOpenJoining", () => {
    it("returns true when garden has openJoining enabled", async () => {
      vi.mocked(readContract).mockResolvedValue(true);

      const result = await checkGardenOpenJoining(MOCK_ADDRESSES.garden);

      expect(result).toBe(true);
      expect(readContract).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          address: MOCK_ADDRESSES.garden,
          functionName: "openJoining",
        })
      );
    });

    it("returns false when garden has openJoining disabled", async () => {
      vi.mocked(readContract).mockResolvedValue(false);

      const result = await checkGardenOpenJoining(MOCK_ADDRESSES.garden);

      expect(result).toBe(false);
    });

    it("returns false on error", async () => {
      vi.mocked(readContract).mockRejectedValue(new Error("Network error"));

      const result = await checkGardenOpenJoining(MOCK_ADDRESSES.garden);

      expect(result).toBe(false);
    });
  });

  describe("joinGarden", () => {
    it("joins garden successfully with smart account", async () => {
      const mockClient = createMockSmartAccountClient();
      mockClient.sendTransaction.mockResolvedValue(MOCK_TX_HASH);

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        eoa: null,
      });

      const { result } = renderHook(() => useJoinGarden(), {
        wrapper: createWrapper(),
      });

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.joinGarden(MOCK_ADDRESSES.garden);
      });

      expect(txHash).toBe(MOCK_TX_HASH);
      expect(mockClient.sendTransaction).toHaveBeenCalled();
    });

    it("handles already-member case gracefully", async () => {
      const mockClient = createMockSmartAccountClient();
      const alreadyGardenerError = new Error("AlreadyGardener");
      mockClient.sendTransaction.mockRejectedValue(alreadyGardenerError);

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        eoa: null,
      });

      const { result } = renderHook(() => useJoinGarden(), {
        wrapper: createWrapper(),
      });

      let txHash: string | undefined;
      await act(async () => {
        txHash = await result.current.joinGarden(MOCK_ADDRESSES.garden);
      });

      // Should return "already-member" for AlreadyGardener errors
      expect(txHash).toBe("already-member");
      expect(result.current.error).toBeNull();
    });

    it("throws error for other failures", async () => {
      const mockClient = createMockSmartAccountClient();
      mockClient.sendTransaction.mockRejectedValue(new Error("Network error"));

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        eoa: null,
      });

      const { result } = renderHook(() => useJoinGarden(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.joinGarden(MOCK_ADDRESSES.garden);
        } catch (error) {
          expect((error as Error).message).toBe("Network error");
        }
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("State management", () => {
    it("tracks joining state correctly", async () => {
      const mockClient = createMockSmartAccountClient();
      // Delay resolution to test isJoining state
      mockClient.sendTransaction.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(MOCK_TX_HASH), 100))
      );

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        eoa: null,
      });

      const { result } = renderHook(() => useJoinGarden(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isJoining).toBe(false);

      let joinPromise: Promise<string>;
      act(() => {
        joinPromise = result.current.joinGarden(MOCK_ADDRESSES.garden);
      });

      // Should be joining now
      await waitFor(() => {
        expect(result.current.isJoining).toBe(true);
      });

      await act(async () => {
        await joinPromise;
      });

      // Should be done
      expect(result.current.isJoining).toBe(false);
    });
  });
});
