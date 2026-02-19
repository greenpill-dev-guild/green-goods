/**
 * useVaultDeposits Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";
const TEST_USER = "0x1111111111111111111111111111111111111111";

const mockGetVaultDeposits = vi.fn();

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../modules/data/vaults", () => ({
  getVaultDeposits: (...args: unknown[]) => mockGetVaultDeposits(...args),
}));

import { useVaultDeposits } from "../../../hooks/vault/useVaultDeposits";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useVaultDeposits", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches all deposits for a garden", async () => {
    const mockDeposits = [
      {
        id: "deposit-1",
        chainId: TEST_CHAIN_ID,
        garden: TEST_GARDEN.toLowerCase(),
        asset: "0x3333333333333333333333333333333333333333",
        vaultAddress: "0x4444444444444444444444444444444444444444",
        depositor: TEST_USER.toLowerCase(),
        shares: 1000n,
        totalDeposited: 1000n,
        totalWithdrawn: 0n,
      },
    ];
    mockGetVaultDeposits.mockResolvedValue(mockDeposits);

    const { result } = renderHook(() => useVaultDeposits(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultDeposits).toHaveBeenCalledWith(
      TEST_GARDEN.toLowerCase(),
      TEST_CHAIN_ID,
      undefined
    );
    expect(result.current.deposits).toEqual(mockDeposits);
  });

  it("fetches deposits filtered by user address", async () => {
    const mockDeposits = [
      {
        id: "deposit-user-1",
        chainId: TEST_CHAIN_ID,
        garden: TEST_GARDEN.toLowerCase(),
        asset: "0x3333333333333333333333333333333333333333",
        vaultAddress: "0x4444444444444444444444444444444444444444",
        depositor: TEST_USER.toLowerCase(),
        shares: 500n,
        totalDeposited: 500n,
        totalWithdrawn: 0n,
      },
    ];
    mockGetVaultDeposits.mockResolvedValue(mockDeposits);

    const { result } = renderHook(() => useVaultDeposits(TEST_GARDEN, { userAddress: TEST_USER }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultDeposits).toHaveBeenCalledWith(
      TEST_GARDEN.toLowerCase(),
      TEST_CHAIN_ID,
      TEST_USER.toLowerCase()
    );
    expect(result.current.deposits).toEqual(mockDeposits);
  });

  it("returns empty array when no data yet", () => {
    mockGetVaultDeposits.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useVaultDeposits(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.deposits).toEqual([]);
  });

  it("disables query when no garden address is provided", () => {
    const { result } = renderHook(() => useVaultDeposits(undefined, { enabled: true }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetVaultDeposits).not.toHaveBeenCalled();
    expect(result.current.deposits).toEqual([]);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("disables query when enabled is false", () => {
    const { result } = renderHook(() => useVaultDeposits(TEST_GARDEN, { enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(mockGetVaultDeposits).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("normalizes both garden and user addresses to lowercase", async () => {
    mockGetVaultDeposits.mockResolvedValue([]);
    const mixedGarden = "0xABCDef1234567890ABCDef1234567890ABCDef12";
    const mixedUser = "0xFEDCba9876543210FEDCba9876543210FEDCba98";

    const { result } = renderHook(() => useVaultDeposits(mixedGarden, { userAddress: mixedUser }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultDeposits).toHaveBeenCalledWith(
      mixedGarden.toLowerCase(),
      TEST_CHAIN_ID,
      mixedUser.toLowerCase()
    );
  });

  it("respects custom chainId option", async () => {
    mockGetVaultDeposits.mockResolvedValue([]);

    const { result } = renderHook(() => useVaultDeposits(TEST_GARDEN, { chainId: 42161 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetVaultDeposits).toHaveBeenCalledWith(TEST_GARDEN.toLowerCase(), 42161, undefined);
  });
});
