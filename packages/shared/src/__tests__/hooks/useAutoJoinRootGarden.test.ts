/**
 * useAutoJoinRootGarden Hook Tests
 *
 * Tests for auto-joining root garden on first login.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
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
vi.mock("../../config/app", () => ({
  ONBOARDED_STORAGE_KEY: "greengoods_user_onboarded",
}));

vi.mock("../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
  getDefaultChain: () => ({
    chainId: 84532,
    rootGarden: { address: "0xRootGarden123456789012345678901234567890", tokenId: 0 },
  }),
}));

// Mock utilities
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
      name: "gardeners",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "bool" }],
    },
  ],
}));

vi.mock("../../utils/contract/simulation", () => ({
  simulateJoinGarden: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../utils/errors/contract-errors", () => ({
  isAlreadyGardenerError: vi.fn((error) => error?.message?.includes("AlreadyGardener")),
}));

import { useAutoJoinRootGarden, checkMembership } from "../../hooks/garden/useAutoJoinRootGarden";
import { readContract } from "@wagmi/core";
import { MOCK_ADDRESSES, createMockSmartAccountClient, createMockGarden } from "../test-utils";

describe("hooks/garden/useAutoJoinRootGarden", () => {
  let queryClient: QueryClient;

  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

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
    localStorageMock.clear();

    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Default mocks
    mockUseUser.mockReturnValue({
      smartAccountAddress: MOCK_ADDRESSES.smartAccount,
      smartAccountClient: createMockSmartAccountClient(),
      ready: true,
      eoa: null,
    });

    // Root garden with token ID 0
    mockUseGardens.mockReturnValue({
      data: [
        createMockGarden({
          id: "root-garden",
          tokenID: BigInt(0),
          gardeners: [],
          operators: [],
        }),
      ],
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("checkMembership", () => {
    it("returns isGardener true when user is a gardener on-chain", async () => {
      vi.mocked(readContract).mockResolvedValue(true);

      const result = await checkMembership(MOCK_ADDRESSES.smartAccount);

      expect(result.isGardener).toBe(true);
    });

    it("returns isGardener false when user is not a gardener", async () => {
      vi.mocked(readContract).mockResolvedValue(false);

      const result = await checkMembership(MOCK_ADDRESSES.smartAccount);

      expect(result.isGardener).toBe(false);
    });

    it("falls back to localStorage on network error", async () => {
      vi.mocked(readContract).mockRejectedValue(new Error("Network error"));
      localStorageMock.getItem.mockReturnValue("true");

      const result = await checkMembership(MOCK_ADDRESSES.smartAccount);

      // Should use localStorage fallback
      expect(result.hasBeenOnboarded).toBe(true);
    });
  });

  describe("isGardener detection", () => {
    it("detects existing gardener from indexer data", () => {
      mockUseGardens.mockReturnValue({
        data: [
          createMockGarden({
            id: "root-garden",
            tokenID: BigInt(0),
            gardeners: [MOCK_ADDRESSES.smartAccount],
            operators: [],
          }),
        ],
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isGardener).toBe(true);
    });

    it("detects operator as member", () => {
      mockUseGardens.mockReturnValue({
        data: [
          createMockGarden({
            id: "root-garden",
            tokenID: BigInt(0),
            gardeners: [],
            operators: [MOCK_ADDRESSES.smartAccount],
          }),
        ],
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isGardener).toBe(true);
    });

    it("returns false when user is not a member", () => {
      mockUseGardens.mockReturnValue({
        data: [
          createMockGarden({
            id: "root-garden",
            tokenID: BigInt(0),
            gardeners: ["0xOtherAddress"],
            operators: [],
          }),
        ],
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isGardener).toBe(false);
    });
  });

  describe("joinGarden", () => {
    it("joins successfully and updates state", async () => {
      const mockClient = createMockSmartAccountClient();
      mockClient.sendTransaction.mockResolvedValue("0xJoinTxHash");

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        ready: true,
        eoa: null,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.joinGarden();
      });

      expect(mockClient.sendTransaction).toHaveBeenCalled();
      expect(result.current.isGardener).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("handles AlreadyGardener error gracefully", async () => {
      const mockClient = createMockSmartAccountClient();
      mockClient.sendTransaction.mockRejectedValue(new Error("AlreadyGardener"));

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        ready: true,
        eoa: null,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.joinGarden();
      });

      // Should not throw, should set isGardener
      expect(result.current.isGardener).toBe(true);
    });

    it("skips join transaction if user is already a member", async () => {
      const mockClient = createMockSmartAccountClient();
      mockClient.sendTransaction.mockResolvedValue("0xJoinTxHash");

      mockUseUser.mockReturnValue({
        smartAccountAddress: MOCK_ADDRESSES.smartAccount,
        smartAccountClient: mockClient,
        ready: true,
        eoa: null,
      });

      // Mock gardens data showing user is already a member
      mockUseGardens.mockReturnValue({
        data: [
          createMockGarden({
            id: "root-garden",
            tokenID: BigInt(0),
            gardeners: [MOCK_ADDRESSES.smartAccount],
            operators: [],
          }),
        ],
        isLoading: false,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.joinGarden();
      });

      // Should NOT attempt transaction since user is already a member
      expect(mockClient.sendTransaction).not.toHaveBeenCalled();
      // Should still mark as gardener and update localStorage
      expect(result.current.isGardener).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith("rootGardenPrompted", "true");
    });
  });

  describe("Loading states", () => {
    it("shows loading when gardens are loading", () => {
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: true,
        isFetching: false,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("dismissPrompt", () => {
    it("sets localStorage flag and updates state", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(false), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.dismissPrompt();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith("rootGardenPrompted", "true");
      expect(result.current.showPrompt).toBe(false);
      expect(result.current.hasPrompted).toBe(true);
    });
  });
});
