/**
 * useStrategyRate Hook Tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_ASSET = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const mockUseReadContract = vi.fn();

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

import { useStrategyRate } from "../../../hooks/vault/useStrategyRate";

describe("useStrategyRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  it("marks chains without an Aave pool as unsupported", () => {
    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42220 })
    );

    expect(result.current.unsupported).toBe(true);
  });

  it("passes the provided chainId into the contract read", () => {
    renderHook(() => useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 }));

    const call = mockUseReadContract.mock.calls[0][0];
    expect(call.chainId).toBe(42161);
  });

  it("converts the Aave liquidity rate into APY", () => {
    mockUseReadContract.mockReturnValue({
      data: {
        currentLiquidityRate: 20000000000000000000000000n,
      },
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.apy).toBeGreaterThan(2);
    expect(result.current.apy).toBeLessThan(2.1);
  });
});
