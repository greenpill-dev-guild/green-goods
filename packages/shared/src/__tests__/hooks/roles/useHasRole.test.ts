/**
 * useHasRole Hook Tests
 * @vitest-environment jsdom
 *
 * Tests single role check for a user + garden combination.
 * Validates enabled/disabled states, role function mapping,
 * and error handling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_USER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

// ============================================
// Mocks
// ============================================

const mockReadContract = vi.fn();

vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../utils/blockchain/abis", () => ({
  GARDEN_ACCOUNT_ROLE_ABI: [],
}));

vi.mock("../../../utils/blockchain/address", () => ({
  isZeroAddress: (addr: string | null | undefined) =>
    !addr || addr === "0x0000000000000000000000000000000000000000",
}));

vi.mock("../../../utils/blockchain/garden-roles", () => ({
  GARDEN_ROLE_FUNCTIONS: {
    gardener: "isGardener",
    evaluator: "isEvaluator",
    operator: "isOperator",
    owner: "isOwner",
    funder: "isFunder",
    community: "isCommunity",
  },
}));

import { useHasRole } from "../../../hooks/roles/useHasRole";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

// ============================================
// Test Suite
// ============================================

describe("useHasRole", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  describe("disabled states", () => {
    it("returns false when gardenAddress is undefined", () => {
      const { result } = renderHook(() => useHasRole(undefined, TEST_USER, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasRole).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("returns false when userAddress is undefined", () => {
      const { result } = renderHook(() => useHasRole(TEST_GARDEN, undefined, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasRole).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("returns false when role is undefined", () => {
      const { result } = renderHook(() => useHasRole(TEST_GARDEN, TEST_USER, undefined), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasRole).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("returns false when gardenAddress is zero address", () => {
      const { result } = renderHook(() => useHasRole(ZERO_ADDRESS, TEST_USER, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasRole).toBe(false);
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("returns false when gardenAddress is null", () => {
      const { result } = renderHook(() => useHasRole(null, TEST_USER, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.hasRole).toBe(false);
    });
  });

  describe("enabled states", () => {
    it("returns true when contract returns true for operator", async () => {
      mockReadContract.mockResolvedValue(true);

      const { result } = renderHook(() => useHasRole(TEST_GARDEN, TEST_USER, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.hasRole).toBe(true);
      });

      expect(mockReadContract).toHaveBeenCalledWith(
        expect.anything(), // wagmiConfig
        expect.objectContaining({
          address: TEST_GARDEN,
          functionName: "isOperator",
          args: [TEST_USER],
        })
      );
    });

    it("returns false when contract returns false", async () => {
      mockReadContract.mockResolvedValue(false);

      const { result } = renderHook(() => useHasRole(TEST_GARDEN, TEST_USER, "gardener"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasRole).toBe(false);
    });

    it("maps role to correct function name", async () => {
      mockReadContract.mockResolvedValue(true);

      const roleMap = {
        gardener: "isGardener",
        evaluator: "isEvaluator",
        operator: "isOperator",
        owner: "isOwner",
      } as const;

      for (const [role, functionName] of Object.entries(roleMap)) {
        vi.clearAllMocks();
        queryClient = createQueryClient();
        mockReadContract.mockResolvedValue(true);

        renderHook(() => useHasRole(TEST_GARDEN, TEST_USER, role as keyof typeof roleMap), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => {
          expect(mockReadContract).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ functionName })
          );
        });
      }
    });
  });

  describe("error handling", () => {
    it("returns false when contract call fails", async () => {
      mockReadContract.mockRejectedValue(new Error("Reverted"));

      const { result } = renderHook(() => useHasRole(TEST_GARDEN, TEST_USER, "operator"), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // fetchHasRole catches errors and returns false
      expect(result.current.hasRole).toBe(false);
    });
  });
});
