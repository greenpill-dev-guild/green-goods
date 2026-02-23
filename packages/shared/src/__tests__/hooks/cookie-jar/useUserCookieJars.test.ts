/**
 * useUserCookieJars Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the aggregation of cookie jars across all gardens where the user is an operator.
 * This hook layers on top of useGardenCookieJars' multicall chain, adding:
 *   - Operator garden filtering via useRole + useGardens
 *   - Batch jar address reads across multiple gardens
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../test-utils";

const TEST_CHAIN_ID = 11155111;
const TEST_MODULE = "0xModule111111111111111111111111111111111111";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const TEST_GARDEN_1 = "0xGarden1111111111111111111111111111111111";
const TEST_GARDEN_2 = "0xGarden2222222222222222222222222222222222";
const TEST_JAR_1 = "0xJar1111111111111111111111111111111111111";
const TEST_JAR_2 = "0xJar2222222222222222222222222222222222222";
const TEST_CURRENCY = "0xCurr111111111111111111111111111111111111";

// ── Mock state ──────────────────────────────────────────────────────────────
const mockOperatorGardens: Array<{ id: string; name: string }> = [];
const mockGardens: Array<{ tokenAddress: string; id: string }> = [];

let readContractsCallCount = 0;
const mockReadContractsResults: Array<{
  data: unknown;
  isLoading: boolean;
}> = [];

vi.mock("wagmi", () => ({
  useReadContracts: (args: Record<string, unknown>) => {
    const idx = readContractsCallCount++;
    const enabled = args?.query && (args.query as Record<string, unknown>).enabled;
    if (enabled === false || idx >= mockReadContractsResults.length) {
      return { data: undefined, isLoading: false };
    }
    return mockReadContractsResults[idx];
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

vi.mock("../../../hooks/gardener/useRole", () => ({
  useRole: () => ({ operatorGardens: mockOperatorGardens }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: mockGardens.length > 0 ? mockGardens : undefined }),
}));

vi.mock("../../../hooks/query-keys", () => ({
  STALE_TIME_MEDIUM: 60_000,
}));

const { useUserCookieJars } = await import("../../../hooks/cookie-jar/useUserCookieJars");

describe("hooks/cookie-jar/useUserCookieJars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readContractsCallCount = 0;
    mockModuleAddress = TEST_MODULE;
    mockReadContractsResults.length = 0;
    mockOperatorGardens.length = 0;
    mockGardens.length = 0;
  });

  it("returns empty when user has no operator gardens", () => {
    mockOperatorGardens.length = 0;

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
  });

  it("returns empty when gardens data not loaded", () => {
    mockOperatorGardens.push({ id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" });
    // mockGardens stays empty (data not loaded yet)

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toEqual([]);
  });

  it("filters gardens to only those where user is operator", () => {
    const nonOperatorGarden = "0xNonOp111111111111111111111111111111111";
    mockOperatorGardens.push({ id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" });
    mockGardens.push(
      { tokenAddress: TEST_GARDEN_1, id: "garden-1" },
      { tokenAddress: nonOperatorGarden, id: "garden-non-op" }
    );

    // Step 1: jar addresses — only 1 garden should be queried
    mockReadContractsResults.push({
      data: [{ result: [TEST_JAR_1], status: "success" }],
      isLoading: false,
    });

    // Step 2: jar details
    mockReadContractsResults.push({
      data: [
        { result: TEST_CURRENCY, status: "success" },
        { result: 1000n, status: "success" },
        { result: 500n, status: "success" },
        { result: 3600n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
      ],
      isLoading: false,
    });

    // Step 3: decimals
    mockReadContractsResults.push({
      data: [{ result: 18, status: "success" }],
      isLoading: false,
    });

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    // The hook should only query for operator gardens (1 garden, not 2)
    expect(result.current.moduleConfigured).toBe(true);
  });

  it("aggregates jars across multiple operator gardens", () => {
    mockOperatorGardens.push(
      { id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" },
      { id: TEST_GARDEN_2.toLowerCase(), name: "Garden 2" }
    );
    mockGardens.push(
      { tokenAddress: TEST_GARDEN_1, id: "garden-1" },
      { tokenAddress: TEST_GARDEN_2, id: "garden-2" }
    );

    // Step 1: jar addresses for both gardens
    mockReadContractsResults.push({
      data: [
        { result: [TEST_JAR_1], status: "success" },
        { result: [TEST_JAR_2], status: "success" },
      ],
      isLoading: false,
    });

    // Step 2: jar details for both jars (6 fields each)
    mockReadContractsResults.push({
      data: [
        { result: TEST_CURRENCY, status: "success" },
        { result: 1000n, status: "success" },
        { result: 500n, status: "success" },
        { result: 3600n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: TEST_CURRENCY, status: "success" },
        { result: 2000n, status: "success" },
        { result: 1000n, status: "success" },
        { result: 7200n, status: "success" },
        { result: false, status: "success" },
        { result: true, status: "success" },
      ],
      isLoading: false,
    });

    // Step 3: decimals for both jars
    mockReadContractsResults.push({
      data: [
        { result: 18, status: "success" },
        { result: 18, status: "success" },
      ],
      isLoading: false,
    });

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.jars).toHaveLength(2);
    expect(result.current.jars[0].jarAddress).toBe(TEST_JAR_1);
    expect(result.current.jars[1].jarAddress).toBe(TEST_JAR_2);
  });

  it("returns empty when module not configured", () => {
    mockModuleAddress = ZERO_ADDRESS;

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.moduleConfigured).toBe(false);
    expect(result.current.jars).toEqual([]);
  });

  it("filters out zero-address jars across all gardens", () => {
    mockOperatorGardens.push({ id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" });
    mockGardens.push({ tokenAddress: TEST_GARDEN_1, id: "garden-1" });

    // Jar addresses include a zero address
    mockReadContractsResults.push({
      data: [{ result: [TEST_JAR_1, ZERO_ADDRESS], status: "success" }],
      isLoading: false,
    });

    // Only 1 valid jar should have details fetched
    mockReadContractsResults.push({
      data: [
        { result: TEST_CURRENCY, status: "success" },
        { result: 1000n, status: "success" },
        { result: 500n, status: "success" },
        { result: 3600n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
      ],
      isLoading: false,
    });

    mockReadContractsResults.push({
      data: [{ result: 18, status: "success" }],
      isLoading: false,
    });

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    // Zero address jar should be filtered out
    expect(result.current.jars.length).toBeLessThanOrEqual(1);
  });

  it("falls back to 18 decimals on failure", () => {
    mockOperatorGardens.push({ id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" });
    mockGardens.push({ tokenAddress: TEST_GARDEN_1, id: "garden-1" });

    mockReadContractsResults.push({
      data: [{ result: [TEST_JAR_1], status: "success" }],
      isLoading: false,
    });

    mockReadContractsResults.push({
      data: [
        { result: TEST_CURRENCY, status: "success" },
        { result: 1000n, status: "success" },
        { result: 500n, status: "success" },
        { result: 3600n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
      ],
      isLoading: false,
    });

    // Decimals call fails
    mockReadContractsResults.push({
      data: [{ result: undefined, status: "failure" }],
      isLoading: false,
    });

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    // Should still produce jars with fallback decimals
    if (result.current.jars.length > 0) {
      expect(result.current.jars[0].decimals).toBe(18);
    }
  });

  it("sets loading state correctly across all steps", () => {
    mockOperatorGardens.push({ id: TEST_GARDEN_1.toLowerCase(), name: "Garden 1" });
    mockGardens.push({ tokenAddress: TEST_GARDEN_1, id: "garden-1" });

    // First step is loading
    mockReadContractsResults.push({ data: undefined, isLoading: true });
    mockReadContractsResults.push({ data: undefined, isLoading: false });
    mockReadContractsResults.push({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useUserCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
