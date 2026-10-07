/**
 * useBatchListForYield Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests batch listing creation: progress tracking, validation,
 * and interface contract.
 */

import { type QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders as renderHookWithQueryClient } from "../../test-utils/render-helpers";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_SIGNER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const TEST_MODULE = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const mockAssertMarketplaceReady = vi.fn();
const mockBuildMakerAsk = vi.fn();
const mockGetOrderNonces = vi.fn();
vi.mock("../../../modules/marketplace/client", () => ({
  getOrderNonces: (...args: unknown[]) => mockGetOrderNonces(...args),
}));
const mockSignMakerAsk = vi.fn();
const mockValidateOrder = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSendTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockGetReceipt = vi.fn();
let authMode: "wallet" | "passkey" = "wallet";
const mockOwnership = vi.fn();
const mockSender = () => ({
  authMode,
  sendContractCall: mockSendTransaction,
  signTypedData: vi.fn(),
  assertOwnership: mockOwnership,
});
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => TEST_SIGNER }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockSender(),
}));

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
  MARKETPLACE_ADAPTER_ABI: [],
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  assertMarketplaceReady: (...args: unknown[]) => mockAssertMarketplaceReady(...args),
  getNetworkContracts: () => ({
    hypercertsModule: "0x3333333333333333333333333333333333333333",
  }),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
    readContract: mockReadContract,
    getTransactionReceipt: mockGetReceipt,
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

import { WalletWriteNotRetriedError } from "../../../utils/errors/wallet-network-refusal";
import { useMarketplacePendingStore } from "../../../stores/useMarketplacePendingStore";
import {
  type BatchProgress,
  useBatchListForYield,
} from "../../../hooks/hypercerts/useBatchListForYield";

// ============================================
// Test Suite
// ============================================

describe.each(["wallet", "passkey"] as const)("useBatchListForYield with %s", (mode) => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    useMarketplacePendingStore.setState({ pending: {}, active: {} });
    mockReadContract.mockResolvedValue(0n);
    mockGetReceipt.mockRejectedValue(new Error("not mined"));
    authMode = mode;
    queryClient = createTestQueryClient();
    mockAssertMarketplaceReady.mockReturnValue({
      available: true,
      status: "available",
      missingFields: [],
      addresses: {
        hypercertsModule: TEST_MODULE,
        marketplaceAdapter: TEST_MODULE,
      },
    });
    mockGetOrderNonces.mockResolvedValue({ globalNonce: 4n, orderNonce: 1n });
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
    mockSendTransaction.mockResolvedValue({ hash: "0xtxhash", sponsored: false });
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

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          account: TEST_SIGNER,
          chainId: TEST_CHAIN_ID,
          address: TEST_MODULE,
        }),
        expect.objectContaining({ assertOwnership: expect.any(Function) })
      );
      expect(mockOwnership).toHaveBeenCalledWith(TEST_SIGNER, TEST_CHAIN_ID);
      expect(mockBuildMakerAsk).toHaveBeenCalledWith(
        expect.any(Object),
        TEST_SIGNER,
        TEST_CHAIN_ID,
        { globalNonce: 4n, orderNonce: 1n }
      );
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
  it("keeps accepted batches pending across reset/remount and rejects unrelated orders", async () => {
    mockSendTransaction.mockResolvedValueOnce({ hash: "0xproposal", confirmation: "pending" });
    const listings = [
      {
        hypercertId: 1n,
        fractionId: 1n,
        currency: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        minUnitsToKeep: 0n,
        sellLeftover: false,
        durationDays: 30,
      },
    ];
    const first = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
      queryClient,
    });
    await act(async () => {
      await first.result.current.batchList(listings);
    });
    await waitFor(() => expect(first.result.current.progress.status).toBe("pending"));
    expect(first.result.current.error).toBeNull();
    act(() => first.result.current.reset());
    expect(first.result.current.progress.status).toBe("pending");
    first.unmount();
    await useMarketplacePendingStore.persist.rehydrate();
    const next = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
      queryClient,
    });
    await act(async () => {
      await next.result.current.batchList(listings);
    });
    expect(mockSendTransaction).toHaveBeenCalledOnce();
    expect(mockSignMakerAsk).toHaveBeenCalledOnce();
    await act(async () => {
      await next.result.current.checkPending();
    });
    expect(next.result.current.progress.status).toBe("pending");
    expect(mockGetReceipt).not.toHaveBeenCalled();
    mockReadContract.mockImplementation(async ({ functionName }) =>
      functionName === "activeOrders"
        ? 5n
        : [1n, "0x", "0xwrong-signature", 0n, 0n, 0n, TEST_SIGNER]
    );
    await act(async () => {
      await next.result.current.checkPending();
    });
    expect(next.result.current.progress.status).toBe("pending");
    mockReadContract.mockImplementation(async ({ functionName }) =>
      functionName === "activeOrders" ? 5n : [1n, "0x", "0xsignature", 0n, 0n, 0n, TEST_SIGNER]
    );
    await act(async () => {
      await next.result.current.checkPending();
    });
    expect(next.result.current.progress.status).toBe("done");
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(mockSendTransaction).toHaveBeenCalledOnce();
  });
  it("only releases a failed batch after an actual reverted receipt", async () => {
    const hash = `0x${"ab".repeat(32)}`;
    mockSendTransaction.mockResolvedValueOnce({ hash, confirmation: "pending" });
    const listings = [
      {
        hypercertId: 1n,
        fractionId: 1n,
        currency: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        minUnitsToKeep: 0n,
        sellLeftover: false,
        durationDays: 30,
      },
    ];
    const view = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
      queryClient,
    });
    await act(async () => {
      await view.result.current.batchList(listings);
    });
    await waitFor(() => expect(view.result.current.progress.status).toBe("pending"));
    await act(async () => {
      await view.result.current.checkPending();
    });
    expect(view.result.current.progress.status).toBe("pending");
    mockGetReceipt.mockResolvedValueOnce({ status: "reverted", transactionHash: hash });
    await act(async () => {
      await view.result.current.checkPending();
    });
    expect(view.result.current.progress.status).toBe("error");
    expect(mockSendTransaction).toHaveBeenCalledOnce();
    await act(async () => {
      await view.result.current.batchList(listings);
    });
    expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    expect(view.result.current.progress.status).toBe("done");
  });
  it("retains pending on RPC errors and only releases cancelled proposals after wallet review", async () => {
    const listings = [
      {
        hypercertId: 1n,
        fractionId: 1n,
        currency: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        minUnitsToKeep: 0n,
        sellLeftover: false,
        durationDays: 30,
      },
    ];
    mockSendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBeforeBroadcast();
      throw new WalletWriteNotRetriedError(new Error("switch refused"));
    });
    const view = renderHookWithQueryClient(() => useBatchListForYield(TEST_GARDEN), {
      queryClient,
    });
    await act(async () => {
      await expect(view.result.current.batchList(listings)).rejects.toThrow("switch refused");
    });
    expect(view.result.current.progress.status).toBe("error");
    mockSendTransaction.mockResolvedValueOnce({ hash: "0xproposal", confirmation: "pending" });
    await act(async () => {
      await view.result.current.batchList(listings);
    });
    await waitFor(() => expect(view.result.current.progress.status).toBe("pending"));
    mockReadContract.mockRejectedValueOnce(new Error("RPC unavailable"));
    await act(async () => {
      await expect(view.result.current.checkPending()).resolves.toBeUndefined();
    });
    expect(view.result.current.progress.status).toBe("pending");
    await waitFor(() => expect(view.result.current.error).not.toBeNull());
    await act(async () => {
      await expect(view.result.current.confirmWalletCancellation(false)).rejects.toThrow(
        "confirmation-required"
      );
    });
    expect(view.result.current.progress.status).toBe("pending");
    await act(async () => {
      await view.result.current.confirmWalletCancellation(true);
    });
    expect(view.result.current.progress.status).toBe("idle");
    expect(mockSendTransaction).toHaveBeenCalledTimes(2);
  });
});
