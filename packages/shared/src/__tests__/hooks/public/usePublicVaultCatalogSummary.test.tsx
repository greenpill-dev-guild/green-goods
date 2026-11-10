import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicVaultCatalogSummary } from "../../../hooks/public/usePublicVaultCatalogSummary";
import { readPublicVaultYield } from "../../../modules/data/public-vault-yield";
import type { Address } from "../../../types/domain";
import type { GardenVault } from "../../../types/vaults";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const DAI = "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1";
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const VAULT_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const VAULT_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const STRATEGY = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const OLD_STRATEGY = "0xdddddddddddddddddddddddddddddddddddddddd" as Address;
const success = (result: unknown) => ({ status: "success", result });
const failure = { status: "failure", error: new Error("Read failed") };

const { getVaults, getAllocations, multicall, getBlockNumber } = vi.hoisted(() => ({
  getVaults: vi.fn(),
  getAllocations: vi.fn(),
  multicall: vi.fn(),
  getBlockNumber: vi.fn(),
}));
vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../../modules/data/vaults", () => ({ getAllGardenVaults: getVaults }));
vi.mock("../../../modules/data/yield-allocations", () => ({
  getAllYieldAllocations: getAllocations,
}));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: () => ({ multicall, getBlockNumber }),
}));

function vault(overrides: Partial<GardenVault> = {}): GardenVault {
  return {
    id: VAULT_A,
    chainId: 42161,
    garden: GARDEN,
    asset: DAI,
    vaultAddress: VAULT_A,
    totalDeposited: 100n,
    totalWithdrawn: 0n,
    totalHarvestCount: 0,
    donationAddress: null,
    depositorCount: 2,
    paused: false,
    createdAt: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getVaults.mockResolvedValue([vault()]);
  getAllocations.mockResolvedValue([{ gardenAddress: GARDEN, assetAddress: DAI, totalAmount: 3n }]);
  getBlockNumber.mockResolvedValue(123n);
  multicall.mockImplementation(async ({ contracts }) =>
    contracts.map((call: { functionName: string }) => {
      switch (call.functionName) {
        case "vaultStrategies":
          return success(STRATEGY);
        case "get_default_queue":
          return success([STRATEGY]);
        case "strategies":
          return success({ activation: 1n, currentDebt: 100n });
        case "balanceOf":
          return success(100n);
        case "convertToAssets":
          return success(110n);
        case "totalDebt":
          return success(100n);
        case "getReserveData":
          return success({ currentLiquidityRate: 10n ** 25n });
        default:
          throw new Error(`Unexpected read: ${call.functionName}`);
      }
    })
  );
});

describe("usePublicVaultCatalogSummary with the real chain reader", () => {
  it("restores live yield, APR and garden balances through the provider-free summary", async () => {
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.assets[0]?.accruingYield).toBe(10n));
    expect(result.current.assets[0]).toMatchObject({
      symbol: "DAI",
      netDeposited: 100n,
      currentValue: 110n,
      allocatedYield: 3n,
      accruedYield: 13n,
      apr: 1,
      isAprError: false,
    });
    expect(result.current.assets[0].apy).toBeCloseTo(1.005, 2);
    expect(result.current.gardensByAddress[GARDEN].assets[0].accruedYield).toBe(13n);
    expect(multicall.mock.calls.every(([input]) => input.blockNumber === 123n)).toBe(true);
  });

  it("shows loading until the chain read completes", async () => {
    let finish!: (value: bigint) => void;
    getBlockNumber.mockReturnValue(
      new Promise<bigint>((resolve) => {
        finish = resolve;
      })
    );
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.assets).toHaveLength(1));
    expect(result.current.isYieldLoading).toBe(true);
    expect(result.current.assets[0]).toMatchObject({
      accruingYield: undefined,
      isAprLoading: true,
    });
    finish(123n);
    await waitFor(() => expect(result.current.isYieldLoading).toBe(false));
    expect(result.current.assets[0].accruingYield).toBe(10n);
  });

  it("keeps failed reads unavailable instead of reporting zero or stale yield", async () => {
    getBlockNumber.mockRejectedValue(new Error("RPC unavailable"));
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.isYieldError).toBe(true));
    expect(result.current.assets[0]).toMatchObject({
      currentValue: 100n,
      accruingYield: undefined,
      accruedYield: undefined,
      apr: undefined,
      isAprLoading: false,
      isAprError: true,
    });
  });

  it("withholds an incomplete asset total while preserving complete assets and gardens", async () => {
    getVaults.mockResolvedValue([
      vault(),
      vault({ id: VAULT_B, vaultAddress: VAULT_B, garden: VAULT_B }),
      vault({ id: GARDEN, vaultAddress: GARDEN, asset: WETH }),
    ]);
    const normalRead = multicall.getMockImplementation()!;
    multicall.mockImplementation(async (input) => {
      const reads = await normalRead(input);
      return reads.map((read: unknown, index: number) =>
        input.contracts[index].address === VAULT_B ? failure : read
      );
    });
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.assets[1]?.accruingYield).toBe(10n));
    expect(result.current.assets[0].accruingYield).toBeUndefined();
    expect(result.current.assets[1].accruingYield).toBe(10n);
    expect(result.current.gardensByAddress[GARDEN].assets[0].accruingYield).toBe(10n);
    expect(result.current.gardensByAddress[VAULT_B].assets[0].accruedYield).toBeUndefined();
  });

  it("includes earnings left after a depositor withdrew the principal", async () => {
    getVaults.mockResolvedValue([vault({ totalWithdrawn: 100n })]);
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.assets[0]?.currentValue).toBe(10n));
    expect(result.current.assets[0].netDeposited).toBe(0n);
  });

  it.each([
    [OLD_STRATEGY, STRATEGY, OLD_STRATEGY],
    [OLD_STRATEGY],
  ])("includes retained old debt and the replacement regardless of queue membership: %j", async (...queue) => {
    multicall.mockImplementation(async ({ contracts }) =>
      contracts.map((call: { address: string; functionName: string; args?: unknown[] }) => {
        switch (call.functionName) {
          case "vaultStrategies":
            return success(STRATEGY);
          case "get_default_queue":
            return success(queue);
          case "totalDebt":
            return success(200n);
          case "strategies":
            return success({ activation: 1n, currentDebt: 100n });
          case "balanceOf":
            return success(call.address === OLD_STRATEGY ? 50n : 100n);
          case "convertToAssets":
            return success(call.args?.[0] === 50n ? 125n : 110n);
          case "totalAssets":
            return success(call.address === OLD_STRATEGY ? 250n : 110n);
          case "getReserveData":
            return success({ currentLiquidityRate: 10n ** 25n });
          default:
            throw new Error(`Unexpected read: ${call.functionName}`);
        }
      })
    );
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.assets[0]?.accruingYield).toBeDefined());
    expect(result.current.assets[0].accruingYield).toBe(35n);
    expect(result.current.gardensByAddress[GARDEN].assets[0].currentValue).toBe(135n);
  });

  it("does not contact the chain for an empty catalog", async () => {
    getVaults.mockResolvedValue([]);
    const { result } = renderHookWithQueryClient(() => usePublicVaultCatalogSummary());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.assets).toEqual([]);
    expect(getBlockNumber).not.toHaveBeenCalled();
  });
});

describe("readPublicVaultYield boundaries", () => {
  it("rejects mixed chains before querying", async () => {
    await expect(readPublicVaultYield([vault({ chainId: 11155111 })], 42161)).rejects.toThrow(
      "one chain"
    );
  });

  it("clamps losses to zero and treats a successful idle-strategy read as zero", async () => {
    const normalRead = multicall.getMockImplementation()!;
    multicall.mockImplementation(async (input) => {
      const reads = await normalRead(input);
      return reads.map((read: unknown, index: number) => {
        const call = input.contracts[index];
        if (call.address === VAULT_B) {
          if (call.functionName === "get_default_queue") return success([]);
          if (call.functionName === "totalDebt") return success(0n);
        }
        if (call.functionName === "vaultStrategies" && call.args[0] === VAULT_B)
          return success("0x0000000000000000000000000000000000000000");
        if (call.functionName === "convertToAssets") return success(90n);
        if (call.functionName === "getReserveData") return failure;
        return read;
      });
    });
    const result = await readPublicVaultYield([vault(), vault({ vaultAddress: VAULT_B })], 42161);
    expect(result.yieldByVault).toEqual({ [VAULT_A]: 0n, [VAULT_B]: 0n });
    expect(result.ratesByAsset[DAI]).toBeUndefined();
  });

  it.each([
    "get_default_queue",
    "strategies",
    "balanceOf",
    "convertToAssets",
  ])("withholds yield when %s fails while preserving independently read APR", async (functionName) => {
    const normalRead = multicall.getMockImplementation()!;
    multicall.mockImplementation(async (input) => {
      const reads = await normalRead(input);
      return reads.map((read: unknown, index: number) =>
        input.contracts[index].functionName === functionName ? failure : read
      );
    });
    const result = await readPublicVaultYield([vault()], 42161);
    expect(result.yieldByVault[VAULT_A]).toBeUndefined();
    expect(result.ratesByAsset[DAI]?.apr).toBe(1);
  });

  it("withholds yield when a custom queue omits indebted strategies", async () => {
    const normalRead = multicall.getMockImplementation()!;
    multicall.mockImplementation(async (input) => {
      const reads = await normalRead(input);
      return reads.map((read: unknown, index: number) =>
        input.contracts[index].functionName === "strategies"
          ? success({ activation: 1n, currentDebt: 50n })
          : read
      );
    });
    const result = await readPublicVaultYield([vault()], 42161);
    expect(result.yieldByVault[VAULT_A]).toBeUndefined();
  });
});
