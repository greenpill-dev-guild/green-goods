/**
 * useCreateListing Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests the two-phase listing creation flow:
 * 1. Build + sign EIP-712 maker ask
 * 2. Register on-chain via HypercertsModule.listForYield()
 *
 * Since the hook integrates blockchain transactions, we test
 * the interface contract, validation, and error handling.
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

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackContractError: vi.fn(),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseAndFormatError: (error: Error) => ({
    title: "Error",
    message: error.message,
    parsed: { name: "Unknown", isKnown: false },
  }),
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { info: vi.fn(), error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

const mockBuildMakerAsk = vi.fn();
const mockGetOrderNonces = vi.fn();
const mockSignMakerAsk = vi.fn();
const mockValidateOrder = vi.fn();
const mockAssertMarketplaceReady = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSendTransaction = vi.fn();
const mockReadContract = vi.fn();
const mockReconcileBroadcast = vi.fn();
let authMode: "wallet" | "passkey" = "wallet";
const mockOwnership = vi.fn();
const mockSender = () => ({
  authMode,
  sendContractCall: mockSendTransaction,
  signTypedData: vi.fn(),
  assertOwnership: mockOwnership,
  reconcileBroadcast: mockReconcileBroadcast,
});
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => TEST_SIGNER }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockSender(),
}));

vi.mock("../../../modules/marketplace/signing", () => ({
  buildMakerAsk: (...args: unknown[]) => mockBuildMakerAsk(...args),
  signMakerAsk: (...args: unknown[]) => mockSignMakerAsk(...args),
  validateOrder: (...args: unknown[]) => mockValidateOrder(...args),
}));

vi.mock("../../../modules/marketplace/client", () => ({
  getOrderNonces: (...args: unknown[]) => mockGetOrderNonces(...args),
}));

vi.mock("../../../utils/blockchain/hypercert-abis", () => ({
  HYPERCERTS_MODULE_ABI: [],
  MARKETPLACE_ADAPTER_ABI: [],
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  assertMarketplaceReady: (...args: unknown[]) => mockAssertMarketplaceReady(...args),
  getNetworkContracts: () => ({
    marketplaceAdapter: "0x4444444444444444444444444444444444444444",
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

// Mock viem's encodeFunctionData
vi.mock("viem", () => ({
  encodeFunctionData: vi.fn().mockReturnValue("0xencoded"),
}));

import { type ListingStep, useCreateListing } from "../../../hooks/hypercerts/useCreateListing";
import { toastService } from "../../../components/Toast/toast.service";

// ============================================
// Test Suite
// ============================================

describe.each(["wallet", "passkey"] as const)("useCreateListing with %s", (mode) => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    authMode = mode;
    mockReadContract.mockReset().mockResolvedValue(0n);
    mockReconcileBroadcast.mockReset().mockResolvedValue({ status: "unresolved" });
    queryClient = createTestQueryClient();
    mockAssertMarketplaceReady.mockReturnValue({
      available: true,
      status: "available",
      missingFields: [],
      addresses: {
        hypercertsModule: TEST_MODULE,
      },
    });
    mockGetOrderNonces.mockResolvedValue({ globalNonce: 0n, orderNonce: 1n });
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
    mockValidateOrder.mockReturnValue({ valid: true, errors: [] });
    mockSignMakerAsk.mockResolvedValue("0xsignature");
    mockSendTransaction.mockResolvedValue({ hash: "0xtxhash", sponsored: false });
  });

  describe("initial state", () => {
    it("starts with idle step and no error", () => {
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      expect(result.current.step).toBe("idle");
      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("provides createListing and reset functions", () => {
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      expect(typeof result.current.createListing).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("validation", () => {
    it("throws when garden address is missing", async () => {
      const { result } = renderHookWithQueryClient(() => useCreateListing(undefined), {
        queryClient,
      });

      await act(async () => {
        try {
          await result.current.createListing({
            hypercertId: 1n,
            fractionId: 1n,
            currency: "0x0000000000000000000000000000000000000000",
            pricePerUnit: 1000n,
            minUnitAmount: 1n,
            maxUnitAmount: 1000n,
            minUnitsToKeep: 0n,
            sellLeftover: false,
            durationDays: 30,
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.message).toBe("Garden address required");
    });

    it("refuses incomplete marketplace config before signing or writing", async () => {
      mockAssertMarketplaceReady.mockImplementation(() => {
        throw new Error("Marketplace configuration incomplete: hypercertExchange");
      });
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      await act(async () => {
        try {
          await result.current.createListing({
            hypercertId: 1n,
            fractionId: 1n,
            currency: "0x0000000000000000000000000000000000000000",
            pricePerUnit: 1000n,
            minUnitAmount: 1n,
            maxUnitAmount: 1000n,
            minUnitsToKeep: 0n,
            sellLeftover: false,
            durationDays: 30,
          });
        } catch {
          // Expected
        }
      });

      expect(result.current.error?.message).toContain("Marketplace configuration incomplete");
      expect(mockGetOrderNonces).not.toHaveBeenCalled();
      expect(mockBuildMakerAsk).not.toHaveBeenCalled();
      expect(mockSignMakerAsk).not.toHaveBeenCalled();
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("invalidation", () => {
    it("reports a confirmed revert and clears it when the flow resets", async () => {
      mockSendTransaction.mockResolvedValue({
        hash: "0xproposal",
        sponsored: false,
        confirmation: "pending",
      });
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });
      const params = {
        hypercertId: 1n,
        fractionId: 1n,
        currency: "0x0000000000000000000000000000000000000000" as const,
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        minUnitsToKeep: 0n,
        sellLeftover: false,
        durationDays: 30,
      };
      await act(() => result.current.createListing(params));
      mockReconcileBroadcast.mockResolvedValue({ status: "reverted" });
      await act(() => result.current.checkConfirmation());
      expect(result.current.step).toBe("error");
      expect(result.current.error?.message).toBe("Failed to create listing");
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      await act(() => result.current.reset());
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe("idle");
      await act(() => result.current.createListing(params));
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe("pending");
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it("keeps a pending submission out of error and prevents a retry", async () => {
      mockSendTransaction.mockResolvedValue({
        hash: "0xtxhash",
        sponsored: false,
        confirmation: "pending",
      });
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      const params = {
        hypercertId: 1n,
        fractionId: 1n,
        currency: "0x0000000000000000000000000000000000000000" as const,
        pricePerUnit: 1000n,
        minUnitAmount: 1n,
        maxUnitAmount: 1000n,
        minUnitsToKeep: 0n,
        sellLeftover: false,
        durationDays: 30,
      };
      await act(() => result.current.createListing(params));
      await waitFor(() => expect(result.current.step).toBe("pending"));
      expect(result.current.error).toBeNull();
      expect(toastService.info).toHaveBeenCalled();
      expect(toastService.error).not.toHaveBeenCalled();
      expect(mockInvalidateQueries).toHaveBeenCalled();
      await act(async () => {
        result.current.reset();
        await result.current.createListing(params);
        await result.current.checkConfirmation();
      });
      expect(result.current.step).toBe("pending");
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(mockSignMakerAsk).toHaveBeenCalledTimes(1);
      mockReadContract
        .mockResolvedValueOnce(1n)
        .mockResolvedValueOnce([1n, "0x", "0xother-signature"]);
      await act(() => result.current.checkConfirmation());
      expect(result.current.step).toBe("pending");
      mockReadContract.mockResolvedValueOnce(1n).mockResolvedValueOnce([1n, "0x", "0xsignature"]);
      await act(() => result.current.checkConfirmation());
      expect(result.current.step).toBe("done");
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it("keeps marketplace listing invalidation after a successful listing", async () => {
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      await act(async () => {
        await result.current.createListing({
          hypercertId: 1n,
          fractionId: 1n,
          currency: "0x0000000000000000000000000000000000000000",
          pricePerUnit: 1000n,
          minUnitAmount: 1n,
          maxUnitAmount: 1000n,
          minUnitsToKeep: 0n,
          sellLeftover: false,
          durationDays: 30,
        });
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
      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ["greengoods", "marketplace", "orders"],
        });
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ["greengoods", "marketplace"],
        });
      });
    });
  });

  describe("step types", () => {
    it("has valid step union type values", () => {
      const validSteps: ListingStep[] = [
        "idle",
        "building",
        "signing",
        "registering",
        "confirming",
        "done",
        "error",
      ];

      // Each step value should be a string
      validSteps.forEach((step) => {
        expect(typeof step).toBe("string");
      });
    });
  });

  describe("reset", () => {
    it("resets step to idle", () => {
      const { result } = renderHookWithQueryClient(() => useCreateListing(TEST_GARDEN), {
        queryClient,
      });

      act(() => result.current.reset());

      expect(result.current.step).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });
});
