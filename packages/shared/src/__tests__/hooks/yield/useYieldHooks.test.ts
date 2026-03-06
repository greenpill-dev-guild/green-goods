/**
 * Yield Hook Tests
 * @vitest-environment jsdom
 *
 * Tests useAllocateYield mutation and useYieldAllocations query hooks.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333";
const TEST_ASSET = "0x4444444444444444444444444444444444444444";
const TEST_VAULT = "0x2222222222222222222222222222222222222222";
const TEST_YIELD_SPLITTER = "0x5555555555555555555555555555555555555555";
const MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

// --- Mocks ---

const mockWriteContractAsync = vi.fn();
const mockCreateMutationErrorHandler = vi.fn();
const mockErrorHandler = vi.fn();

const toastService = {
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
};

const mockUser = {
  authMode: "wallet" as string,
  smartAccountClient: null as unknown,
  primaryAddress: TEST_GARDEN,
};

vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
  }),
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../config/appkit", () => ({
  wagmiConfig: {},
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => mockUser,
}));

vi.mock("../../../components/toast", () => ({
  toastService,
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: (...args: unknown[]) => {
    mockCreateMutationErrorHandler(...args);
    return mockErrorHandler;
  },
}));

vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender:
    () => (request: { address: string; abi: unknown; functionName: string; args: unknown[] }) => {
      return mockWriteContractAsync({
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
      });
    },
}));

vi.mock("../../../utils/blockchain/address", () => ({
  normalizeAddress: (addr: string) => addr.toLowerCase(),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    yieldSplitter: TEST_YIELD_SPLITTER,
  }),
}));

// Mock the indexer client for useYieldAllocations
const mockQuery = vi.fn();
vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const messages: Record<string, string> = {
  "app.yield.allocating": "Allocating yield...",
  "app.yield.allocateSuccess": "Yield allocated successfully",
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages }, children)
    );
  };
}

// Dynamic imports after mocks
const { useAllocateYield } = await import("../../../hooks/yield/useAllocateYield");
const { useYieldAllocations } = await import("../../../hooks/yield/useYieldAllocations");

import type { Address } from "../../../types/domain";

describe("useAllocateYield", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("sends splitYield tx to YieldSplitter", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useAllocateYield(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        assetAddress: TEST_ASSET as Address,
        vaultAddress: TEST_VAULT as Address,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_YIELD_SPLITTER,
        functionName: "splitYield",
        args: [TEST_GARDEN, TEST_ASSET, TEST_VAULT],
      })
    );
  });

  it("shows toast lifecycle on success", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);

    const { result } = renderHook(() => useAllocateYield(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        assetAddress: TEST_ASSET as Address,
        vaultAddress: TEST_VAULT as Address,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastService.loading).toHaveBeenCalled();
    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(toastService.success).toHaveBeenCalled();
  });

  it("invalidates yield queries on success", async () => {
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAllocateYield(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        assetAddress: TEST_ASSET as Address,
        vaultAddress: TEST_VAULT as Address,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(["greengoods", "yield", "allocations"]),
      })
    );
  });

  it("calls error handler on tx failure", async () => {
    mockWriteContractAsync.mockRejectedValueOnce(new Error("user rejected"));

    const { result } = renderHook(() => useAllocateYield(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: TEST_GARDEN as Address,
        assetAddress: TEST_ASSET as Address,
        vaultAddress: TEST_VAULT as Address,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toastService.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        metadata: expect.objectContaining({
          gardenAddress: TEST_GARDEN,
          assetAddress: TEST_ASSET,
        }),
      })
    );
  });
});

describe("useYieldAllocations", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches and transforms yield allocations from indexer", async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        YieldAllocation: [
          {
            garden: TEST_GARDEN,
            asset: TEST_ASSET,
            cookieJarAmount: "1000000000000000000",
            fractionsAmount: "1000000000000000000",
            juiceboxAmount: "1000000000000000000",
            timestamp: 1700000000,
            txHash: "0xabc123",
          },
        ],
      },
    });

    const { result } = renderHook(() => useYieldAllocations(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for actual data (not placeholder) — placeholderData: [] makes isSuccess true immediately
    await waitFor(() => expect(result.current.allocations).toHaveLength(1));

    const alloc = result.current.allocations[0];
    expect(alloc.gardenAddress).toBe(TEST_GARDEN);
    expect(alloc.assetAddress).toBe(TEST_ASSET);
    expect(alloc.cookieJarAmount).toBe(1000000000000000000n);
    expect(alloc.fractionsAmount).toBe(1000000000000000000n);
    expect(alloc.juiceboxAmount).toBe(1000000000000000000n);
    expect(alloc.timestamp).toBe(1700000000);
    expect(alloc.txHash).toBe("0xabc123");
  });

  it("returns empty array when garden address is undefined", () => {
    const { result } = renderHook(() => useYieldAllocations(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.current.allocations).toEqual([]);
  });

  it("propagates indexer error to React Query error state", async () => {
    mockQuery.mockResolvedValueOnce({ error: new Error("Indexer down") });

    const { result } = renderHook(() => useYieldAllocations(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.allocations).toEqual([]);
  });

  it("respects enabled option", () => {
    renderHook(() => useYieldAllocations(TEST_GARDEN as Address, { enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns empty array when indexer returns null data", async () => {
    mockQuery.mockResolvedValueOnce({ data: null });

    const { result } = renderHook(() => useYieldAllocations(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.allocations).toEqual([]);
  });

  it("returns empty array when YieldAllocation list is empty", async () => {
    mockQuery.mockResolvedValueOnce({
      data: { YieldAllocation: [] },
    });

    const { result } = renderHook(() => useYieldAllocations(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.allocations).toEqual([]);
  });

  it("transforms multiple allocation records correctly", async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        YieldAllocation: [
          {
            garden: TEST_GARDEN,
            asset: TEST_ASSET,
            cookieJarAmount: "2000000000000000000",
            fractionsAmount: "3000000000000000000",
            juiceboxAmount: "4000000000000000000",
            timestamp: 1700000100,
            txHash: "0xdef456",
          },
          {
            garden: TEST_GARDEN,
            asset: "0x1111111111111111111111111111111111111111",
            cookieJarAmount: "500000000000000000",
            fractionsAmount: "500000000000000000",
            juiceboxAmount: "500000000000000000",
            timestamp: 1700000000,
            txHash: "0xabc789",
          },
        ],
      },
    });

    const { result } = renderHook(() => useYieldAllocations(TEST_GARDEN as Address), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for actual data (not placeholder) — placeholderData: [] makes isSuccess true immediately
    await waitFor(() => expect(result.current.allocations).toHaveLength(2));

    expect(result.current.allocations[0].cookieJarAmount).toBe(2000000000000000000n);
    expect(result.current.allocations[1].assetAddress).toBe(
      "0x1111111111111111111111111111111111111111"
    );
    expect(result.current.allocations[1].timestamp).toBe(1700000000);
  });

  it("passes custom limit to the query", async () => {
    mockQuery.mockResolvedValueOnce({
      data: { YieldAllocation: [] },
    });

    renderHook(() => useYieldAllocations(TEST_GARDEN as Address, { limit: 5 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockQuery).toHaveBeenCalled());

    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 5 }),
      "YieldAllocations"
    );
  });
});

describe("useAllocateYield — additional coverage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.authMode = "wallet";
    mockUser.smartAccountClient = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it("normalizes addresses in onSuccess for cache invalidation", async () => {
    const mixedCaseGarden = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
    const mixedCaseAsset = "0x9876543210aBcDeF9876543210aBcDeF98765432";
    mockWriteContractAsync.mockResolvedValueOnce(MOCK_TX_HASH);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAllocateYield(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({
        gardenAddress: mixedCaseGarden as Address,
        assetAddress: mixedCaseAsset as Address,
        vaultAddress: TEST_VAULT as Address,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Invalidation should use normalized (lowercase) addresses
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          "greengoods",
          "yield",
          "allocations",
          mixedCaseGarden.toLowerCase(),
        ]),
      })
    );
  });
});
