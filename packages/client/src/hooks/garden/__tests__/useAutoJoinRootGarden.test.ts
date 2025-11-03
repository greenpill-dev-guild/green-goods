/**
 * useAutoJoinRootGarden Test Suite
 *
 * Tests the root garden joining functionality with both passkey and wallet flows
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PasskeySession } from "../../../modules/auth/passkey";
import { useAutoJoinRootGarden } from "../useAutoJoinRootGarden";

// Mock dependencies
const mockRefetch = vi.fn();
const mockWriteContractAsync = vi.fn();
const mockSendTransaction = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

const mockRootGarden = {
  address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
  tokenId: 1n,
};

const mockUser = {
  smartAccountAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
  smartAccountClient: null as any,
  ready: true,
};

const mockSmartAccountClient = {
  account: {
    address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
  },
  chain: { id: 84532 },
  sendTransaction: mockSendTransaction,
};

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useReadContract: vi.fn(() => ({
    data: false,
    isLoading: false,
    refetch: mockRefetch,
  })),
  useWriteContract: vi.fn(() => ({
    writeContractAsync: mockWriteContractAsync,
    isPending: false,
  })),
}));

// Mock useUser
vi.mock("../../auth/useUser", () => ({
  useUser: vi.fn(() => mockUser),
}));

// Mock blockchain config
vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
  getDefaultChain: vi.fn(() => ({
    chainId: 84532,
    rootGarden: mockRootGarden,
  })),
}));

// Mock TanStack Query
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => mockQueryClient),
}));

// Mock query invalidation
vi.mock("../../query-keys", () => ({
  queryInvalidation: {
    invalidateGardens: vi.fn(() => [
      ["gardens", 84532],
      ["garden", 84532],
    ]),
  },
}));

// Mock error utilities
vi.mock("../../../utils/errors", () => ({
  isAlreadyGardenerError: vi.fn((error: any) => {
    const message = error?.message || String(error);
    return message.includes("AlreadyGardener") || message.includes("0x42375a1e");
  }),
}));

describe("useAutoJoinRootGarden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset mocks to default state
    mockUser.smartAccountAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`;
    mockUser.smartAccountClient = null;
    mockUser.ready = true;

    mockRefetch.mockResolvedValue({ data: false });
    mockWriteContractAsync.mockResolvedValue("0xtxhash");
    mockSendTransaction.mockResolvedValue("0xtxhash");
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  describe("Membership Status", () => {
    it("returns correct membership status from contract", () => {
      const { useReadContract } = require("wagmi");
      useReadContract.mockReturnValue({
        data: true,
        isLoading: false,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.isGardener).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("returns loading state correctly", () => {
      const { useReadContract } = require("wagmi");
      useReadContract.mockReturnValue({
        data: false,
        isLoading: true,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.isLoading).toBe(true);
    });

    it("checks hasBeenOnboarded from localStorage", () => {
      const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      localStorage.setItem(`greengoods_onboarded:${address}`, "true");

      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.hasBeenOnboarded).toBe(true);
    });

    it("returns false for hasBeenOnboarded when not in localStorage", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.hasBeenOnboarded).toBe(false);
    });
  });

  describe("Passkey Join Flow", () => {
    it("joins garden with passkey (sponsored transaction)", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      const { result } = renderHook(() => useAutoJoinRootGarden());

      const txHash = await result.current.joinGarden(session);

      expect(mockSendTransaction).toHaveBeenCalledWith({
        account: mockSmartAccountClient.account,
        chain: mockSmartAccountClient.chain,
        to: mockRootGarden.address,
        value: 0n,
        data: expect.any(String),
      });
      expect(txHash).toBe("0xtxhash");
    });

    it("sets localStorage flag after successful passkey join", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.joinGarden(session);

      const storageKey = "greengoods_onboarded:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      expect(localStorage.getItem(storageKey)).toBe("true");
    });

    it("invalidates queries after successful passkey join", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.joinGarden(session);

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["gardens", 84532] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["garden", 84532] });
    });

    it("refetches membership after successful passkey join", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.joinGarden(session);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Wallet Join Flow", () => {
    it("joins garden with wallet (user pays gas)", async () => {
      mockUser.smartAccountClient = null;

      const { result } = renderHook(() => useAutoJoinRootGarden());

      const txHash = await result.current.joinGarden();

      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: mockRootGarden.address,
        abi: expect.any(Array),
        functionName: "joinGarden",
        args: [],
      });
      expect(txHash).toBe("0xtxhash");
    });

    it("sets localStorage flag after successful wallet join", async () => {
      mockUser.smartAccountClient = null;

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.joinGarden();

      const storageKey = "greengoods_onboarded:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      expect(localStorage.getItem(storageKey)).toBe("true");
    });

    it("invalidates queries after successful wallet join", async () => {
      mockUser.smartAccountClient = null;

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.joinGarden();

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    });
  });

  describe("AlreadyGardener Error Handling", () => {
    it("handles AlreadyGardener error gracefully for passkey", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      mockSendTransaction.mockRejectedValue(new Error("AlreadyGardener"));

      const { result } = renderHook(() => useAutoJoinRootGarden());

      const txHash = await result.current.joinGarden(session);

      expect(txHash).toBeNull();

      // Should still set localStorage flag
      const storageKey = "greengoods_onboarded:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      expect(localStorage.getItem(storageKey)).toBe("true");

      // Should still refetch membership
      expect(mockRefetch).toHaveBeenCalled();
    });

    it("handles AlreadyGardener error gracefully for wallet", async () => {
      mockUser.smartAccountClient = null;
      mockWriteContractAsync.mockRejectedValue(new Error("Error: 0x42375a1e"));

      const { result } = renderHook(() => useAutoJoinRootGarden());

      const txHash = await result.current.joinGarden();

      expect(txHash).toBeNull();

      // Should still set localStorage flag
      const storageKey = "greengoods_onboarded:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      expect(localStorage.getItem(storageKey)).toBe("true");
    });
  });

  describe("Error Handling", () => {
    it("throws error for non-AlreadyGardener errors", async () => {
      const session: PasskeySession = {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        client: mockSmartAccountClient as any,
      };

      mockSendTransaction.mockRejectedValue(new Error("Transaction failed"));

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await expect(result.current.joinGarden(session)).rejects.toThrow("Transaction failed");
    });

    it("throws error when root garden address is missing", async () => {
      const { getDefaultChain } = require("../../../config/blockchain");
      getDefaultChain.mockReturnValue({
        chainId: 84532,
        rootGarden: null,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await expect(result.current.joinGarden()).rejects.toThrow(
        "Missing root garden address or user address"
      );
    });

    it("throws error when user address is missing", async () => {
      mockUser.smartAccountAddress = null as any;

      const { result } = renderHook(() => useAutoJoinRootGarden());

      await expect(result.current.joinGarden()).rejects.toThrow(
        "Missing root garden address or user address"
      );
    });
  });

  describe("Loading States", () => {
    it("combines isLoading from contract read and mutation", () => {
      const { useReadContract, useWriteContract } = require("wagmi");

      useReadContract.mockReturnValue({
        data: false,
        isLoading: true,
        refetch: mockRefetch,
      });

      useWriteContract.mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        isPending: false,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.isLoading).toBe(true);
    });

    it("shows loading when mutation is pending", () => {
      const { useReadContract, useWriteContract } = require("wagmi");

      useReadContract.mockReturnValue({
        data: false,
        isLoading: false,
        refetch: mockRefetch,
      });

      useWriteContract.mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        isPending: true,
      });

      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("RefetchMembership", () => {
    it("exposes refetchMembership function", () => {
      const { result } = renderHook(() => useAutoJoinRootGarden());

      expect(result.current.refetchMembership).toBeDefined();
      expect(typeof result.current.refetchMembership).toBe("function");
    });

    it("calls contract refetch when refetchMembership is called", async () => {
      const { result } = renderHook(() => useAutoJoinRootGarden());

      await result.current.refetchMembership();

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
