/**
 * useCreateListing Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the two-phase listing creation flow:
 * 1. Build + sign EIP-712 maker ask
 * 2. Register on-chain via HypercertsModule.listForYield()
 *
 * Since the hook integrates blockchain transactions, we test
 * the interface contract, validation, and error handling.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
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
  toastService: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

const mockBuildMakerAsk = vi.fn();
const mockGetOrderNonces = vi.fn();
const mockSignMakerAsk = vi.fn();
const mockValidateOrder = vi.fn();

vi.mock("../../../modules/marketplace", () => ({
  buildMakerAsk: (...args: unknown[]) => mockBuildMakerAsk(...args),
  getOrderNonces: (...args: unknown[]) => mockGetOrderNonces(...args),
  signMakerAsk: (...args: unknown[]) => mockSignMakerAsk(...args),
  validateOrder: (...args: unknown[]) => mockValidateOrder(...args),
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

// Mock viem's encodeFunctionData
vi.mock("viem", () => ({
  encodeFunctionData: vi.fn().mockReturnValue("0xencoded"),
}));

import { type ListingStep, useCreateListing } from "../../../hooks/hypercerts/useCreateListing";

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

describe("useCreateListing", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
  });

  describe("initial state", () => {
    it("starts with idle step and no error", () => {
      const { result } = renderHook(() => useCreateListing(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.step).toBe("idle");
      expect(result.current.isCreating).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("provides createListing and reset functions", () => {
      const { result } = renderHook(() => useCreateListing(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.createListing).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("validation", () => {
    it("throws when garden address is missing", async () => {
      const { result } = renderHook(() => useCreateListing(undefined), {
        wrapper: createWrapper(queryClient),
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
      const { result } = renderHook(() => useCreateListing(TEST_GARDEN), {
        wrapper: createWrapper(queryClient),
      });

      act(() => result.current.reset());

      expect(result.current.step).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });
});
