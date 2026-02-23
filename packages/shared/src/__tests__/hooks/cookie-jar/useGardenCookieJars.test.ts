/**
 * useGardenCookieJars Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the 3-step multicall chain:
 *   1. Fetch jar addresses from CookieJarModule
 *   2. Multicall jar state (6 fields per jar)
 *   3. Multicall ERC20 decimals for each jar's currency
 */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../test-utils";

const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";
const TEST_JAR_1 = "0xJar1111111111111111111111111111111111111";
const TEST_JAR_2 = "0xJar2222222222222222222222222222222222222";
const TEST_CURRENCY = "0xCurr111111111111111111111111111111111111";
const TEST_MODULE = "0xModule111111111111111111111111111111111111";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ── Mock state ──────────────────────────────────────────────────────────────
const mockReadContractReturn: {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: false, error: null };

const mockReadContractsReturn: {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: false, error: null };

const mockDecimalsReturn: {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
} = { data: undefined, isLoading: false, error: null };

let readContractCallCount = 0;
let readContractsCallCount = 0;

vi.mock("wagmi", () => ({
  useReadContract: (args: Record<string, unknown>) => {
    readContractCallCount++;
    // Only the first useReadContract is the jar address fetch
    return {
      data:
        args?.query && (args.query as Record<string, unknown>).enabled === false
          ? undefined
          : mockReadContractReturn.data,
      isLoading: mockReadContractReturn.isLoading,
      error: mockReadContractReturn.error,
    };
  },
  useReadContracts: (args: Record<string, unknown>) => {
    readContractsCallCount++;
    const enabled = args?.query && (args.query as Record<string, unknown>).enabled;
    // First useReadContracts = jar details, second = decimals
    if (readContractsCallCount % 2 === 0) {
      return {
        data: enabled === false ? undefined : mockDecimalsReturn.data,
        isLoading: mockDecimalsReturn.isLoading,
        error: mockDecimalsReturn.error,
      };
    }
    return {
      data: enabled === false ? undefined : mockReadContractsReturn.data,
      isLoading: mockReadContractsReturn.isLoading,
      error: mockReadContractsReturn.error,
    };
  },
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

let mockModuleAddress: string = TEST_MODULE;

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    cookieJarModule: mockModuleAddress,
  }),
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  ZERO_ADDRESS,
}));

vi.mock("../../../hooks/query-keys", () => ({
  queryKeys: {
    cookieJar: {
      garden: (garden: string) => ["cookie-jar", "garden", garden],
    },
  },
  STALE_TIME_MEDIUM: 60_000,
}));

const { useGardenCookieJars } = await import("../../../hooks/cookie-jar/useGardenCookieJars");

describe("hooks/cookie-jar/useGardenCookieJars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readContractCallCount = 0;
    readContractsCallCount = 0;
    mockModuleAddress = TEST_MODULE;
    mockReadContractReturn.data = undefined;
    mockReadContractReturn.isLoading = false;
    mockReadContractReturn.error = null;
    mockReadContractsReturn.data = undefined;
    mockReadContractsReturn.isLoading = false;
    mockReadContractsReturn.error = null;
    mockDecimalsReturn.data = undefined;
    mockDecimalsReturn.isLoading = false;
    mockDecimalsReturn.error = null;
  });

  it("returns empty when module not configured (zero address)", () => {
    mockModuleAddress = ZERO_ADDRESS;

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
    expect(result.current.moduleConfigured).toBe(false);
  });

  it("returns empty when gardenAddress is undefined", () => {
    const { result } = renderHook(() => useGardenCookieJars(undefined), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
    expect(result.current.jarCount).toBe(0);
  });

  it("returns empty when no jar addresses found", () => {
    mockReadContractReturn.data = [];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
    expect(result.current.jarCount).toBe(0);
  });

  it("filters out zero-address jars", () => {
    mockReadContractReturn.data = [TEST_JAR_1, ZERO_ADDRESS];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    // Only 1 valid jar after filtering
    expect(result.current.jarCount).toBe(1);
  });

  it("transforms multicall results into CookieJar objects", () => {
    // Step 1: jar addresses
    mockReadContractReturn.data = [TEST_JAR_1];

    // Step 2: jar details multicall (6 fields per jar)
    mockReadContractsReturn.data = [
      { result: TEST_CURRENCY, status: "success" }, // CURRENCY
      { result: 5000000000000000000n, status: "success" }, // currencyHeldByJar (5e18)
      { result: 1000000000000000000n, status: "success" }, // maxWithdrawal (1e18)
      { result: 3600n, status: "success" }, // withdrawalInterval
      { result: false, status: "success" }, // paused
      { result: true, status: "success" }, // EMERGENCY_WITHDRAWAL_ENABLED
    ];

    // Step 3: decimals
    mockDecimalsReturn.data = [{ result: 6, status: "success" }];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(1);
    const jar = result.current.jars[0];
    expect(jar.jarAddress).toBe(TEST_JAR_1);
    expect(jar.gardenAddress).toBe(TEST_GARDEN.toLowerCase());
    expect(jar.currency).toBe(TEST_CURRENCY);
    expect(jar.balance).toBe(5000000000000000000n);
    expect(jar.maxWithdrawal).toBe(1000000000000000000n);
    expect(jar.withdrawalInterval).toBe(3600n);
    expect(jar.isPaused).toBe(false);
    expect(jar.emergencyWithdrawalEnabled).toBe(true);
    expect(jar.decimals).toBe(6);
  });

  it("handles multiple jars correctly", () => {
    mockReadContractReturn.data = [TEST_JAR_1, TEST_JAR_2];

    const currency2 = "0xCurr222222222222222222222222222222222222";
    mockReadContractsReturn.data = [
      // Jar 1 (6 fields)
      { result: TEST_CURRENCY, status: "success" },
      { result: 1000n, status: "success" },
      { result: 500n, status: "success" },
      { result: 3600n, status: "success" },
      { result: false, status: "success" },
      { result: false, status: "success" },
      // Jar 2 (6 fields)
      { result: currency2, status: "success" },
      { result: 2000n, status: "success" },
      { result: 1000n, status: "success" },
      { result: 7200n, status: "success" },
      { result: true, status: "success" },
      { result: true, status: "success" },
    ];

    mockDecimalsReturn.data = [
      { result: 18, status: "success" },
      { result: 8, status: "success" },
    ];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(2);
    expect(result.current.jars[0].currency).toBe(TEST_CURRENCY);
    expect(result.current.jars[1].currency).toBe(currency2);
    expect(result.current.jars[1].isPaused).toBe(true);
    expect(result.current.jars[1].decimals).toBe(8);
  });

  it("skips jars where currency is undefined", () => {
    mockReadContractReturn.data = [TEST_JAR_1];

    mockReadContractsReturn.data = [
      { result: undefined, status: "failure" }, // CURRENCY failed
      { result: 1000n, status: "success" },
      { result: 500n, status: "success" },
      { result: 3600n, status: "success" },
      { result: false, status: "success" },
      { result: false, status: "success" },
    ];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(0);
  });

  it("skips jars where balance is undefined", () => {
    mockReadContractReturn.data = [TEST_JAR_1];

    mockReadContractsReturn.data = [
      { result: TEST_CURRENCY, status: "success" },
      { result: undefined, status: "failure" }, // balance failed
      { result: 500n, status: "success" },
      { result: 3600n, status: "success" },
      { result: false, status: "success" },
      { result: false, status: "success" },
    ];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(0);
  });

  it("falls back to 18 decimals when decimals call fails", () => {
    mockReadContractReturn.data = [TEST_JAR_1];

    mockReadContractsReturn.data = [
      { result: TEST_CURRENCY, status: "success" },
      { result: 1000n, status: "success" },
      { result: 500n, status: "success" },
      { result: 3600n, status: "success" },
      { result: false, status: "success" },
      { result: false, status: "success" },
    ];

    // Decimals returns undefined (call failed)
    mockDecimalsReturn.data = [{ result: undefined, status: "failure" }];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(1);
    expect(result.current.jars[0].decimals).toBe(18);
  });

  it("sets loading true while any step is loading", () => {
    mockReadContractReturn.isLoading = true;

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it("propagates address fetch error", () => {
    const testError = new Error("RPC failure");
    mockReadContractReturn.error = testError;

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.error).toBe(testError);
  });

  it("propagates details fetch error", () => {
    mockReadContractReturn.data = [TEST_JAR_1];
    const testError = new Error("Multicall failure");
    mockReadContractsReturn.error = testError;

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.error).toBe(testError);
  });

  it("disabled option prevents all fetching", () => {
    mockReadContractReturn.data = [TEST_JAR_1];

    const { result } = renderHook(() => useGardenCookieJars(TEST_GARDEN, { enabled: false }), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
  });
});
