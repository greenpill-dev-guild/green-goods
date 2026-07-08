/**
 * useOctantVaultStrategyApy Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OctantVaultYieldSource } from "../../../modules/vault-crowdfunding";
import type { Address } from "../../../types/domain";

const mockReadContract = vi.fn();
const mockFetch = vi.fn();

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({ readContract: (args: unknown) => mockReadContract(args) }),
}));

const VAULT = "0xaC8F844CEA2Fd75B7A5514f11974895B334fd9A5" as Address;
const SOURCE = "0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0" as Address;
const YEARN_SOURCE: OctantVaultYieldSource = { address: SOURCE, kind: "yearn-v3", chainId: 1 };
const LIDO_SOURCE: OctantVaultYieldSource = { address: SOURCE, kind: "lido", chainId: 1 };

const { useOctantVaultStrategyApy } = await import(
  "../../../hooks/vault/useOctantVaultStrategyApy"
);

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("hooks/vault/useOctantVaultStrategyApy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns unavailable when vault/chain are missing", () => {
    const { result } = renderHook(() => useOctantVaultStrategyApy({}), { wrapper: wrapper() });
    expect(result.current).toMatchObject({
      status: "unavailable",
      apy: null,
      unavailableReason: "missing_vault",
    });
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when no yield source is recorded", async () => {
    const { result } = renderHook(
      () => useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1 }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      apy: null,
      unavailableReason: "missing_source",
    });
    expect(mockReadContract).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when the vault is shut down", async () => {
    mockReadContract.mockResolvedValueOnce(true);

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: YEARN_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      unavailableReason: "shutdown",
      sourceAddress: SOURCE,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when no adapter matches the source kind", async () => {
    mockReadContract.mockResolvedValue(false);

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: LIDO_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      unavailableReason: "unsupported_source",
      sourceKind: "lido",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns a positive APY from the yearn-v3 source rate", async () => {
    mockReadContract.mockResolvedValue(false);
    mockFetch.mockResolvedValue(okJson({ apr: { netAPR: 0.0143 } }));

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: YEARN_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("positive");
    expect(result.current.sourceAddress).toBe(SOURCE);
    expect(result.current.sourceKind).toBe("yearn-v3");
    expect(result.current.apy).toBeCloseTo(1.43, 2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/1/vaults/${SOURCE}`),
      expect.anything()
    );
  });

  it("returns zero when the source reports no yield", async () => {
    mockReadContract.mockResolvedValue(false);
    mockFetch.mockResolvedValue(okJson({ apr: { netAPR: 0 } }));

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: YEARN_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ status: "zero", apy: 0 });
  });

  it("returns read_error (unavailable, not isError) when the source rate cannot be read", async () => {
    mockReadContract.mockResolvedValue(false);
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: YEARN_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({
      status: "unavailable",
      unavailableReason: "read_error",
      isError: false,
    });
  });

  it("still reads the source rate when the shutdown gate read fails (best-effort gate)", async () => {
    mockReadContract.mockRejectedValueOnce(new Error("rpc down"));
    mockFetch.mockResolvedValue(okJson({ apr: { netAPR: 0.02 } }));

    const { result } = renderHook(
      () =>
        useOctantVaultStrategyApy({ vaultAddress: VAULT, chainId: 1, yieldSource: YEARN_SOURCE }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe("positive");
    expect(result.current.apy).toBeCloseTo(2, 2);
  });
});
