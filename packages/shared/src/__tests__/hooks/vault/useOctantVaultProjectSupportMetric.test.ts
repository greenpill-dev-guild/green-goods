/**
 * useOctantVaultProjectSupportMetric Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";

const mockReadContract = vi.fn();

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract: (args: unknown) => mockReadContract(args) }),
}));

const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const ROUTER = "0x950208836634cD439F01262e98D0FCF422F78452" as Address;

const { useOctantVaultProjectSupportMetric } = await import(
  "../../../hooks/vault/useOctantVaultProjectSupportMetric"
);

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("hooks/vault/useOctantVaultProjectSupportMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when the dragon router source is missing", async () => {
    mockReadContract.mockResolvedValueOnce("0x0000000000000000000000000000000000000000");

    const { result } = renderHook(
      () => useOctantVaultProjectSupportMetric({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      sourceAddress: null,
      assetValue: 0n,
      unavailableReason: "missing_source",
    });
  });

  it("returns zero when the router is proven but holds no donation shares", async () => {
    mockReadContract.mockImplementation((call: { functionName: string }) => {
      if (call.functionName === "dragonRouter") return Promise.resolve(ROUTER);
      if (call.functionName === "balanceOf") return Promise.resolve(0n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () => useOctantVaultProjectSupportMetric({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "zero",
      sourceAddress: ROUTER,
      shareBalance: 0n,
      assetValue: 0n,
    });
    expect(mockReadContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "convertToAssets" })
    );
  });

  it("returns positive aggregate support value from router shares converted to assets", async () => {
    mockReadContract.mockImplementation((call: { functionName: string }) => {
      if (call.functionName === "dragonRouter") return Promise.resolve(ROUTER);
      if (call.functionName === "balanceOf") return Promise.resolve(4_000_000_000_000_000n);
      if (call.functionName === "convertToAssets") return Promise.resolve(4_100_000_000_000_000n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () => useOctantVaultProjectSupportMetric({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "positive",
      sourceAddress: ROUTER,
      shareBalance: 4_000_000_000_000_000n,
      assetValue: 4_100_000_000_000_000n,
    });
    expect(mockReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "convertToAssets", args: [4_000_000_000_000_000n] })
    );
  });

  it("preserves the proven source and share balance when conversion is unavailable", async () => {
    mockReadContract.mockImplementation((call: { functionName: string }) => {
      if (call.functionName === "dragonRouter") return Promise.resolve(ROUTER);
      if (call.functionName === "balanceOf") return Promise.resolve(4_000_000_000_000_000n);
      if (call.functionName === "convertToAssets")
        return Promise.reject(new Error("conversion unavailable"));
      return Promise.resolve(0n);
    });

    const { result } = renderHook(
      () => useOctantVaultProjectSupportMetric({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      sourceAddress: ROUTER,
      shareBalance: 4_000_000_000_000_000n,
      assetValue: 0n,
      isError: false,
      unavailableReason: "read_error",
    });
  });
});
