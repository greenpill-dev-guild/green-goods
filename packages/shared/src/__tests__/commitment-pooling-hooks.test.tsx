/** @vitest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import {
  useCommitment,
  useCommitmentActivity,
  useCommitmentClaimRequests,
  useCommitmentCycle,
  useCommitmentCycles,
  useCommitmentExchange,
  useCommitmentFunding,
  useCommitmentHypercertBundle,
  useCommitmentPool,
  useCommitmentPools,
  useCommitmentSeries,
  useCommitmentSeriesDetail,
  useCommitments,
  useNeedCommitments,
  usePoolMemberHistory,
  usePoolParticipationSummary,
} from "../hooks/commitment-pooling/useCommitmentPooling";
import { useCommitmentMutation } from "../hooks/commitment-pooling/useCommitmentMutations";
import { useCommitmentPoolingAvailability } from "../hooks/commitment-pooling/useCommitmentPoolingAvailability";
import type { CommitmentMutationInput } from "../hooks/commitment-pooling/useCommitmentMutations";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const VIEWER = "0x2222222222222222222222222222222222222222";
const MODULE = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a";

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  moduleAddress: "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a",
  senderAvailable: true,
  sender: { sendContractCall: vi.fn() },
  mutationErrorHandler: vi.fn(),
  pinCommitmentReason: vi.fn(),
  roles: vi.fn(),
  getCommitmentPools: vi.fn(),
  getCommitmentPoolDetail: vi.fn(),
  getCommitmentCycles: vi.fn(),
  getCommitmentCycleDetail: vi.fn(),
  getCommitments: vi.fn(),
  getCommitmentDetail: vi.fn(),
  getCommitmentClaimRequests: vi.fn(),
  getCommitmentSeries: vi.fn(),
  getCommitmentSeriesDetail: vi.fn(),
  getNeedCommitments: vi.fn(),
  getCommitmentExchange: vi.fn(),
  getCommitmentHypercertBundle: vi.fn(),
  getCommitmentFunding: vi.fn(),
  getCommitmentActivity: vi.fn(),
  getPoolMemberHistory: vi.fn(),
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCommitmentPools: mocks.getCommitmentPools,
  getCommitmentPoolDetail: mocks.getCommitmentPoolDetail,
  getCommitmentCycles: mocks.getCommitmentCycles,
  getCommitmentCycleDetail: mocks.getCommitmentCycleDetail,
  getCommitments: mocks.getCommitments,
  getCommitmentDetail: mocks.getCommitmentDetail,
  getCommitmentClaimRequests: mocks.getCommitmentClaimRequests,
  getCommitmentSeries: mocks.getCommitmentSeries,
  getCommitmentSeriesDetail: mocks.getCommitmentSeriesDetail,
  getNeedCommitments: mocks.getNeedCommitments,
  getCommitmentExchange: mocks.getCommitmentExchange,
  getCommitmentHypercertBundle: mocks.getCommitmentHypercertBundle,
  getCommitmentFunding: mocks.getCommitmentFunding,
  getCommitmentActivity: mocks.getCommitmentActivity,
  getPoolMemberHistory: mocks.getPoolMemberHistory,
}));

vi.mock("../hooks/roles/useGardenRoles", () => ({
  useGardenRoles: (...args: unknown[]) => mocks.roles(...args),
}));

vi.mock("../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => (mocks.senderAvailable ? mocks.sender : undefined),
}));

vi.mock("../utils/blockchain/contracts", () => ({
  CommitmentPoolingModuleABI: [],
  getNetworkContracts: () => ({ commitmentPoolingModule: mocks.moduleAddress }),
}));

vi.mock("../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "MockContractError" }),
}));

vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
}));

vi.mock("../modules/commitment-pooling/reasons", async () => {
  const actual = await vi.importActual<typeof import("../modules/commitment-pooling/reasons")>(
    "../modules/commitment-pooling/reasons"
  );
  return { ...actual, pinCommitmentReason: mocks.pinCommitmentReason };
});

const pool = {
  id: "42161-9",
  garden: ACCOUNT,
  commitmentsAccepted: 5n,
  commitmentsFulfilled: 3n,
  commitmentsDue: 4n,
  commitmentsCancelled: 1n,
  commitmentsExpired: 1n,
};

function setAvailable() {
  mocks.capability = {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  };
}

describe("commitment pooling query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.roles.mockReturnValue({ roles: [], isLoading: false, error: null });
    mocks.getCommitmentPools.mockResolvedValue([pool]);
    mocks.getCommitmentPoolDetail.mockResolvedValue({ pool });
    mocks.getCommitmentCycles.mockResolvedValue([{ id: "cycle" }]);
    mocks.getCommitmentCycleDetail.mockResolvedValue({ cycle: { id: "cycle" } });
    mocks.getCommitments.mockResolvedValue([{ id: "commitment" }]);
    mocks.getCommitmentDetail.mockResolvedValue({ commitment: { id: "commitment" } });
    mocks.getCommitmentClaimRequests.mockResolvedValue([{ id: "claim" }]);
    mocks.getCommitmentSeries.mockResolvedValue([{ id: "series" }]);
    mocks.getCommitmentSeriesDetail.mockResolvedValue({ series: { id: "series" } });
    mocks.getNeedCommitments.mockResolvedValue({ needUID: "0xneed" });
    mocks.getCommitmentExchange.mockResolvedValue({ id: "exchange" });
    mocks.getCommitmentHypercertBundle.mockResolvedValue({ id: "bundle" });
    mocks.getCommitmentFunding.mockResolvedValue([{ id: "funding" }]);
    mocks.getCommitmentActivity.mockResolvedValue([{ id: "event" }]);
    mocks.getPoolMemberHistory.mockResolvedValue({ id: "history" });
  });

  it("derives availability from the chain capability ledger", () => {
    const { result, rerender } = renderHookWithProviders(() =>
      useCommitmentPoolingAvailability({ chainId: 42161 })
    );
    expect(result.current.status).toBe("available");

    mocks.capability = undefined;
    rerender();
    expect(result.current).toEqual({ status: "unknown-chain" });
  });

  it("does not fetch list data while the capability ledger is unavailable", async () => {
    mocks.capability = {
      deployment: "deployed",
      activation: "active",
      integration: "not-integrated",
      availability: "deployed-not-available",
      evidence: [],
      verified_at: "2026-08-16",
    };
    const { result } = renderHookWithProviders(() =>
      useCommitments({ chainId: 42161, poolId: 9n })
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mocks.getCommitments).not.toHaveBeenCalled();
    expect(result.current.commitments).toEqual([]);
    expect(result.current.availability).toMatchObject({
      status: "unavailable",
      reason: "not-integrated",
    });
  });

  it("exposes pool data with an exact promise-kept ratio", async () => {
    const { result } = renderHookWithProviders(() =>
      useCommitmentPools({ chainId: 42161, garden: ACCOUNT })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.getCommitmentPools).toHaveBeenCalledWith(42161, ACCOUNT);
    expect(result.current.pools[0]?.promiseKeptRate).toEqual({ fulfilled: 3n, due: 4n });
  });

  const listAndDetailCases = [
    {
      name: "pool detail",
      render: () => useCommitmentPool({ chainId: 42161, poolId: 9n }),
      select: (value: Record<string, unknown>) => value.pool,
      expected: pool,
    },
    {
      name: "cycles",
      render: () => useCommitmentCycles({ chainId: 42161, poolId: 9n, state: "OPEN" }),
      select: (value: Record<string, unknown>) => value.cycles,
      expected: [{ id: "cycle" }],
    },
    {
      name: "cycle detail",
      render: () => useCommitmentCycle({ chainId: 42161, cycleId: 10n }),
      select: (value: Record<string, unknown>) => value.cycle,
      expected: { id: "cycle" },
    },
    {
      name: "commitments",
      render: () => useCommitments({ chainId: 42161, account: ACCOUNT }),
      select: (value: Record<string, unknown>) => value.commitments,
      expected: [{ id: "commitment" }],
    },
    {
      name: "commitment detail",
      render: () => useCommitment({ chainId: 42161, commitmentId: 11n }),
      select: (value: Record<string, unknown>) => value.commitment,
      expected: { id: "commitment" },
    },
    {
      name: "claim requests",
      render: () =>
        useCommitmentClaimRequests({ chainId: 42161, commitmentId: 11n, state: "PENDING" }),
      select: (value: Record<string, unknown>) => value.claimRequests,
      expected: [{ id: "claim" }],
    },
    {
      name: "series list",
      render: () => useCommitmentSeries({ chainId: 42161, holder: ACCOUNT }),
      select: (value: Record<string, unknown>) => value.series,
      expected: [{ id: "series" }],
    },
    {
      name: "series detail",
      render: () => useCommitmentSeriesDetail({ chainId: 42161, seriesId: 12n }),
      select: (value: Record<string, unknown>) => value.series,
      expected: { id: "series" },
    },
    {
      name: "need lineage",
      render: () => useNeedCommitments({ chainId: 42161, needUID: "0xneed" }),
      select: (value: Record<string, unknown>) => value.lineage,
      expected: { needUID: "0xneed" },
    },
    {
      name: "exchange",
      render: () =>
        useCommitmentExchange({
          chainId: 42161,
          poolId: 9n,
          commitmentIdA: 11n,
          commitmentIdB: 12n,
        }),
      select: (value: Record<string, unknown>) => value.exchange,
      expected: { id: "exchange" },
    },
    {
      name: "Hypercert bundle",
      render: () => useCommitmentHypercertBundle({ chainId: 42161, hypercertId: 13n }),
      select: (value: Record<string, unknown>) => value.bundle,
      expected: { id: "bundle" },
    },
    {
      name: "funding",
      render: () => useCommitmentFunding({ chainId: 42161, commitmentId: 11n, funder: ACCOUNT }),
      select: (value: Record<string, unknown>) => value.funding,
      expected: [{ id: "funding" }],
    },
    {
      name: "activity",
      render: () => useCommitmentActivity({ chainId: 42161, poolId: 9n, limit: 20 }),
      select: (value: Record<string, unknown>) => value.events,
      expected: [{ id: "event" }],
    },
  ];

  it.each(listAndDetailCases)("returns $name data through the shared hook", async (testCase) => {
    const { result } = renderHookWithProviders(testCase.render);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(testCase.select(result.current as unknown as Record<string, unknown>)).toEqual(
      testCase.expected
    );
  });

  it("surfaces indexer errors instead of converting them into an empty success", async () => {
    const error = new Error("indexer unavailable");
    mocks.getCommitments.mockRejectedValue(error);
    const { result } = renderHookWithProviders(() => useCommitments({ chainId: 42161 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.commitments).toEqual([]);
  });

  it("keeps blank Need identities disabled", async () => {
    const { result } = renderHookWithProviders(() =>
      useNeedCommitments({ chainId: 42161, needUID: "" })
    );
    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(mocks.getNeedCommitments).not.toHaveBeenCalled();
  });

  it("derives an aggregate-only pool participation summary", async () => {
    const { result } = renderHookWithProviders(() =>
      usePoolParticipationSummary({ chainId: 42161, poolId: 9n })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.summary).toEqual({
      commitmentsAccepted: 5n,
      commitmentsFulfilled: 3n,
      commitmentsCancelled: 1n,
      commitmentsExpired: 1n,
      promiseKeptRate: { fulfilled: 3n, due: 4n },
    });
    expect(result.current.summary).not.toHaveProperty("account");
  });

  it("returns unauthenticated member history without querying private rows", async () => {
    const { result } = renderHookWithProviders(() =>
      usePoolMemberHistory({ chainId: 42161, poolId: 9n, account: ACCOUNT })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.disclosure).toEqual({ status: "unauthenticated" });
    expect(mocks.getPoolMemberHistory).not.toHaveBeenCalled();
  });

  it("allows self and current stewards to read member history but hides it from former stewards", async () => {
    const self = renderHookWithProviders(() =>
      usePoolMemberHistory({
        chainId: 42161,
        poolId: 9n,
        account: ACCOUNT,
        viewer: ACCOUNT.toUpperCase() as typeof ACCOUNT,
      })
    );
    await waitFor(() => expect(self.result.current.disclosure.status).toBe("visible"));
    self.unmount();

    mocks.roles.mockReturnValue({ roles: ["operator"], isLoading: false, error: null });
    const steward = renderHookWithProviders(() =>
      usePoolMemberHistory({
        chainId: 42161,
        poolId: 9n,
        account: ACCOUNT,
        viewer: VIEWER,
      })
    );
    await waitFor(() => expect(steward.result.current.disclosure.status).toBe("visible"));
    steward.unmount();

    mocks.roles.mockReturnValue({ roles: [], isLoading: false, error: null });
    mocks.getPoolMemberHistory.mockClear();
    const formerSteward = renderHookWithProviders(() =>
      usePoolMemberHistory({
        chainId: 42161,
        poolId: 9n,
        account: ACCOUNT,
        viewer: VIEWER,
      })
    );
    await waitFor(() => expect(formerSteward.result.current.isLoading).toBe(false));
    expect(formerSteward.result.current.disclosure).toEqual({ status: "hidden" });
    expect(mocks.getPoolMemberHistory).not.toHaveBeenCalled();
  });
});

describe("useCommitmentMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.senderAvailable = true;
    mocks.moduleAddress = MODULE;
    mocks.sender.sendContractCall.mockResolvedValue({ hash: "0xabc" });
  });

  const actions: Array<{
    input: CommitmentMutationInput;
    args: readonly unknown[];
  }> = [
    { input: { action: "acceptClaim", commitmentId: 1n, claimant: ACCOUNT }, args: [1n, ACCOUNT] },
    {
      input: { action: "declineClaim", commitmentId: 1n, claimant: ACCOUNT, reasonCID: "ipfs://r" },
      args: [1n, ACCOUNT, "ipfs://r"],
    },
    { input: { action: "acceptExchange", commitmentId: 1n }, args: [1n] },
    { input: { action: "joinCommitment", commitmentId: 1n }, args: [1n] },
    { input: { action: "leaveCommitment", commitmentId: 1n }, args: [1n] },
    { input: { action: "expireCommitment", commitmentId: 1n }, args: [1n] },
    {
      input: { action: "addContributor", commitmentId: 1n, contributor: ACCOUNT },
      args: [1n, ACCOUNT],
    },
    {
      input: { action: "removeContributor", commitmentId: 1n, contributor: ACCOUNT },
      args: [1n, ACCOUNT],
    },
    {
      input: {
        action: "setContributorRequirement",
        commitmentId: 1n,
        contributor: ACCOUNT,
        requirementIndex: 2,
        assigned: true,
      },
      args: [1n, ACCOUNT, 2, true],
    },
    {
      input: { action: "attachAssessment", commitmentId: 1n, assessmentUID: "0x1234" },
      args: [1n, "0x1234"],
    },
    {
      input: { action: "markReadyForConfirmation", commitmentId: 1n, reason: "ready" },
      args: [1n, "ready"],
    },
    {
      input: { action: "confirmFulfillmentAsFallback", commitmentId: 1n, reason: "fallback" },
      args: [1n, "fallback"],
    },
    {
      input: { action: "cancelCommitment", commitmentId: 1n, reasonCID: "ipfs://r" },
      args: [1n, "ipfs://r"],
    },
    {
      input: { action: "raiseDispute", commitmentId: 1n, reasonCID: "ipfs://r" },
      args: [1n, "ipfs://r"],
    },
    {
      input: { action: "resolveDispute", commitmentId: 1n, resolution: 2, reasonCID: "ipfs://r" },
      args: [1n, 2, "ipfs://r"],
    },
    {
      input: {
        action: "setDeclaredConsideration",
        commitmentId: 1n,
        consideration: { rail: 1, amount: 2n, token: ACCOUNT, reference: "0x1234" },
      },
      args: [1n, { rail: 1, amount: 2n, token: ACCOUNT, reference: "0x1234" }],
    },
    {
      input: {
        action: "setDeclaredValue",
        commitmentId: 1n,
        declaredUnitValue: 2n,
        declaredValueBasis: "USD",
      },
      args: [1n, 2n, "USD"],
    },
    {
      input: {
        action: "setConfirmerRule",
        commitmentId: 1n,
        confirmers: [ACCOUNT],
        threshold: 1,
        protocolFallbackEnabled: true,
      },
      args: [1n, [ACCOUNT], 1, true],
    },
    {
      input: { action: "updateCommitmentSeriesMetadata", seriesId: 2n, metadataCID: "ipfs://m" },
      args: [2n, "ipfs://m"],
    },
    { input: { action: "restCommitmentSeries", seriesId: 2n }, args: [2n] },
    { input: { action: "resumeCommitmentSeries", seriesId: 2n }, args: [2n] },
    { input: { action: "retireCommitmentSeries", seriesId: 2n }, args: [2n] },
  ];

  it("maps every online action to the exact contract function and arguments", async () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }), {
      queryClient,
    });

    for (const testCase of actions) {
      await act(async () => {
        await result.current.mutateAsync(testCase.input);
      });
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: MODULE,
        abi: [],
        functionName: testCase.input.action,
        args: testCase.args,
        chainId: 42161,
      });
    }
  });

  it("invalidates the chain prefix plus the directly changed entity", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }), {
      queryClient,
    });

    await act(async () => {
      await result.current.mutateAsync({ action: "acceptExchange", commitmentId: 11n });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commitmentPooling.all(42161) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.commitment(42161, 11n),
    });

    invalidate.mockClear();
    await act(async () => {
      await result.current.mutateAsync({ action: "restCommitmentSeries", seriesId: 12n });
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.series(42161, 12n),
    });
  });

  it.each([
    {
      name: "missing sender",
      configure: () => {
        mocks.senderAvailable = false;
      },
      message: "Transaction sender is unavailable",
    },
    {
      name: "unavailable capability",
      configure: () => {
        mocks.capability = undefined;
      },
      message: "Commitment Pooling is unavailable on this chain",
    },
    {
      name: "zero module address",
      configure: () => {
        mocks.moduleAddress = "0x0000000000000000000000000000000000000000";
      },
      message: "Commitment Pooling is not deployed on this chain",
    },
  ])("fails closed for $name and reports mutation context", async ({ configure, message }) => {
    configure();
    const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }));
    const request = { action: "acceptExchange", commitmentId: 11n } as const;

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toThrow(message);
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: {
        action: "acceptExchange",
        chainId: 42161,
        parsedErrorName: "MockContractError",
      },
    });
  });

  describe("reasons are pinned before they are sent", () => {
    it.each([
      {
        input: { action: "cancelCommitment", commitmentId: 5n, reason: "Plans changed" },
        args: [5n, "bafy-reason"],
      },
      {
        input: { action: "raiseDispute", commitmentId: 5n, reason: "Not what was agreed" },
        args: [5n, "bafy-reason"],
      },
      {
        input: {
          action: "declineClaim",
          commitmentId: 5n,
          claimant: ACCOUNT,
          reason: "Another neighbour already asked",
        },
        args: [5n, ACCOUNT, "bafy-reason"],
      },
      {
        input: {
          action: "resolveDispute",
          commitmentId: 5n,
          resolution: 1,
          reason: "Seen and settled",
        },
        args: [5n, 1, "bafy-reason"],
      },
    ] as const)("pins the $input.action reason and sends the CID, never the text", async ({
      input,
      args,
    }) => {
      mocks.pinCommitmentReason.mockResolvedValue("bafy-reason");
      const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }));

      await act(async () => {
        await result.current.mutateAsync(input as CommitmentMutationInput);
      });

      expect(mocks.pinCommitmentReason).toHaveBeenCalledWith(
        expect.objectContaining({ reason: input.reason })
      );
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: MODULE,
        abi: [],
        functionName: input.action,
        args,
        chainId: 42161,
      });
    });

    it("sends nothing when the reason could not be pinned", async () => {
      const { CommitmentReasonPinError } = await import("../modules/commitment-pooling/reasons");
      mocks.pinCommitmentReason.mockRejectedValue(
        new CommitmentReasonPinError(new Error("gateway down"))
      );
      const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }));

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            action: "cancelCommitment",
            commitmentId: 5n,
            reason: "Plans changed",
          })
        ).rejects.toBeInstanceOf(CommitmentReasonPinError);
      });
      expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    });

    it("still accepts a CID a caller already holds", async () => {
      const { result } = renderHookWithProviders(() => useCommitmentMutation({ chainId: 42161 }));

      await act(async () => {
        await result.current.mutateAsync({
          action: "cancelCommitment",
          commitmentId: 5n,
          reasonCID: "bafy-held",
        });
      });

      expect(mocks.pinCommitmentReason).not.toHaveBeenCalled();
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith(
        expect.objectContaining({ functionName: "cancelCommitment", args: [5n, "bafy-held"] })
      );
    });
  });
});
