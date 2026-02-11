/**
 * useGardenVaults Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";

const mockGetGardenVaults = vi.fn();
const mockGetAllGardenVaults = vi.fn();

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../modules/data/vaults", () => ({
  getGardenVaults: (...args: unknown[]) => mockGetGardenVaults(...args),
  getAllGardenVaults: (...args: unknown[]) => mockGetAllGardenVaults(...args),
}));

import { useGardenVaults } from "../../../hooks/vault/useGardenVaults";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useGardenVaults", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches vaults for a specific garden address", async () => {
    const mockVaults = [
      {
        id: "vault-1",
        chainId: TEST_CHAIN_ID,
        garden: TEST_GARDEN.toLowerCase(),
        asset: "0x1111111111111111111111111111111111111111",
        vaultAddress: "0x3333333333333333333333333333333333333333",
        totalDeposited: 1000n,
        totalWithdrawn: 0n,
        totalHarvestCount: 2,
        donationAddress: null,
        depositorCount: 5,
        paused: false,
        createdAt: 1000000,
      },
    ];
    mockGetGardenVaults.mockResolvedValue(mockVaults);

    const { result } = renderHook(() => useGardenVaults(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenVaults).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), TEST_CHAIN_ID);
    expect(mockGetAllGardenVaults).not.toHaveBeenCalled();
    expect(result.current.vaults).toEqual(mockVaults);
  });

  it("fetches all vaults when no garden address is provided", async () => {
    const mockVaults = [
      {
        id: "vault-all-1",
        chainId: TEST_CHAIN_ID,
        garden: "0xaaaa",
        asset: "0xbbbb",
        vaultAddress: "0xcccc",
        totalDeposited: 500n,
        totalWithdrawn: 100n,
        totalHarvestCount: 1,
        donationAddress: null,
        depositorCount: 3,
        paused: false,
        createdAt: 2000000,
      },
    ];
    mockGetAllGardenVaults.mockResolvedValue(mockVaults);

    const { result } = renderHook(() => useGardenVaults(undefined, { enabled: true }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetAllGardenVaults).toHaveBeenCalledWith(TEST_CHAIN_ID);
    expect(mockGetGardenVaults).not.toHaveBeenCalled();
    expect(result.current.vaults).toEqual(mockVaults);
  });

  it("returns empty array when query has no data yet", () => {
    mockGetGardenVaults.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useGardenVaults(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.vaults).toEqual([]);
  });

  it("disables query when enabled is false", () => {
    const { result } = renderHook(
      () => useGardenVaults(TEST_GARDEN, { enabled: false }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(mockGetGardenVaults).not.toHaveBeenCalled();
    expect(result.current.vaults).toEqual([]);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("normalizes garden address to lowercase for query key consistency", async () => {
    mockGetGardenVaults.mockResolvedValue([]);

    const mixedCaseAddress = "0xABCDef1234567890ABCDef1234567890ABCDef12";

    const { result } = renderHook(() => useGardenVaults(mixedCaseAddress), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenVaults).toHaveBeenCalledWith(
      mixedCaseAddress.toLowerCase(),
      TEST_CHAIN_ID
    );
  });

  it("respects custom chainId option", async () => {
    mockGetGardenVaults.mockResolvedValue([]);

    const { result } = renderHook(
      () => useGardenVaults(TEST_GARDEN, { chainId: 42161 }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGardenVaults).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), 42161);
  });
});
