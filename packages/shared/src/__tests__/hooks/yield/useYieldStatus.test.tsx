/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;
const ASSET = "0x2222222222222222222222222222222222222222" as const;
const VAULT = "0x3333333333333333333333333333333333333333" as const;
const JAR = "0x4444444444444444444444444444444444444444" as const;
const TREASURY = "0x5555555555555555555555555555555555555555" as const;
const SPLITTER = "0x6666666666666666666666666666666666666666" as const;
const COOKIE_MODULE = "0x7777777777777777777777777777777777777777" as const;

const mockBaseRefetch = vi.fn();
const mockConvertRefetch = vi.fn();
const mockJarRefetch = vi.fn();
const mockSplitRefetch = vi.fn();
const mockUseReadContracts = vi.fn();
const mockUseReadContract = vi.fn();

vi.mock("wagmi", () => ({
  useReadContracts: (...args: unknown[]) => mockUseReadContracts(...args),
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    yieldSplitter: SPLITTER,
    cookieJarModule: COOKIE_MODULE,
  }),
}));

const success = (result: unknown) => ({ status: "success", result });

function baseResults(overrides: Partial<Record<number, unknown>> = {}) {
  const values: unknown[] = [
    10n, // gardenShares
    2n, // pendingYield
    7n, // minYieldThreshold
    0n, // assetYieldThresholds
    3n, // escrowed fractions
    VAULT, // registered vault
    "0x0000000000000000000000000000000000000000", // legacy jar
    TREASURY,
    COOKIE_MODULE, // splitter's live cookieJarModule
  ];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;
  return values.map(success);
}

function configureReads({
  base = baseResults(),
  converted = 8n,
  moduleJar = JAR,
  split = { cookieJarBps: 4000n, fractionsBps: 4000n, juiceboxBps: 2000n },
}: {
  base?: ReturnType<typeof baseResults>;
  converted?: bigint;
  moduleJar?: string;
  split?: { cookieJarBps: bigint; fractionsBps: bigint; juiceboxBps: bigint };
} = {}) {
  mockUseReadContracts.mockReturnValue({
    data: base,
    isLoading: false,
    isError: false,
    refetch: mockBaseRefetch,
  });
  mockUseReadContract.mockImplementation((options: { functionName: string }) => {
    if (options.functionName === "convertToAssets") {
      return {
        data: converted,
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: mockConvertRefetch,
      };
    }
    if (options.functionName === "getGardenJar") {
      // Mirror wagmi: a disabled query never produces data.
      const enabled = (options as { query?: { enabled?: boolean } }).query?.enabled !== false;
      return {
        data: enabled ? moduleJar : undefined,
        isLoading: false,
        isError: false,
        isSuccess: enabled,
        refetch: mockJarRefetch,
      };
    }
    if (options.functionName === "getSplitConfig") {
      return {
        data: split,
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: mockSplitRefetch,
      };
    }
    throw new Error(`Unexpected read: ${options.functionName}`);
  });
}

const { useYieldStatus } = await import("../../../hooks/yield/useYieldStatus");

describe("useYieldStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureReads();
  });

  it("combines registered share value and pending yield against the effective threshold", () => {
    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.registeredShares).toBe(10n);
    expect(result.current.registeredShareAssets).toBe(8n);
    expect(result.current.pendingYield).toBe(2n);
    expect(result.current.totalAvailable).toBe(10n);
    expect(result.current.threshold).toBe(7n);
    expect(result.current.status).toBe("ready");
    expect(result.current.estimatedDistribution).toEqual({
      cookieJarAmount: 4n,
      fractionsAmount: 4n,
      treasuryAmount: 2n,
      totalAmount: 10n,
    });
  });

  it("uses the asset threshold override and reports yield waiting below it", () => {
    configureReads({ base: baseResults({ 3: 12n }) });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.threshold).toBe(12n);
    expect(result.current.status).toBe("waiting");
  });

  it("resolves the per-asset Cookie Jar before legacy and treasury fallbacks", () => {
    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.destination).toEqual({ address: JAR, kind: "cookie_jar" });
  });

  it("falls back to the configured treasury when no Cookie Jar exists", () => {
    configureReads({ moduleJar: "0x0000000000000000000000000000000000000000" });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.destination).toEqual({ address: TREASURY, kind: "treasury" });
  });

  it("queries the garden jar through the splitter's live cookieJarModule", () => {
    // The resolver owner can rotate cookieJarModule; routing follows the
    // splitter's stored address, so destination display must read it too.
    const rotatedModule = "0x9999999999999999999999999999999999999999";
    configureReads({ base: baseResults({ 8: rotatedModule }) });

    renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    const jarCall = mockUseReadContract.mock.calls.find(
      ([options]) => (options as { functionName: string }).functionName === "getGardenJar"
    );
    expect((jarCall?.[0] as { address: string }).address).toBe(rotatedModule);
  });

  it("falls back to the deployment artifact module when the splitter read fails", () => {
    const failedBase = baseResults();
    failedBase[8] = { status: "failure", result: undefined };
    configureReads({ base: failedBase });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    const jarCall = mockUseReadContract.mock.calls.find(
      ([options]) => (options as { functionName: string }).functionName === "getGardenJar"
    );
    expect((jarCall?.[0] as { address: string }).address).toBe(COOKIE_MODULE);
    expect(result.current.isError).toBe(false);
    // The artifact fallback keeps the workflow visible, but the live module
    // could be rotated, so the destination is not verified for confirmation.
    expect(result.current.destinationVerified).toBe(false);
  });

  it("marks a mismatched registered vault unavailable", () => {
    configureReads({
      base: baseResults({ 5: "0x8888888888888888888888888888888888888888" }),
    });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.status).toBe("unavailable");
    expect(result.current.isVaultRegistered).toBe(false);
  });

  it("reports read failures instead of presenting incomplete distribution data", () => {
    const failedBase = baseResults();
    failedBase[1] = { status: "failure", result: undefined };
    configureReads({ base: failedBase });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.status).toBe("error");
    expect(result.current.isError).toBe(true);
  });

  it("does not hide distribution when only fallback-covered reads fail", () => {
    // escrowed fractions (4), gardenCookieJars (6), gardenTreasuries (7), and
    // cookieJarModule (8) all have display fallbacks and must not gate
    // isError; destination trust is downgraded instead.
    const failedBase = baseResults();
    for (const index of [4, 6, 7, 8]) {
      failedBase[index] = { status: "failure", result: undefined };
    }
    configureReads({ base: failedBase });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.isError).toBe(false);
    expect(result.current.status).toBe("ready");
    expect(result.current.threshold).toBe(7n);
    expect(result.current.destination).toEqual({ address: JAR, kind: "cookie_jar" });
    // The status stays usable, but the destination chain lost reads, so
    // confirmation-level surfaces must treat it as unverified.
    expect(result.current.destinationVerified).toBe(false);
  });

  it("blocks the status when the asset threshold override read fails", () => {
    // A failed assetYieldThresholds read would substitute the lower global
    // threshold and could present a waiting position as ready.
    const failedBase = baseResults();
    failedBase[3] = { status: "failure", result: undefined };
    configureReads({ base: failedBase });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.status).toBe("error");
    expect(result.current.isError).toBe(true);
  });

  it("honors a deliberately disabled cookie jar module", () => {
    // A successful zero-address cookieJarModule() read means routing skips
    // the jar entirely; the artifact module must not be consulted.
    configureReads({
      base: baseResults({ 8: "0x0000000000000000000000000000000000000000" }),
    });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.destination).toEqual({ address: TREASURY, kind: "treasury" });
    expect(result.current.destinationVerified).toBe(true);
  });

  it("verifies the destination when every routing read succeeds", () => {
    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.destinationVerified).toBe(true);
  });

  it("keeps the destination unverified while the module jar read is pending", () => {
    configureReads();
    const standard = mockUseReadContract.getMockImplementation()!;
    mockUseReadContract.mockImplementation((options: { functionName: string }) => {
      if (options.functionName === "getGardenJar") {
        return {
          data: undefined,
          isLoading: true,
          isError: false,
          isSuccess: false,
          refetch: mockJarRefetch,
        };
      }
      return standard(options);
    });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.destinationVerified).toBe(false);
  });

  it("still errors when a status-required read fails", () => {
    const failedBase = baseResults();
    failedBase[0] = { status: "failure", result: undefined };
    configureReads({ base: failedBase });

    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    expect(result.current.status).toBe("error");
    expect(result.current.isError).toBe(true);
  });

  it("refetches resolver, share conversion, destination, and split reads", async () => {
    const { result } = renderHook(() => useYieldStatus(GARDEN, ASSET, VAULT));

    await result.current.refetch();

    expect(mockBaseRefetch).toHaveBeenCalledOnce();
    expect(mockConvertRefetch).toHaveBeenCalledOnce();
    expect(mockJarRefetch).toHaveBeenCalledOnce();
    expect(mockSplitRefetch).toHaveBeenCalledOnce();
  });
});
