/**
 * useSendableTokens Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokensKeys } from "../../../config/query-keys/tokens";
import type { Address } from "../../../types/domain";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const MODULE = "0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183";
const GOODS = "0x6Fc6bF735d2884dec59B0E9c8a00A9740C305c9e";

const mockReadContract = vi.fn();

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({ gardensModule: MODULE }),
}));
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    readContract: (...args: unknown[]) => mockReadContract(...args),
  }),
}));

const { useSendableTokens } = await import("../../../hooks/blockchain/useSendableTokens");

function makeWrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("hooks/blockchain/useSendableTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadContract.mockImplementation((params: { functionName: string; address: string }) => {
      if (params.functionName === "goodsToken") return Promise.resolve(GOODS);
      if (params.functionName === "balanceOf") {
        // One token reverts — must not nuke the rest (allSettled isolation).
        if (params.address.toLowerCase() === "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1") {
          return Promise.reject(new Error("revert"));
        }
        return Promise.resolve(100n);
      }
      return Promise.resolve(0n);
    });
  });

  it("skips GOODS discovery and isolates a reverting ordinary token balance", async () => {
    const { result } = renderHook(() => useSendableTokens(ACCOUNT, 42161), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const tokens = result.current.tokens;
    expect(tokens.some((t) => t.confersGovernance)).toBe(false);
    expect(
      mockReadContract.mock.calls.every(([params]) => params.functionName !== "goodsToken")
    ).toBe(true);

    const dai = tokens.find((t) => t.symbol === "DAI");
    expect(dai?.errored).toBe(true);
    expect(dai?.balance).toBeNull();

    const usdc = tokens.find((t) => t.symbol === "USDC");
    expect(usdc?.supported).toBe(true);
    expect(usdc?.balance).toBe(100n);
    expect(usdc?.errored).toBe(false);
  });

  it("omits GoodDollar on Arbitrum — unsupported tokens are not offered", async () => {
    const { result } = renderHook(() => useSendableTokens(ACCOUNT, 42161), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tokens.some((t) => t.symbol === "G$")).toBe(false);
    // Every token offered is supported/sendable on this chain.
    expect(result.current.tokens.every((t) => t.supported)).toBe(true);
  });

  it("is disabled without an account and reads nothing", () => {
    const { result } = renderHook(() => useSendableTokens(null, 42161), {
      wrapper: makeWrapper(),
    });
    expect(result.current.tokens).toEqual([]);
    expect(mockReadContract).not.toHaveBeenCalled();
  });
});

it("filters GOODS from a fresh persisted cache without clearing other balances", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const stable = {
    symbol: "USDC",
    label: "USD Coin",
    address: ACCOUNT,
    decimals: 6,
    supported: true,
    confersGovernance: false,
    balance: 100n,
    errored: false,
  };
  client.setQueryData(tokensKeys.balances(ACCOUNT.toLowerCase(), 42161), [
    { ...stable, symbol: "GOODS", address: GOODS, confersGovernance: true },
    stable,
  ]);
  const { result } = renderHook(() => useSendableTokens(ACCOUNT, 42161), {
    wrapper: makeWrapper(client),
  });
  expect(result.current.tokens).toEqual([stable]);
});
