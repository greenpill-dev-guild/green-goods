/**
 * @vitest-environment jsdom
 */

import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TEST_CHAIN_ID,
  TEST_FACTORY,
  TEST_JAR,
  TEST_TOKEN,
  TEST_USER,
  ZERO_ADDRESS,
  mockDetailsQuery,
  mockFactoryQuery,
  mockMetadataQuery,
  mockTokenQuery,
  mockUserAddress,
  mockUseReadContract,
  mockUseReadContracts,
} = vi.hoisted(() => ({
  TEST_CHAIN_ID: 11155111,
  TEST_JAR: "0x1111111111111111111111111111111111111111" as Address,
  TEST_TOKEN: "0x2222222222222222222222222222222222222222" as Address,
  TEST_USER: "0x3333333333333333333333333333333333333333" as Address,
  TEST_FACTORY: "0x4444444444444444444444444444444444444444" as Address,
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" as Address,
  mockDetailsQuery: {
    current: { data: undefined as unknown, isLoading: false, error: null as Error | null },
  },
  mockFactoryQuery: {
    current: { data: undefined as unknown, isLoading: false, error: null as Error | null },
  },
  mockMetadataQuery: {
    current: { data: undefined as unknown, isLoading: false, error: null as Error | null },
  },
  mockTokenQuery: {
    current: { data: undefined as unknown, isLoading: false, error: null as Error | null },
  },
  mockUserAddress: { current: "0x3333333333333333333333333333333333333333" as Address | undefined },
  mockUseReadContract: vi.fn(),
  mockUseReadContracts: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: mockUserAddress.current }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: () => ({
    cookieJarFactory: TEST_FACTORY,
    cookieJarModule: ZERO_ADDRESS,
  }),
}));

vi.mock("../../../utils/blockchain/vaults", () => ({
  ZERO_ADDRESS,
}));

vi.mock("wagmi", () => ({
  useReadContract: (args: { functionName?: string }) => {
    mockUseReadContract(args);
    if (args.functionName === "getMetadata") return mockMetadataQuery.current;
    return mockFactoryQuery.current;
  },
  useReadContracts: (args: { contracts?: Array<{ functionName?: string }> }) => {
    mockUseReadContracts(args);
    const firstFunction = args.contracts?.[0]?.functionName;
    if (firstFunction === "decimals") return mockTokenQuery.current;
    return mockDetailsQuery.current;
  },
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
}));

import { useCampaignCookieJar } from "../../../hooks/cookie-jar/useCampaignCookieJar";

function campaignJarDetails() {
  return [
    { status: "success", result: TEST_TOKEN },
    { status: "success", result: 100n },
    { status: "success", result: 10n },
    { status: "success", result: 0n },
    { status: "success", result: 10n },
    { status: "success", result: 0 },
    { status: "success", result: 0 },
    { status: "success", result: true },
    { status: "success", result: false },
    { status: "success", result: false },
    { status: "success", result: false },
    { status: "success", result: 0n },
    { status: "success", result: [TEST_USER] },
    { status: "success", result: 0n },
    { status: "success", result: 0n },
    { status: "success", result: true },
  ];
}

describe("useCampaignCookieJar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserAddress.current = TEST_USER;
    mockDetailsQuery.current = {
      data: campaignJarDetails(),
      isLoading: false,
      error: null,
    };
    mockFactoryQuery.current = { data: undefined, isLoading: false, error: null };
    mockMetadataQuery.current = { data: undefined, isLoading: false, error: null };
    mockTokenQuery.current = {
      data: [
        { status: "success", result: 18 },
        { status: "success", result: "GOOD" },
      ],
      isLoading: false,
      error: null,
    };
  });

  it("keeps jar detail usable when campaign metadata cannot be read", () => {
    mockMetadataQuery.current = {
      data: undefined,
      isLoading: false,
      error: new Error("metadata unavailable"),
    };

    const { result } = renderHook(() => useCampaignCookieJar(TEST_JAR));

    expect(result.current.jar?.metadata).toBeNull();
    expect(result.current.jar?.symbol).toBe("GOOD");
    expect(result.current.error).toBeNull();
    expect(result.current.metadataError).toBeInstanceOf(Error);
    expect(result.current.hasMetadataReadFailure).toBe(true);
    expect(result.current.hasDetailReadFailure).toBe(true);
  });

  it("reads jar, token, and metadata on the app chain while disconnected", () => {
    mockUserAddress.current = undefined;
    const { result } = renderHook(() => useCampaignCookieJar(TEST_JAR));

    for (const [args] of mockUseReadContracts.mock.calls) {
      expect(args.contracts.length).toBeGreaterThan(0);
      expect(
        args.contracts.every((contract: { chainId?: number }) => contract.chainId === TEST_CHAIN_ID)
      ).toBe(true);
    }
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getMetadata", chainId: TEST_CHAIN_ID })
    );
    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "cookieJarFactory", chainId: TEST_CHAIN_ID })
    );
    expect(result.current.jar?.isEligible).toBe(false);
    expect(result.current.jar?.canClaimNow).toBe(false);
  });

  it("makes an allowlisted connected user eligible to claim", () => {
    const { result } = renderHook(() => useCampaignCookieJar(TEST_JAR));

    expect(result.current.jar?.isEligible).toBe(true);
    expect(result.current.jar?.canClaimNow).toBe(true);
    expect(result.current.jar?.isOwner).toBe(true);
    expect(result.current.hasDetailReadFailure).toBe(false);
  });

  it("keeps usable jar details while reporting a failed optional contract read", () => {
    mockDetailsQuery.current = {
      data: campaignJarDetails().map((entry, index) =>
        index === 10 ? { status: "failure", error: new Error("emergency flag unavailable") } : entry
      ),
      isLoading: false,
      error: null,
    };

    const { result } = renderHook(() => useCampaignCookieJar(TEST_JAR));

    expect(result.current.jar?.balance).toBe(100n);
    expect(result.current.jar?.emergencyWithdrawalEnabled).toBe(false);
    expect(result.current.detailErrorCount).toBe(1);
    expect(result.current.hasDetailReadFailure).toBe(true);
    expect(result.current.hasMetadataReadFailure).toBe(false);
  });
});
