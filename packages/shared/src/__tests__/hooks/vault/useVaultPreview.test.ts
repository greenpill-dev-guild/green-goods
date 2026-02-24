/**
 * useVaultPreview Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_VAULT = "0x4444444444444444444444444444444444444444";
const TEST_USER = "0x1111111111111111111111111111111111111111";

const mockUseReadContracts = vi.fn();

vi.mock("wagmi", () => ({
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
}));

vi.mock("../../../utils/blockchain/abis", () => ({
  OCTANT_VAULT_ABI: [{ type: "function", name: "previewDeposit" }],
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
}));

import { useVaultPreview } from "../../../hooks/vault/useVaultPreview";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useVaultPreview", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("returns undefined preview when no data available", () => {
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 1000n,
          userAddress: TEST_USER as `0x${string}`,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.preview).toBeUndefined();
  });

  it("maps successful multicall results to VaultPreview", () => {
    mockUseReadContracts.mockReturnValue({
      data: [
        { status: "success", result: 950n },
        { status: "success", result: 1050n },
        { status: "success", result: 1000000n },
        { status: "success", result: 500n },
        { status: "success", result: 25000n },
      ],
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 1000n,
          shares: 950n,
          userAddress: TEST_USER as `0x${string}`,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.preview).toEqual({
      previewShares: 950n,
      previewAssets: 1050n,
      maxDeposit: 1000000n,
      shareBalance: 500n,
      totalAssets: 25000n,
    });
  });

  it("defaults failed calls to 0n", () => {
    mockUseReadContracts.mockReturnValue({
      data: [
        { status: "failure", error: new Error("reverted") },
        { status: "success", result: 100n },
        { status: "failure", error: new Error("reverted") },
        { status: "success", result: 200n },
        { status: "failure", error: new Error("reverted") },
      ],
      isLoading: false,
    });

    const { result } = renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 1000n,
          userAddress: TEST_USER as `0x${string}`,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.preview).toEqual({
      previewShares: 0n,
      previewAssets: 100n,
      maxDeposit: 0n,
      shareBalance: 200n,
      totalAssets: 0n,
    });
  });

  it("builds empty contracts array when vaultAddress is undefined", () => {
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(
      () =>
        useVaultPreview({
          vaultAddress: undefined,
          amount: 1000n,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.preview).toBeUndefined();

    // Verify that useReadContracts was called with empty contracts and disabled
    const call = mockUseReadContracts.mock.calls[0][0];
    expect(call.contracts).toHaveLength(0);
    expect(call.query.enabled).toBe(false);
  });

  it("disables query when enabled=false", () => {
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
          amount: 1000n,
          enabled: false,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    const call = mockUseReadContracts.mock.calls[0][0];
    expect(call.query.enabled).toBe(false);
  });

  it("uses ZERO_ADDRESS as default userAddress", () => {
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    const call = mockUseReadContracts.mock.calls[0][0];
    // maxDeposit and balanceOf should use ZERO_ADDRESS
    const maxDepositContract = call.contracts[2];
    const balanceOfContract = call.contracts[3];
    expect(maxDepositContract.args[0]).toBe("0x0000000000000000000000000000000000000000");
    expect(balanceOfContract.args[0]).toBe("0x0000000000000000000000000000000000000000");
  });

  it("defaults amount and shares to 0n when not provided", () => {
    mockUseReadContracts.mockReturnValue({ data: undefined, isLoading: false });

    renderHook(
      () =>
        useVaultPreview({
          vaultAddress: TEST_VAULT as `0x${string}`,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    const call = mockUseReadContracts.mock.calls[0][0];
    // previewDeposit uses amount
    expect(call.contracts[0].args[0]).toBe(0n);
    // convertToAssets uses shares
    expect(call.contracts[1].args[0]).toBe(0n);
  });
});
