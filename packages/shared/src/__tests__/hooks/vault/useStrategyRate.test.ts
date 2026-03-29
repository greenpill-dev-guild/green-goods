/**
 * useStrategyRate Hook Tests
 * @vitest-environment jsdom
 *
 * Validates the Aave V3 APY fetching pipeline:
 * - Chain support detection (unsupported flag)
 * - chainId forwarding to useReadContract
 * - Ray-to-APY conversion math
 * - Error / no-data / NaN edge cases
 * - Loading state gating (disabled queries shouldn't report loading)
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

vi.mock("../../../modules/app/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useStrategyRate } from "../../../hooks/vault/useStrategyRate";

describe("useStrategyRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  // ── Chain support ──────────────────────────────────────────────

  it("marks chains without an Aave pool as unsupported", () => {
    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42220 })
    );

    expect(result.current.unsupported).toBe(true);
  });

  it("marks chains with an Aave pool as supported", () => {
    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.unsupported).toBe(false);
  });

  it("reports isLoading=false when chain is unsupported (query disabled)", () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: true, // wagmi may still say loading internally
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42220 })
    );

    // Hook should gate loading behind `enabled`, not expose raw wagmi state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // ── Contract call configuration ────────────────────────────────

  it("passes the provided chainId into the contract read", () => {
    renderHook(() => useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 }));

    const call = mockUseReadContract.mock.calls[0][0];
    expect(call.chainId).toBe(42161);
  });

  it("uses DEFAULT_CHAIN_ID when no chainId option is provided", () => {
    renderHook(() => useStrategyRate(TEST_ASSET as `0x${string}`));

    const call = mockUseReadContract.mock.calls[0][0];
    // DEFAULT_CHAIN_ID is mocked to 42161
    expect(call.chainId).toBe(42161);
  });

  it("disables the query when no asset address is provided", () => {
    renderHook(() => useStrategyRate(undefined, { chainId: 42161 }));

    const call = mockUseReadContract.mock.calls[0][0];
    expect(call.query.enabled).toBe(false);
  });

  it("disables the query when explicitly disabled via options", () => {
    renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161, enabled: false })
    );

    const call = mockUseReadContract.mock.calls[0][0];
    expect(call.query.enabled).toBe(false);
  });

  // ── APY conversion ─────────────────────────────────────────────

  it("converts the Aave liquidity rate into APY", () => {
    // 2% APY expressed as a ray value (~20000000000000000000000000)
    mockUseReadContract.mockReturnValue({
      data: {
        currentLiquidityRate: 20000000000000000000000000n,
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.apy).toBeGreaterThan(2);
    expect(result.current.apy).toBeLessThan(2.1);
    expect(result.current.liquidityRate).toBe(20000000000000000000000000n);
  });

  it("returns apy=0 for zero liquidity rate (no utilization)", () => {
    mockUseReadContract.mockReturnValue({
      data: { currentLiquidityRate: 0n },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.apy).toBe(0);
  });

  // ── Error / edge cases ─────────────────────────────────────────

  it("returns undefined apy when contract call errors", () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("execution reverted"),
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.apy).toBeUndefined();
    expect(result.current.isError).toBe(true);
  });

  it("returns undefined apy when data is missing (no reserve for asset)", () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    expect(result.current.apy).toBeUndefined();
    expect(result.current.isError).toBe(false);
  });

  it("guards against NaN from extreme liquidityRate values", () => {
    // A very large rate that causes Infinity in Math.pow
    mockUseReadContract.mockReturnValue({
      data: {
        currentLiquidityRate: BigInt("999999999999999999999999999999999999"),
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useStrategyRate(TEST_ASSET as `0x${string}`, { chainId: 42161 })
    );

    // Should return undefined (not Infinity or NaN)
    expect(result.current.apy).toBeUndefined();
  });
});
