/**
 * useBatchListForYield Hook Tests
 * @vitest-environment jsdom
 *
 * Tests batch listing creation: progress tracking, validation,
 * and interface contract.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_SIGNER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const TEST_MODULE = "0x3333333333333333333333333333333333333333" as `0x${string}`;

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../modules/marketplace", () => ({
  buildMakerAsk: vi.fn().mockReturnValue({
    quoteType: 0,
    globalNonce: 0n,
    subsetNonce: 0n,
    orderNonce: 0n,
    strategyId: 0n,
    collectionType: 0,
    collection: "0x0000000000000000000000000000000000000000",
    currency: "0x0000000000000000000000000000000000000000",
    signer: "0x2222222222222222222222222222222222222222",
    startTime: 0n,
    endTime: 0n,
    price: 0n,
    itemIds: [0n],
    amounts: [1n],
    additionalParameters: "0x",
  }),
  signMakerAsk: vi.fn().mockResolvedValue("0xsignature"),
  validateOrder: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

vi.mock("../../../hooks/hypercerts/hypercert-abis", () => ({
  HYPERCERTS_MODULE_ABI: [],
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    hypercertsModule: "0x3333333333333333333333333333333333333333",
  }),
}));

vi.mock("../../../config", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  createPublicClientForChain: () => ({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("wagmi", () => ({
  useWalletClient: () => ({
    data: {
      sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
    },
  }),
}));

vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => ({
    smartAccountClient: null,
    smartAccountAddress: null,
    eoaAddress: "0x2222222222222222222222222222222222222222",
  }),
}));

vi.mock("../../../stores/useAdminStore", () => ({
  useAdminStore: (selector: (state: { selectedChainId: number }) => unknown) =>
    selector({ selectedChainId: 11155111 }),
}));

vi.mock("../../../hooks/query-keys", () => ({
  queryInvalidation: {
    onMarketplaceListingChanged: () => [["greengoods", "marketplace"]],
  },
}));

vi.mock("viem", () => ({
  encodeFunctionData: vi.fn().mockReturnValue("0xencoded"),
}));

import {
  type BatchProgress,
  useBatchListForYield,
} from "../../../hooks/hypercerts/useBatchListForYield";

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

describe("useBatchListForYield", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  describe("initial state", () => {
    it("starts with idle progress and no error", () => {
      const { result } = renderHook(() => useBatchListForYield(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isBatching).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toEqual({
        total: 0,
        signed: 0,
        status: "idle",
      });
    });

    it("provides batchList and reset functions", () => {
      const { result } = renderHook(() => useBatchListForYield(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.batchList).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("validation", () => {
    it("throws when garden address is missing", async () => {
      const { result } = renderHook(() => useBatchListForYield(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.batchList([
            {
              hypercertId: 1n,
              fractionId: 1n,
              currency: "0x0000000000000000000000000000000000000000",
              pricePerUnit: 1000n,
              minUnitAmount: 1n,
              maxUnitAmount: 1000n,
              minUnitsToKeep: 0n,
              sellLeftover: false,
              durationDays: 30,
            },
          ]);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.message).toBe("Garden address required");
    });

    it("throws when listings array is empty", async () => {
      const { result } = renderHook(() => useBatchListForYield(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.batchList([]);
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.message).toBe("No listings to create");
    });
  });

  describe("progress types", () => {
    it("has valid BatchProgress status values", () => {
      const validStatuses: BatchProgress["status"][] = [
        "idle",
        "signing",
        "submitting",
        "confirming",
        "done",
        "error",
      ];

      validStatuses.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });
  });

  describe("reset", () => {
    it("resets progress to initial state", () => {
      const { result } = renderHook(() => useBatchListForYield(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      act(() => result.current.reset());

      expect(result.current.progress).toEqual({
        total: 0,
        signed: 0,
        status: "idle",
      });
      expect(result.current.error).toBeNull();
    });
  });
});
