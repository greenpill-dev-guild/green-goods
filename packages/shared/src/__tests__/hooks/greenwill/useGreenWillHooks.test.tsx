/**
 * GreenWill hook tests
 * @vitest-environment happy-dom
 */

import { act, waitFor } from "@testing-library/react";
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const TEST_CHAIN_ID = 42161;
const TEST_USER = "0xABcDEFabcdefABCDEFabcdefAbcdefABcDefABCD" as Address;
const TEST_GREENWILL = "0x1111111111111111111111111111111111111111" as Address;
const TEST_GARDEN = "0x3333333333333333333333333333333333333333" as Address;
const TEST_ASSET = "0x4444444444444444444444444444444444444444" as Address;
const TEST_WORK_UID = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GENESIS_BADGE_ID = keccak256(stringToHex("GENESIS"));
const FIRST_WORK_BADGE_ID = keccak256(stringToHex("FIRST_WORK"));
const FIRST_SUPPORT_BADGE_ID = keccak256(stringToHex("FIRST_SUPPORT"));

const mockGetGreenWillBadgeDefinitions = vi.fn();
const mockGetGreenWillBadgesByOwner = vi.fn();
const mockGetGreenWillRecentGrants = vi.fn();
const mockSendContractCall = vi.fn();
const mockSimulateContract = vi.fn();
const mockToast = vi.hoisted(() => ({
  loading: vi.fn(() => "toast-id"),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id} ${JSON.stringify(values)}` : id,
  }),
}));

vi.mock("../../../components/toast", () => ({ toastService: mockToast }));

vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: () => ({
    simulateContract: (...args: unknown[]) => mockSimulateContract(...args),
  }),
}));

/** What viem throws when the chain itself turns a call down. */
function contractRefusal(errorName?: string) {
  const revert = new ContractFunctionRevertedError({
    abi: [],
    functionName: "claimBadge",
    message: errorName ? `reverted with ${errorName}` : "execution reverted",
  });
  return new BaseError('The contract function "claimBadge" reverted.', { cause: revert });
}

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 42161,
}));

vi.mock("../../../modules/data/greenwill", () => ({
  getGreenWillBadgeDefinitions: (...args: unknown[]) => mockGetGreenWillBadgeDefinitions(...args),
  getGreenWillBadgesByOwner: (...args: unknown[]) => mockGetGreenWillBadgesByOwner(...args),
  getGreenWillRecentGrants: (...args: unknown[]) => mockGetGreenWillRecentGrants(...args),
}));

const mockAccount = vi.hoisted(() => ({ primaryAddress: "" as string }));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    primaryAddress: mockAccount.primaryAddress,
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

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenWillABI: [{ type: "function", name: "claimBadge" }],
  getNetworkContracts: () => ({
    greenWill: TEST_GREENWILL,
  }),
}));

import { queryKeys } from "../../../config/query-keys";
import { describeBadgeClaimError } from "../../../hooks/greenwill/useClaimGreenWillBadge";
import {
  useClaimFirstSupportBadge,
  useClaimFirstWorkBadge,
  useClaimGenesisBadge,
  useGreenWillBadgeDefinitions,
  useGreenWillBadges,
  useGreenWillRecentGrants,
} from "../../../hooks/greenwill";

describe("hooks/greenwill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockAccount.primaryAddress = TEST_USER;
    mockSimulateContract.mockResolvedValue({ result: undefined });
  });

  it("loads badge definitions with the default chain", async () => {
    mockGetGreenWillBadgeDefinitions.mockResolvedValueOnce([
      {
        id: "42161:genesis",
        chainId: TEST_CHAIN_ID,
        badgeId: GENESIS_BADGE_ID,
        slug: "genesis",
        metadataURI: "ipfs://genesis",
        validator: TEST_GREENWILL,
        authorizedIssuer: TEST_GREENWILL,
        unlockLock: TEST_GREENWILL,
        claimable: true,
        active: true,
        holderCount: 1,
        grantCount: 1,
        updatedAt: 1,
      },
    ]);

    const { result } = renderHookWithQueryClient(() => useGreenWillBadgeDefinitions());

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
        validator: TEST_GREENWILL,
        authorizedIssuer: TEST_GREENWILL,
        unlockLock: TEST_GREENWILL,
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
        validator: TEST_GREENWILL,
        authorizedIssuer: TEST_GREENWILL,
        unlockLock: TEST_GREENWILL,
        claimable: true,
        active: true,
        holderCount: 0,
        grantCount: 0,
        updatedAt: 1,
      },
      {
        id: "42161:first-support",
        chainId: TEST_CHAIN_ID,
        badgeId: FIRST_SUPPORT_BADGE_ID,
        slug: "first-support",
        metadataURI: "ipfs://first-support",
        validator: TEST_GREENWILL,
        authorizedIssuer: TEST_GREENWILL,
        unlockLock: TEST_GREENWILL,
        claimable: true,
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
        issuer: TEST_GREENWILL,
        unlockTokenId: 1n,
        issuedAt: 1710000000,
        definitionId: "42161:genesis",
        lastGrantId: "grant-1",
      },
    ]);

    const { result } = renderHookWithQueryClient(() => useGreenWillBadges(TEST_USER));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGreenWillBadgesByOwner).toHaveBeenCalledWith(
      TEST_USER.toLowerCase(),
      TEST_CHAIN_ID
    );
    expect(result.current.earnedBadges.map((badge) => badge.slug)).toEqual(["genesis"]);
    expect(result.current.claimableBadges.map((badge) => badge.slug)).toEqual([
      "first-work",
      "first-support",
    ]);
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
        issuer: TEST_GREENWILL,
        unlockTokenId: 1n,
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        timestamp: 1710000020,
      },
    ]);

    const { result } = renderHookWithQueryClient(() => useGreenWillRecentGrants({ limit: 5 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetGreenWillRecentGrants).toHaveBeenCalledWith(TEST_CHAIN_ID, 5);
    expect(result.current.grants).toHaveLength(1);
  });

  it("claims the genesis badge through the registry", async () => {
    mockSendContractCall.mockResolvedValueOnce({
      hash: "0x1234",
      sponsored: false,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge(), { queryClient });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GREENWILL,
        functionName: "claimBadge",
        args: [GENESIS_BADGE_ID, "0x"],
      }),
      // The send reports when it reached the chain.
      expect.objectContaining({ onBroadcast: expect.any(Function) })
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

    const { result } = renderHookWithQueryClient(() => useClaimFirstWorkBadge());

    await act(async () => {
      await result.current.mutateAsync({ uid: TEST_WORK_UID });
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GREENWILL,
        functionName: "claimBadge",
        args: [FIRST_WORK_BADGE_ID, encodeAbiParameters([{ type: "bytes32" }], [TEST_WORK_UID])],
      }),
      // The send reports when it reached the chain.
      expect.objectContaining({ onBroadcast: expect.any(Function) })
    );
  });

  it("claims the first-support badge from an existing garden vault position", async () => {
    mockSendContractCall.mockResolvedValueOnce({
      hash: "0xsupport",
      sponsored: false,
    });

    const { result } = renderHookWithQueryClient(() => useClaimFirstSupportBadge());

    await act(async () => {
      await result.current.mutateAsync({
        gardenAddress: TEST_GARDEN,
        assetAddress: TEST_ASSET,
      });
    });

    expect(mockSendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GREENWILL,
        functionName: "claimBadge",
        args: [
          FIRST_SUPPORT_BADGE_ID,
          encodeAbiParameters(
            [{ type: "address" }, { type: "address" }],
            [TEST_GARDEN, TEST_ASSET]
          ),
        ],
      }),
      // The send reports when it reached the chain.
      expect.objectContaining({ onBroadcast: expect.any(Function) })
    );
  });

  it("checks the claim with the chain before opening the wallet, and says it landed", async () => {
    mockSendContractCall.mockResolvedValueOnce({ hash: "0x1234", sponsored: false });

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockSimulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GREENWILL,
        functionName: "claimBadge",
        args: [GENESIS_BADGE_ID, "0x"],
        account: TEST_USER,
      })
    );
    expect(mockSimulateContract.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendContractCall.mock.invocationCallOrder[0]
    );
    expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id");
    expect(mockToast.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("app.profile.badges.claim.successTitle"),
      })
    );
  });

  it("says a Safe-style claim waits for approval instead of calling it claimed", async () => {
    mockSendContractCall.mockResolvedValueOnce({
      hash: "0xsafe",
      sponsored: false,
      confirmation: "pending",
    });

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockToast.success).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalledWith(
      expect.objectContaining({ title: "app.profile.badges.claim.awaitingTitle" })
    );
  });

  it("keeps reading ownership after a claim that failed once it was sent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSendContractCall.mockImplementationOnce(
      async (_call: unknown, options?: { onBroadcast?: (hash: string) => Promise<void> }) => {
        await options?.onBroadcast?.("0xsent");
        throw new Error("Timed out while waiting for transaction receipt");
      }
    );
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge(), { queryClient });
    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow();
    });
    const afterFailure = invalidateSpy.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(invalidateSpy.mock.calls.length).toBeGreaterThan(afterFailure);
  });

  it("reads ownership once, not on a schedule, when nothing was sent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSimulateContract.mockRejectedValueOnce(contractRefusal());
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge(), { queryClient });
    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow();
    });
    const afterFailure = invalidateSpy.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(invalidateSpy.mock.calls.length).toBe(afterFailure);
  });

  it("drops a claim's result when the account changes", async () => {
    mockSendContractCall.mockResolvedValueOnce({ hash: "0x1234", sponsored: false });

    const { result, rerender } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    mockAccount.primaryAddress = "0x1111111111111111111111111111111111111112";
    rerender(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(false));
    expect(result.current.isIdle).toBe(true);
  });

  it("re-reads ownership while a sent claim awaits execution, and stops once it is owned", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetGreenWillBadgeDefinitions.mockResolvedValue([]);
    mockGetGreenWillBadgesByOwner.mockResolvedValue([]);

    renderHookWithQueryClient(() =>
      useGreenWillBadges(TEST_USER, { awaitBadgeIds: [GENESIS_BADGE_ID] })
    );
    await waitFor(() => expect(mockGetGreenWillBadgesByOwner).toHaveBeenCalledTimes(1));

    mockGetGreenWillBadgesByOwner.mockResolvedValue([{ badgeId: GENESIS_BADGE_ID }]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(mockGetGreenWillBadgesByOwner).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(mockGetGreenWillBadgesByOwner).toHaveBeenCalledTimes(2);
  });

  it("stops a claim the badge contract refuses before the wallet opens, and says why", async () => {
    mockSimulateContract.mockRejectedValueOnce(contractRefusal());

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow();
    });

    expect(mockSendContractCall).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "app.profile.badges.claim.error.refused" })
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("leaves the decision to the wallet when the check cannot reach the chain", async () => {
    mockSimulateContract.mockRejectedValueOnce(new Error("fetch failed"));
    mockSendContractCall.mockResolvedValueOnce({ hash: "0x1234", sponsored: false });

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockSendContractCall).toHaveBeenCalledTimes(1);
  });

  it("treats a prompt turned down in the wallet as cancelled, not failed", async () => {
    mockSendContractCall.mockRejectedValueOnce(new Error("User rejected the request."));

    const { result } = renderHookWithQueryClient(() => useClaimGenesisBadge());
    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow();
    });

    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: "app.profile.badges.claim.cancelledMessage" })
    );
  });
});

describe("describeBadgeClaimError", () => {
  it("names the badge contract's own refusals", () => {
    expect(describeBadgeClaimError(new Error("reverted with BadgeAlreadyOwned"))).toEqual({
      kind: "failed",
      messageId: "app.profile.badges.claim.error.alreadyOwned",
    });
    expect(describeBadgeClaimError(new Error("Error: NotHatWearer(address,uint256)"))).toEqual({
      kind: "failed",
      messageId: "app.profile.badges.claim.error.notEligible",
    });
    expect(describeBadgeClaimError(new Error("NoVaultShares")).messageId).toBe(
      "app.profile.badges.claim.error.supportMissing"
    );
  });

  it("reads a reason-less revert as a refusal, not a garden membership problem", () => {
    expect(describeBadgeClaimError(contractRefusal()).messageId).toBe(
      "app.profile.badges.claim.error.refused"
    );
    expect(describeBadgeClaimError(new Error("execution reverted")).messageId).toBe(
      "app.profile.badges.claim.error.refused"
    );
  });

  it("falls back to a plain failure for anything else", () => {
    expect(describeBadgeClaimError(new Error("boom")).messageId).toBe(
      "app.profile.badges.claim.error.unknown"
    );
  });
});
