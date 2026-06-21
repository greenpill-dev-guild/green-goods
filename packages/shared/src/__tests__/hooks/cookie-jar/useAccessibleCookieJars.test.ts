/**
 * useAccessibleCookieJars Hook Tests
 * @vitest-environment jsdom
 *
 * Verifies cookie-jar visibility is based on onchain garden-account access
 * checks and fails closed when eligibility cannot be confirmed.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../test-utils";

const TEST_CHAIN_ID = 11155111;
const TEST_MODULE = "0xModule111111111111111111111111111111111111";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TEST_USER = "0x1234567890123456789012345678901234567890";

const SHARED_GARDEN_TOKEN = "0x9999999999999999999999999999999999999999";
const GARDENER_GARDEN = "0x1111111111111111111111111111111111111111";
const OPERATOR_GARDEN = "0x2222222222222222222222222222222222222222";
const OWNER_GARDEN = "0x3333333333333333333333333333333333333333";
const EVALUATOR_GARDEN = "0x4444444444444444444444444444444444444444";
const FUNDER_GARDEN = "0x5555555555555555555555555555555555555555";
const COMMUNITY_GARDEN = "0x6666666666666666666666666666666666666666";

const TEST_JAR_1 = "0xJar1111111111111111111111111111111111111";
const TEST_JAR_2 = "0xJar2222222222222222222222222222222222222";
const TEST_JAR_3 = "0xJar3333333333333333333333333333333333333";
const TEST_CURRENCY = "0xCurr111111111111111111111111111111111111";

const mockGardens = [
  {
    id: GARDENER_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [TEST_USER],
    operators: [],
    owners: [],
    evaluators: [],
    funders: [],
    communities: [],
  },
  {
    id: OPERATOR_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [],
    operators: [TEST_USER],
    owners: [],
    evaluators: [],
    funders: [],
    communities: [],
  },
  {
    id: OWNER_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [],
    operators: [],
    owners: [TEST_USER],
    evaluators: [],
    funders: [],
    communities: [],
  },
  {
    id: EVALUATOR_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [],
    operators: [],
    owners: [],
    evaluators: [TEST_USER],
    funders: [],
    communities: [],
  },
  {
    id: FUNDER_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [],
    operators: [],
    owners: [],
    evaluators: [],
    funders: [TEST_USER],
    communities: [],
  },
  {
    id: COMMUNITY_GARDEN,
    tokenAddress: SHARED_GARDEN_TOKEN,
    gardeners: [],
    operators: [],
    owners: [],
    evaluators: [],
    funders: [],
    communities: [TEST_USER],
  },
] as const;

let readContractsCallCount = 0;
const mockReadContractsResults: Array<{
  data: unknown;
  isLoading: boolean;
}> = [];

vi.mock("wagmi", () => ({
  useReadContracts: (args: Record<string, unknown>) => {
    const index = readContractsCallCount++;
    const enabled = args?.query && (args.query as Record<string, unknown>).enabled;
    if (enabled === false || index >= mockReadContractsResults.length) {
      return { data: undefined, isLoading: false };
    }
    return mockReadContractsResults[index];
  },
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => TEST_USER,
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

let mockModuleAddress = TEST_MODULE;

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    cookieJarModule: mockModuleAddress,
  }),
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  ZERO_ADDRESS,
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: mockGardens }),
}));

vi.mock("../../../config/query-keys", () => ({
  STALE_TIME_MEDIUM: 60_000,
}));

const { useAccessibleCookieJars } = await import(
  "../../../hooks/cookie-jar/useAccessibleCookieJars"
);

describe("hooks/cookie-jar/useAccessibleCookieJars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readContractsCallCount = 0;
    mockModuleAddress = TEST_MODULE;
    mockReadContractsResults.length = 0;
  });

  it("shows jars only for gardens with confirmed onchain gardener access", () => {
    mockReadContractsResults.push({
      data: [
        { result: true, status: "success" },
        { result: true, status: "success" },
        { result: true, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { status: "failure" },
      ],
      isLoading: false,
    });

    mockReadContractsResults.push({
      data: [
        { result: [TEST_JAR_1], status: "success" },
        { result: [TEST_JAR_2], status: "success" },
        { result: [TEST_JAR_3], status: "success" },
      ],
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
        { result: 0n, status: "success" },
        { result: TEST_CURRENCY, status: "success" },
        { result: 2000n, status: "success" },
        { result: 750n, status: "success" },
        { result: 7200n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: 0n, status: "success" },
        { result: TEST_CURRENCY, status: "success" },
        { result: 3000n, status: "success" },
        { result: 1000n, status: "success" },
        { result: 3600n, status: "success" },
        { result: false, status: "success" },
        { result: false, status: "success" },
        { result: 0n, status: "success" },
      ],
      isLoading: false,
    });

    mockReadContractsResults.push({
      data: [
        { result: 18, status: "success" },
        { result: 18, status: "success" },
        { result: 18, status: "success" },
      ],
      isLoading: false,
    });

    const { result } = renderHook(() => useAccessibleCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.confirmedGardenCount).toBe(5);
    expect(result.current.eligibleGardenCount).toBe(3);
    expect(result.current.unconfirmedGardenCount).toBe(1);
    expect(result.current.eligibilityErrorCount).toBe(1);
    expect(result.current.hasEligibilityReadFailure).toBe(true);
    expect(result.current.jars).toHaveLength(3);
    expect(result.current.jars.map((jar) => jar.gardenAddress)).toEqual([
      GARDENER_GARDEN.toLowerCase(),
      OPERATOR_GARDEN.toLowerCase(),
      OWNER_GARDEN.toLowerCase(),
    ]);
  });

  it("fails closed when onchain eligibility cannot be confirmed", () => {
    mockReadContractsResults.push({
      data: [
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
        { status: "failure" },
      ],
      isLoading: false,
    });

    const { result } = renderHook(() => useAccessibleCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.confirmedGardenCount).toBe(0);
    expect(result.current.eligibleGardenCount).toBe(0);
    expect(result.current.unconfirmedGardenCount).toBe(6);
    expect(result.current.eligibilityErrorCount).toBe(6);
    expect(result.current.hasEligibilityReadFailure).toBe(true);
    expect(result.current.jars).toEqual([]);
  });

  it("reports loading while eligibility is still resolving", () => {
    mockReadContractsResults.push({
      data: undefined,
      isLoading: true,
    });

    const { result } = renderHook(() => useAccessibleCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.jars).toEqual([]);
  });

  it("returns empty when the cookie jar module is not configured", () => {
    mockModuleAddress = ZERO_ADDRESS;

    const { result } = renderHook(() => useAccessibleCookieJars(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.moduleConfigured).toBe(false);
    expect(result.current.unconfirmedGardenCount).toBe(0);
    expect(result.current.eligibilityErrorCount).toBe(0);
    expect(result.current.hasEligibilityReadFailure).toBe(false);
    expect(result.current.jars).toEqual([]);
  });
});
