/**
 * useOctantVaultHarvestableYield Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OctantVaultCampaignAssetManifest,
  OctantVaultYieldSource,
  OctantVaultYieldStrategy,
} from "../../../modules/vault-crowdfunding";
import type { Address } from "../../../types/domain";

const mockReadContract = vi.fn();

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract: (args: unknown) => mockReadContract(args) }),
}));

const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const STRATEGY = "0x1111111111111111111111111111111111111111" as Address;
const YEARN_SOURCE = "0x2222222222222222222222222222222222222222" as Address;
const WETH = "0x3333333333333333333333333333333333333333" as Address;
const YIELD_STRATEGY: OctantVaultYieldStrategy = { address: STRATEGY, chainId: 1 };
const YIELD_SOURCE: OctantVaultYieldSource = {
  address: YEARN_SOURCE,
  kind: "yearn-v3",
  chainId: 1,
};
const WETH_ASSET: OctantVaultCampaignAssetManifest = {
  address: WETH,
  symbol: "WETH",
  decimals: 18,
};

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
          asset: WETH_ASSET,
          yieldSource: YIELD_SOURCE,
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

  it("returns zero when live strategy assets do not exceed tracked assets", async () => {
    mockReadContract.mockImplementation((call: { address: Address; functionName: string }) => {
      if (call.address === STRATEGY && call.functionName === "totalAssets") {
        return Promise.resolve(3_000_000_000_000_000n);
      }
      if (call.address === YEARN_SOURCE && call.functionName === "balanceOf") {
        return Promise.resolve(2_000_000_000_000_000n);
      }
      if (call.address === YEARN_SOURCE && call.functionName === "convertToAssets") {
        return Promise.resolve(2_000_000_000_000_000n);
      }
      if (call.address === WETH && call.functionName === "balanceOf") {
        return Promise.resolve(1_000_000_000_000_000n);
      }
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () =>
        useOctantVaultHarvestableYield({
          vaultAddress: VAULT,
          chainId: 1,
          asset: WETH_ASSET,
          yieldSource: YIELD_SOURCE,
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

  it("returns positive harvestable WETH from live source assets minus tracked assets", async () => {
    mockReadContract.mockImplementation((call: { address: Address; functionName: string }) => {
      if (call.address === STRATEGY && call.functionName === "totalAssets") {
        return Promise.resolve(3_000_000_000_000_000n);
      }
      if (call.address === YEARN_SOURCE && call.functionName === "balanceOf") {
        return Promise.resolve(4_000_000_000_000_000n);
      }
      if (call.address === YEARN_SOURCE && call.functionName === "convertToAssets") {
        return Promise.resolve(4_000_000_000_000_000n);
      }
      if (call.address === WETH && call.functionName === "balanceOf") {
        return Promise.resolve(1_000_000_000_000_000n);
      }
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () =>
        useOctantVaultHarvestableYield({
          vaultAddress: VAULT,
          chainId: 1,
          asset: WETH_ASSET,
          yieldSource: YIELD_SOURCE,
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
