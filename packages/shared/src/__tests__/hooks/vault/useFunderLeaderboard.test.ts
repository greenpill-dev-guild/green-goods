/**
 * useFunderLeaderboard Tests
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_GARDEN = "0x1111111111111111111111111111111111111111";
const TEST_WETH = "0x7b79995e5f793a07bc00c21412e50ecae098e7f9";
const TEST_DAI = "0x68194a729c2450ad26072b3d33adacbcef39d574";
const TEST_WETH_VAULT = "0x2222222222222222222222222222222222222222";
const TEST_DAI_VAULT = "0x3333333333333333333333333333333333333333";

const mockUseVaultDeposits = vi.fn();
const mockUseAllVaultDeposits = vi.fn();
const mockUseBatchConvertToAssets = vi.fn();

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 11155111,
}));

vi.mock("../../../hooks/vault/useVaultDeposits", () => ({
  useVaultDeposits: (...args: unknown[]) => mockUseVaultDeposits(...args),
}));

vi.mock("../../../hooks/vault/useAllVaultDeposits", () => ({
  useAllVaultDeposits: (...args: unknown[]) => mockUseAllVaultDeposits(...args),
}));

vi.mock("../../../hooks/vault/useBatchConvertToAssets", () => ({
  useBatchConvertToAssets: (...args: unknown[]) => mockUseBatchConvertToAssets(...args),
}));

const { useFunderLeaderboard } = await import("../../../hooks/vault/useFunderLeaderboard");

describe("useFunderLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAllVaultDeposits.mockReturnValue({
      deposits: [],
      isLoading: false,
      isError: false,
    });

    mockUseVaultDeposits.mockReturnValue({
      deposits: [
        {
          id: "weth-a",
          chainId: 11155111,
          garden: TEST_GARDEN,
          asset: TEST_WETH,
          vaultAddress: TEST_WETH_VAULT,
          depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          shares: 100n,
          totalDeposited: 100n,
          totalWithdrawn: 0n,
        },
        {
          id: "dai-a",
          chainId: 11155111,
          garden: TEST_GARDEN,
          asset: TEST_DAI,
          vaultAddress: TEST_DAI_VAULT,
          depositor: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          shares: 200n,
          totalDeposited: 200n,
          totalWithdrawn: 0n,
        },
        {
          id: "weth-b",
          chainId: 11155111,
          garden: TEST_GARDEN,
          asset: TEST_WETH,
          vaultAddress: TEST_WETH_VAULT,
          depositor: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          shares: 90n,
          totalDeposited: 90n,
          totalWithdrawn: 0n,
        },
      ],
      isLoading: false,
      isError: false,
    });

    mockUseBatchConvertToAssets.mockReturnValue({
      assetMap: new Map([
        ["11155111:0x2222222222222222222222222222222222222222:100", 110n],
        ["11155111:0x3333333333333333333333333333333333333333:200", 230n],
        ["11155111:0x2222222222222222222222222222222222222222:90", 105n],
      ]),
      isLoading: false,
      isError: false,
    });
  });

  it("preserves per-asset yield totals instead of summing mixed assets together", () => {
    const { result } = renderHook(() => useFunderLeaderboard({ gardenAddress: TEST_GARDEN }));

    expect(result.current.protocolAssetTotals).toEqual([
      {
        chainId: 11155111,
        asset: TEST_WETH,
        totalYieldGenerated: 25n,
        totalNetDeposited: 190n,
        totalCurrentValue: 215n,
      },
      {
        chainId: 11155111,
        asset: TEST_DAI,
        totalYieldGenerated: 30n,
        totalNetDeposited: 200n,
        totalCurrentValue: 230n,
      },
    ]);

    const multiAssetFunder = result.current.funders.find(
      (funder) => funder.address === "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );

    expect(multiAssetFunder?.assetTotals).toEqual([
      {
        chainId: 11155111,
        asset: TEST_WETH,
        totalYieldGenerated: 10n,
        totalNetDeposited: 100n,
        totalCurrentValue: 110n,
      },
      {
        chainId: 11155111,
        asset: TEST_DAI,
        totalYieldGenerated: 30n,
        totalNetDeposited: 200n,
        totalCurrentValue: 230n,
      },
    ]);

    expect(multiAssetFunder?.totalYieldGenerated).toBe(0n);
    expect(result.current.totalProtocolYield).toBe(0n);
  });
});
