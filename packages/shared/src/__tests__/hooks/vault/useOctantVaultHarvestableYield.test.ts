/**
 * useOctantVaultHarvestableYield Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OctantVaultYieldStrategy } from "../../../modules/vault-crowdfunding";
import type { Address } from "../../../types/domain";

const mockReadContract = vi.fn();

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract: (args: unknown) => mockReadContract(args) }),
}));

const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const STRATEGY = "0x1111111111111111111111111111111111111111" as Address;
const YIELD_STRATEGY: OctantVaultYieldStrategy = { address: STRATEGY, chainId: 1 };

const { useOctantVaultHarvestableYield } = await import(
  "../../../hooks/vault/useOctantVaultHarvestableYield"
);

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("hooks/vault/useOctantVaultHarvestableYield", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when no verified yield strategy is recorded", async () => {
    const { result } = renderHook(
      () => useOctantVaultHarvestableYield({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      strategyAddress: null,
      harvestableAssets: 0n,
      unavailableReason: "missing_strategy",
    });
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("returns unavailable when either read fails", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("strategy read unavailable"));

    const { result } = renderHook(
      () =>
        useOctantVaultHarvestableYield({
          vaultAddress: VAULT,
          chainId: 1,
          yieldStrategy: YIELD_STRATEGY,
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      strategyAddress: STRATEGY,
      harvestableAssets: 0n,
      unavailableReason: "read_error",
    });
  });

  it("returns zero when strategy assets do not exceed vault debt", async () => {
    mockReadContract.mockImplementation((call: { address: Address; functionName: string }) => {
      if (call.address === STRATEGY && call.functionName === "totalAssets") {
        return Promise.resolve(3_000_000_000_000_000n);
      }
      if (call.address === VAULT && call.functionName === "totalDebt") {
        return Promise.resolve(3_000_000_000_000_000n);
      }
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () =>
        useOctantVaultHarvestableYield({
          vaultAddress: VAULT,
          chainId: 1,
          yieldStrategy: YIELD_STRATEGY,
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "zero",
      strategyAddress: STRATEGY,
      strategyAssets: 3_000_000_000_000_000n,
      vaultDebt: 3_000_000_000_000_000n,
      harvestableAssets: 0n,
    });
  });

  it("returns positive harvestable WETH from strategy assets minus vault debt", async () => {
    mockReadContract.mockImplementation((call: { address: Address; functionName: string }) => {
      if (call.address === STRATEGY && call.functionName === "totalAssets") {
        return Promise.resolve(5_000_000_000_000_000n);
      }
      if (call.address === VAULT && call.functionName === "totalDebt") {
        return Promise.resolve(3_000_000_000_000_000n);
      }
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () =>
        useOctantVaultHarvestableYield({
          vaultAddress: VAULT,
          chainId: 1,
          yieldStrategy: YIELD_STRATEGY,
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "positive",
      strategyAddress: STRATEGY,
      strategyAssets: 5_000_000_000_000_000n,
      vaultDebt: 3_000_000_000_000_000n,
      harvestableAssets: 2_000_000_000_000_000n,
    });
  });
});
