/**
 * useBatchListForYield Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests batch listing creation: progress tracking, validation,
 * and interface contract.
 */

import { type QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_SIGNER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const TEST_MODULE = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const mockAssertMarketplaceReady = vi.fn();
const mockEnsureAppKitWalletChain = vi.fn();
const mockBuildMakerAsk = vi.fn();
const mockSignMakerAsk = vi.fn();
const mockValidateOrder = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSendTransaction = vi.fn();

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../modules/marketplace/signing", () => ({
  buildMakerAsk: (...args: unknown[]) => mockBuildMakerAsk(...args),
  signMakerAsk: (...args: unknown[]) => mockSignMakerAsk(...args),
  validateOrder: (...args: unknown[]) => mockValidateOrder(...args),
}));

vi.mock("../../../utils/blockchain/hypercert-abis", () => ({
  HYPERCERTS_MODULE_ABI: [],
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  assertMarketplaceReady: (...args: unknown[]) => mockAssertMarketplaceReady(...args),
  getNetworkContracts: () => ({
    hypercertsModule: "0x3333333333333333333333333333333333333333",
  }),
}));

vi.mock("../../../modules/transactions/chain-guard", () => ({
  ensureAppKitWalletChain: (...args: unknown[]) => mockEnsureAppKitWalletChain(...args),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("wagmi", () => ({
  // The hook asks for the wallet client on the network the connection is on.
  useAccount: () => ({ chainId: 11155111 }),
  useWalletClient: () => ({
    data: {
      sendTransaction: (...args: unknown[]) => mockSendTransaction(...args),
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

vi.mock("../../../config/query-keys/invalidation", () => ({
  queryInvalidation: {
    onMarketplaceListingChanged: () => [
      ["greengoods", "marketplace", "orders"],
      ["greengoods", "marketplace"],
    ],
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

vi.mock("viem", () => ({
  encodeFunctionData: vi.fn().mockReturnValue("0xencoded"),
}));

import {
  type BatchProgress,
  useBatchListForYield,
} from "../../../hooks/hypercerts/useBatchListForYield";

// ============================================
// Test Suite
// ============================================

describe("useBatchListForYield", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockAssertMarketplaceReady.mockReturnValue({
      available: true,
      status: "available",
      missingFields: [],
      addresses: {
        hypercertsModule: TEST_MODULE,
      },
    });
    mockBuildMakerAsk.mockReturnValue({
      quoteType: 1,
      globalNonce: 0n,
      subsetNonce: 0n,
      orderNonce: 1n,
      strategyId: 1n,
      collectionType: 2,
      collection: TEST_MODULE,
      currency: "0x0000000000000000000000000000000000000000",
      signer: TEST_SIGNER,
      startTime: 1n,
      endTime: 2n,
      price: 1000n,
      itemIds: [1n],
      amounts: [1n],
      additionalParameters: "0x",
    });
    mockSignMakerAsk.mockResolvedValue("0xsignature");
    mockValidateOrder.mockReturnValue({ valid: true, errors: [] });
    mockSendTransaction.mockResolvedValue("0xtxhash");
  });

  describe("initial state", () => {
    it("starts with idle progress and no error", () => {
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
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
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
      });

      expect(typeof result.current.batchList).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("validation", () => {
    it("throws when garden address is missing", async () => {
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(undefined), {
        queryClient,
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
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
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

    it("refuses incomplete marketplace config before signing or writing", async () => {
      mockAssertMarketplaceReady.mockImplementation(() => {
        throw new Error("Marketplace configuration incomplete: marketplaceAdapter");
      });
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
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

      expect(result.current.error?.message).toContain("Marketplace configuration incomplete");
      expect(mockBuildMakerAsk).not.toHaveBeenCalled();
      expect(mockSignMakerAsk).not.toHaveBeenCalled();
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("invalidation", () => {
    it("keeps marketplace listing invalidation after a successful batch listing", async () => {
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
      });

      await act(async () => {
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
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["greengoods", "marketplace", "orders"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["greengoods", "marketplace"],
      });
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
      const { result } = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
        queryClient,
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
