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
const mockInvalidateQueries = vi.fn();
const mockSendTransaction = vi.fn();
const mockReconcile = vi.fn();
let authMode: "wallet" | "passkey" = "wallet";
let signer: typeof TEST_SIGNER | null = TEST_SIGNER;
const mockOwnership = vi.fn();
const mockSender = () => ({
  authMode,
  sendContractCall: mockSendTransaction,
  signTypedData: vi.fn(),
  assertOwnership: mockOwnership,
  reconcileBroadcast: mockReconcile,
});
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => signer }));
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
    signer = TEST_SIGNER;
    mockOwnership.mockReset();
    queryClient = createTestQueryClient();
    mockAssertMarketplaceReady.mockReturnValue({
      available: true,
      status: "available",
      missingFields: [],
      addresses: {
        hypercertsModule: TEST_MODULE,
      },
    });
    mockSendTransaction.mockResolvedValue({ hash: "0xtxhash", sponsored: false });
    mockWaitForTransactionReceipt.mockResolvedValue({});
  });

  it.each([
    "unresolved",
    "confirmed",
    "reverted",
  ] as const)("preserves an accepted cancellation across reload and reconciles %s", async (status) => {
    const operation = `0x${"cd".repeat(32)}` as const;
    mockSendTransaction.mockImplementationOnce(async (_call, options) => {
      await options.onBroadcastReference({
        kind: "user-operation",
        hash: operation,
        chainId: TEST_CHAIN_ID,
      });
      expect(sessionStorage.getItem("green-goods:listing-submissions")).toContain(operation);
      throw new Error("Receipt RPC timeout");
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

  it("requires wallet cancellation and ownership before freeing a pending delist", async () => {
    mockSendTransaction.mockResolvedValueOnce({
      hash: "0xProposal",
      sponsored: false,
      confirmation: "pending",
    });
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });
    await act(() => result.current.cancelListing(42));
    await expect(result.current.confirmWalletCancellation(false)).rejects.toThrow(
      "confirmation-required"
    );
    expect(result.current.pendingCancellation?.orderId).toBe(42);
    mockOwnership.mockRejectedValueOnce(new Error("Wrong owner"));
    await expect(result.current.confirmWalletCancellation(true)).rejects.toThrow("Wrong owner");
    expect(result.current.pendingCancellation?.orderId).toBe(42);
    await act(() => result.current.confirmWalletCancellation(true));
    expect(result.current.pendingCancellation).toBeUndefined();
    expect(mockSendTransaction).toHaveBeenCalledOnce();
    await act(() => result.current.cancelListing(43));
    expect(mockSendTransaction).toHaveBeenCalledTimes(2);
  });

  it("retains the old owner's checkpoint if ownership resolves after switching accounts", async () => {
    mockSendTransaction.mockResolvedValueOnce({
      hash: "0xProposal",
      sponsored: false,
      confirmation: "pending",
    });
    const view = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), { queryClient });
    await act(() => view.result.current.cancelListing(42));
    let finish!: () => void;
    mockOwnership.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const clearing = view.result.current.confirmWalletCancellation(true);
    signer = "0x4444444444444444444444444444444444444444";
    view.rerender();
    finish();
    await expect(clearing).rejects.toThrow("pending-submission-changed");
    expect(Object.values(useListingSubmissionStore.getState().cancellations)).toHaveLength(1);
    expect(mockSendTransaction).toHaveBeenCalledOnce();
  });

  it("starts with idle state and no error", () => {
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });

    expect(result.current.isCancelling).toBe(false);
    expect(result.current.error).toBeNull();
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

  it("rejects a missing signer before ownership, readiness or sending", async () => {
    signer = null;
    const { result } = renderHookWithQueryClient(() => useCancelListing(TEST_GARDEN), {
      queryClient,
    });
    await act(async () => {
      await expect(result.current.cancelListing(42)).rejects.toThrow("Sign in");
    });
    expect(mockOwnership).not.toHaveBeenCalled();
    expect(mockAssertMarketplaceReady).not.toHaveBeenCalled();
    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it("refuses incomplete marketplace config after ownership and before sending", async () => {
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
    expect(mockOwnership).toHaveBeenCalledWith(TEST_SIGNER, TEST_CHAIN_ID);
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
