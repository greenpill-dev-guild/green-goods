/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react";
import { type Address, encodeEventTopics } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

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
  mockReadContract,
  mockSendContractTx,
  mockTokenQuery,
  mockUserAddress,
  mockUseReadContract,
  mockUseReadContracts,
  mockWaitForTransactionReceipt,
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
  mockReadContract: vi.fn(),
  mockSendContractTx: vi.fn(),
  mockUseReadContract: vi.fn(),
  mockUseReadContracts: vi.fn(),
  mockWaitForTransactionReceipt: vi.fn(),
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
  readContract: mockReadContract,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
}));

vi.mock("../../../config/appkit", () => ({ getWagmiConfig: () => ({}) }));

vi.mock("../../../hooks/blockchain/useContractTxSender", () => ({
  useContractTxSender: () => mockSendContractTx,
}));

vi.mock("../../../components/toast", () => ({
  toastService: { loading: vi.fn(() => "toast"), success: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("../../../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => vi.fn(),
}));

import {
  useCampaignCookieJar,
  useCampaignCookieJarDeposit,
  useCreateCampaignCookieJar,
} from "../../../hooks/cookie-jar/useCampaignCookieJar";
import { COOKIE_JAR_FACTORY_ABI } from "../../../utils/blockchain/abis/cookie-jar";

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

describe("campaign cookie jar mutations", () => {
  const TX_HASH = `0x${"a".repeat(64)}` as const;
  const deposit = { jarAddress: TEST_JAR, assetAddress: TEST_TOKEN, amount: 10n };

  /**
   * Answers only a read that names the app chain. The jar and its token exist on
   * no other network, and a read that names none goes wherever the wallet sits.
   */
  const onAppChain =
    <T>(answer: (request: { functionName?: string }) => T) =>
    async (_config: unknown, request: { chainId?: number; functionName?: string }) => {
      if (request.chainId !== TEST_CHAIN_ID) throw new Error("The contract returned no data");
      return answer(request);
    };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserAddress.current = TEST_USER;
    mockSendContractTx.mockResolvedValue(TX_HASH);
  });

  it("checks the allowance on the app chain, so a wallet on another network is not asked to approve again", async () => {
    mockReadContract.mockImplementation(
      onAppChain(({ functionName }) => (functionName === "balanceOf" ? 20n : 10n))
    );
    const { result } = renderHookWithProviders(() => useCampaignCookieJarDeposit());

    await act(async () => {
      await result.current.mutateAsync(deposit);
    });

    expect(mockSendContractTx).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ address: TEST_JAR, functionName: "deposit", args: [10n] })
    );
  });

  it("refuses a deposit above the balance on the app chain before anything is sent", async () => {
    mockReadContract.mockImplementation(onAppChain(() => 5n));
    const { result } = renderHookWithProviders(() => useCampaignCookieJarDeposit());

    await act(async () => {
      await expect(result.current.mutateAsync(deposit)).rejects.toThrow(
        "Insufficient token balance for deposit"
      );
    });

    expect(mockSendContractTx).not.toHaveBeenCalled();
  });

  it("reads the creation receipt on the app chain and returns the new jar", async () => {
    mockWaitForTransactionReceipt.mockImplementation(
      onAppChain(() => ({
        logs: [
          {
            address: TEST_FACTORY,
            data: "0x",
            topics: encodeEventTopics({
              abi: COOKIE_JAR_FACTORY_ABI,
              eventName: "JarCreated",
              args: { jarAddress: TEST_JAR, creator: TEST_USER },
            }),
          },
        ],
      }))
    );
    const { result } = renderHookWithProviders(() => useCreateCampaignCookieJar());

    let created: { jarAddress?: Address } | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({
        factoryAddress: TEST_FACTORY,
        title: "Seed fund",
        slug: "seed-fund",
        tokenAddress: TEST_TOKEN,
        jarOwner: TEST_USER,
        allowlist: [TEST_USER],
        sourceGardens: [],
        extraAllowlist: [],
        fixedAmount: 1n,
        maxWithdrawal: 1n,
        withdrawalInterval: 0n,
        minDeposit: 0n,
        oneTimeWithdrawal: false,
        strictPurpose: false,
        withdrawalType: "fixed",
      });
    });

    expect(created?.jarAddress).toBe(TEST_JAR);
  });
});
