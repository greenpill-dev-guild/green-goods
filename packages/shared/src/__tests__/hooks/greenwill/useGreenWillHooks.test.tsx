/**
 * GreenWill hook tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { encodeAbiParameters, keccak256, stringToHex, type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_CHAIN_ID = 42161;
const TEST_USER = "0xABcDEFabcdefABCDEFabcdefAbcdefABcDefABCD" as Address;
const TEST_REGISTRY = "0x1111111111111111111111111111111111111111" as Address;
const TEST_ROUTER = "0x2222222222222222222222222222222222222222" as Address;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333" as Address;
const TEST_ASSET = "0x4444444444444444444444444444444444444444" as Address;
const TEST_WORK_UID = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GENESIS_BADGE_ID = keccak256(stringToHex("GENESIS"));
const FIRST_WORK_BADGE_ID = keccak256(stringToHex("FIRST_WORK"));

const mockGetGreenWillBadgeDefinitions = vi.fn();
const mockGetGreenWillBadgesByOwner = vi.fn();
const mockGetGreenWillRecentGrants = vi.fn();
const mockSendContractCall = vi.fn();
const mockReadContract = vi.fn();

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("../../../modules/data/greenwill", () => ({
  getGreenWillBadgeDefinitions: (...args: unknown[]) => mockGetGreenWillBadgeDefinitions(...args),
  getGreenWillBadgesByOwner: (...args: unknown[]) => mockGetGreenWillBadgesByOwner(...args),
  getGreenWillRecentGrants: (...args: unknown[]) => mockGetGreenWillRecentGrants(...args),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: TEST_USER,
  }),
}));

vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => TEST_CHAIN_ID,
}));

vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => ({
    sendContractCall: (...args: unknown[]) => mockSendContractCall(...args),
    supportsSponsorship: false,
    supportsBatching: false,
    authMode: "wallet",
  }),
}));

vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenWillRegistryABI: [{ type: "function", name: "claimBadge" }],
  GreenWillSupportRouterABI: [{ type: "function", name: "fundVault" }],
  ERC20_ALLOWANCE_ABI: [
    { type: "function", name: "allowance" },
    { type: "function", name: "approve" },
  ],
  getNetworkContracts: () => ({
    greenWillRegistry: TEST_REGISTRY,
    greenWillSupportRouter: TEST_ROUTER,
  }),
}));

import { queryKeys } from "../../../config/query-keys";
import {
  useClaimFirstWorkBadge,
  useClaimGenesisBadge,
  useGreenWillBadgeDefinitions,
  useGreenWillBadges,
  useGreenWillRecentGrants,
  useGreenWillSupportDeposit,
} from "../../../hooks/greenwill";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// TODO: Enable when GreenWill query keys and contract surface are wired
describe.skip("hooks/greenwill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads badge definitions with the default chain", async () => {
    mockGetGreenWillBadgeDefinitions.mockResolvedValueOnce([
      {
        id: "42161:genesis",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        slug: "genesis",
        metadataURI: "ipfs://genesis",
        validator: TEST_REGISTRY,
        authorizedIssuer: TEST_ROUTER,
        unlockLock: TEST_ROUTER,
        claimable: true,
        active: true,
        holderCount: 1,
        grantCount: 1,
        updatedAt: 1,
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useGreenWillBadgeDefinitions(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGreenWillBadgeDefinitions).toHaveBeenCalledWith(TEST_CHAIN_ID);
    expect(result.current.badgeDefinitions).toHaveLength(1);
    expect(result.current.badgeDefinitions[0]?.slug).toBe("genesis");
  });

  it("combines definitions and ownership into earned and claimable badge lists", async () => {
    mockGetGreenWillBadgeDefinitions.mockResolvedValueOnce([
      {
        id: "42161:genesis",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        slug: "genesis",
        metadataURI: "ipfs://genesis",
        validator: TEST_REGISTRY,
        authorizedIssuer: TEST_ROUTER,
        unlockLock: TEST_ROUTER,
        claimable: true,
        active: true,
        holderCount: 1,
        grantCount: 1,
        updatedAt: 1,
      },
      {
        id: "42161:first-work",
        chainId: TEST_CHAIN_ID,
        badgeId: FIRST_WORK_BADGE_ID,
        slug: "first-work",
        metadataURI: "ipfs://first-work",
        validator: TEST_REGISTRY,
        authorizedIssuer: TEST_ROUTER,
        unlockLock: TEST_ROUTER,
        claimable: true,
        active: true,
        holderCount: 0,
        grantCount: 0,
        updatedAt: 1,
      },
      {
        id: "42161:first-support",
        chainId: TEST_CHAIN_ID,
        badgeId: keccak256(stringToHex("FIRST_SUPPORT")),
        slug: "first-support",
        metadataURI: "ipfs://first-support",
        validator: TEST_REGISTRY,
        authorizedIssuer: TEST_ROUTER,
        unlockLock: TEST_ROUTER,
        claimable: false,
        active: true,
        holderCount: 0,
        grantCount: 0,
        updatedAt: 1,
      },
    ]);
    mockGetGreenWillBadgesByOwner.mockResolvedValueOnce([
      {
        id: "owned-genesis",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        owner: TEST_USER.toLowerCase(),
        sourceRef: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        issuer: TEST_REGISTRY,
        unlockTokenId: 1n,
        issuedAt: 1710000000,
        definitionId: "42161:genesis",
        lastGrantId: "grant-1",
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useGreenWillBadges(TEST_USER), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGreenWillBadgesByOwner).toHaveBeenCalledWith(
      TEST_USER.toLowerCase(),
      TEST_CHAIN_ID
    );
    expect(result.current.earnedBadges.map((badge) => badge.slug)).toEqual(["genesis"]);
    expect(result.current.claimableBadges.map((badge) => badge.slug)).toEqual(["first-work"]);
    expect(result.current.badges.find((badge) => badge.slug === "genesis")?.owned).toBe(true);
  });

  it("loads recent grants", async () => {
    mockGetGreenWillRecentGrants.mockResolvedValueOnce([
      {
        id: "grant-1",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        owner: TEST_USER.toLowerCase(),
        sourceRef: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        issuer: TEST_REGISTRY,
        unlockTokenId: 1n,
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        timestamp: 1710000020,
      },
    ]);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useGreenWillRecentGrants({ limit: 5 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGreenWillRecentGrants).toHaveBeenCalledWith(TEST_CHAIN_ID, 5);
    expect(result.current.grants).toHaveLength(1);
  });

  it("claims the genesis badge through the registry", async () => {
    mockSendContractCall.mockResolvedValueOnce({
      hash: "0x1234",
      sponsored: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useClaimGenesisBadge(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_REGISTRY,
        functionName: "claimBadge",
        args: [GENESIS_BADGE_ID, "0x"],
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.greenWill.ownership(TEST_USER.toLowerCase(), TEST_CHAIN_ID),
    });
  });

  it("claims the first-work badge by encoding the submitted work uid", async () => {
    mockSendContractCall.mockResolvedValueOnce({
      hash: "0x5678",
      sponsored: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    const { result } = renderHook(() => useClaimFirstWorkBadge(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ uid: TEST_WORK_UID });
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_REGISTRY,
        functionName: "claimBadge",
        args: [FIRST_WORK_BADGE_ID, encodeAbiParameters([{ type: "bytes32" }], [TEST_WORK_UID])],
      })
    );
  });

  it("routes support funding through the support router and approves when needed", async () => {
    mockReadContract.mockResolvedValueOnce(0n);
    mockSendContractCall
      .mockResolvedValueOnce({ hash: "0xapprove", sponsored: false })
      .mockResolvedValueOnce({ hash: "0xdeposit", sponsored: false });

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });

    const { result } = renderHook(() => useGreenWillSupportDeposit(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN,
        assetAddress: TEST_ASSET,
        amount: 10n,
      });
    });

    expect(mockReadContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "allowance",
        args: [TEST_USER, TEST_ROUTER],
      })
    );
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: TEST_ASSET,
        functionName: "approve",
        args: [TEST_ROUTER, 10n],
      })
    );
    expect(mockSendContractCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: TEST_ROUTER,
        functionName: "fundVault",
        args: [TEST_GARDEN, TEST_ASSET, 10n],
      })
    );
  });
});
