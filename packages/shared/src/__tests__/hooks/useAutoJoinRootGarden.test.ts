/**
 * useAutoJoinRootGarden Hook Tests
 *
 * Tests for auto-joining root garden on first login.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
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

// Mock primary address hook
const mockUsePrimaryAddress = vi.fn();
vi.mock("../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mockUsePrimaryAddress(),
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

// Mock toast service
vi.mock("../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
  },
}));

import { readContract } from "@wagmi/core";
import { checkMembership, useAutoJoinRootGarden } from "../../hooks/garden/useAutoJoinRootGarden";
import { createMockGarden, createMockSmartAccountClient, MOCK_ADDRESSES } from "../test-utils";

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

    mockUsePrimaryAddress.mockReturnValue(MOCK_ADDRESSES.smartAccount);

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

  describe("hook initialization", () => {
    it("returns rootGardenAddress from config", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      expect(result.current.rootGardenAddress).toBe("0xRootGarden123456789012345678901234567890");
    });

    it("provides joinGarden function", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.joinGarden).toBe("function");
    });

    it("provides dismissPrompt function", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.dismissPrompt).toBe("function");
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

      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.joinGarden();
      });

      expect(mockClient.sendTransaction).toHaveBeenCalled();
      // Verify localStorage is updated with onboarding keys
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

      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      // Should not throw - AlreadyGardener is handled gracefully
      await act(async () => {
        await result.current.joinGarden();
      });

      // Should mark as onboarded even when already a gardener
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe("Loading states", () => {
    it("starts with isLoading false when not pending", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      // isLoading is derived from internal state and isPending
      // Initially should be false when no operation is in progress
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("dismissPrompt", () => {
    it("sets localStorage flag with correct key", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.dismissPrompt();
      });

      // Uses the updated key from the hook implementation
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "greengoods_root_garden_prompted",
        "true"
      );
    });
  });
});
