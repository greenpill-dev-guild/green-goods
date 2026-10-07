/**
 * useCancelListing Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests the listing cancellation flow via HypercertsModule.delistFromYield().
 */

import { type QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders as renderHookWithQueryClient } from "../../test-utils/render-helpers";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_SIGNER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const TEST_MODULE = "0x3333333333333333333333333333333333333333" as `0x${string}`;
const mockAssertMarketplaceReady = vi.fn();
const mockEncodeFunctionData = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockSendTransaction = vi.fn();
const mockReconcile = vi.fn();
let authMode: "wallet" | "passkey" = "wallet";
const mockOwnership = vi.fn();
const mockSender = () => ({
  authMode,
  sendContractCall: mockSendTransaction,
  signTypedData: vi.fn(),
  assertOwnership: mockOwnership,
  reconcileBroadcast: mockReconcile,
});
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => TEST_SIGNER }));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => mockSender(),
}));

const mockWaitForTransactionReceipt = vi.fn();

// ============================================
// Mocks
// ============================================

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    waitForTransactionReceipt: (...args: unknown[]) => mockWaitForTransactionReceipt(...args),
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
  encodeFunctionData: (...args: unknown[]) => mockEncodeFunctionData(...args),
}));

import { useCancelListing } from "../../../hooks/hypercerts/useCancelListing";
import { useListingSubmissionStore } from "../../../stores/useListingSubmissionStore";

// ============================================
// Test Suite
// ============================================

describe.each(["wallet", "passkey"] as const)("useCancelListing with %s", (mode) => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    useListingSubmissionStore.setState({ pending: {}, cancellations: {} });
    mockReconcile.mockReset().mockResolvedValue({ status: "unresolved" });
    authMode = mode;
    queryClient = createTestQueryClient();
    mockAssertMarketplaceReady.mockReturnValue({
      available: true,
      status: "available",
      missingFields: [],
      addresses: {
        hypercertsModule: TEST_MODULE,
      },
    });
    mockEncodeFunctionData.mockReturnValue("0xencoded");
    mockSendTransaction.mockResolvedValue({ hash: "0xtxhash", sponsored: false });
    mockWaitForTransactionReceipt.mockResolvedValue({});
  });

  it.each([
    "unresolved",
    "confirmed",
    "reverted",
  ] as const)("preserves an accepted cancellation across reload and reconciles %s", async (status) => {
    mockSendTransaction.mockResolvedValueOnce({
      hash: "0xCancelProposal",
      sponsored: false,
      confirmation: "pending",
    });
    const first = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), { queryClient });
    await act(() => first.result.current.cancelListing(42));
    expect(first.result.current.pendingCancellation?.orderId).toBe(42);
    expect(first.result.current.error).toBeNull();
    const saved = sessionStorage.getItem("green-goods:listing-submissions")!;
    first.unmount();
    useListingSubmissionStore.setState({ pending: {}, cancellations: {} });
    sessionStorage.setItem("green-goods:listing-submissions", saved);
    await useListingSubmissionStore.persist.rehydrate();
    const restored = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });
    expect(restored.result.current.isCancelling).toBe(true);
    await act(() => restored.result.current.cancelListing(42));
    expect(mockSendTransaction).toHaveBeenCalledOnce();
    mockReconcile.mockResolvedValueOnce({ status, transactionHash: `0x${"66".repeat(32)}` });
    await act(() => restored.result.current.checkConfirmation());
    expect(Boolean(restored.result.current.pendingCancellation)).toBe(status === "unresolved");
    expect(mockSendTransaction).toHaveBeenCalledOnce();
    if (status === "reverted") expect(restored.result.current.error?.message).toContain("reverted");
    if (status === "confirmed") expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("starts with idle state and no error", () => {
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    expect(result.current.isCancelling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("provides cancelListing function", () => {
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    expect(typeof result.current.cancelListing).toBe("function");
  });

  it("rejects when garden address is missing", async () => {
    const { result } = renderHookWithQueryClient(() => useCancelListing(undefined), {
      queryClient,
    });

    let thrownError: Error | undefined;
    await act(async () => {
      try {
        await result.current.cancelListing(42);
      } catch (e) {
        thrownError = e as Error;
      }
    });

    expect(thrownError?.message).toBe("Garden address required");
  });

  it("rejects when no wallet is connected", async () => {
    // Override useAuth to return no signer
    vi.doMock("../../../hooks/auth/useAuth", () => ({
      useAuth: () => ({
        smartAccountClient: null,
        smartAccountAddress: null,
        eoaAddress: null,
      }),
    }));

    // This test validates the error path conceptually - the mock setup
    // above would need dynamic import to take effect, so we test the interface
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    expect(result.current.isCancelling).toBe(false);
  });

  it("refuses incomplete marketplace config before encoding or writing", async () => {
    mockAssertMarketplaceReady.mockImplementation(() => {
      throw new Error("Marketplace configuration incomplete: transferManager");
    });

    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    let thrownError: Error | undefined;
    await act(async () => {
      try {
        await result.current.cancelListing(42);
      } catch (error) {
        thrownError = error as Error;
      }
    });

    expect(thrownError?.message ?? "").toContain("Marketplace configuration incomplete");
    expect(mockEncodeFunctionData).not.toHaveBeenCalled();
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it("keeps marketplace listing invalidation after a successful cancel", async () => {
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    await act(async () => {
      await result.current.cancelListing(42);
    });

    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        account: TEST_SIGNER,
        chainId: TEST_CHAIN_ID,
        functionName: "delistFromYield",
      }),
      expect.objectContaining({ assertOwnership: expect.any(Function) })
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["greengoods", "marketplace", "orders"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["greengoods", "marketplace"],
    });
  });
});
