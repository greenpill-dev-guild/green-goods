/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import { useCommitmentDialogController } from "../hooks/admin-ui/pool/useCommitmentDialogController";
import type { CommitmentMutationInput } from "../hooks/commitment-pooling/useCommitmentMutations";
import { useCommitmentMutation } from "../hooks/commitment-pooling/useCommitmentMutations";
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
import { useCommitmentPoolingAvailability } from "../hooks/commitment-pooling/useCommitmentPoolingAvailability";
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
  getViewerConfirmedCommitmentIds: vi.fn(),
  viewer: "0x2222222222222222222222222222222222222222" as string | null,
  jobs: { enqueue: vi.fn(), isPending: false },
  queueState: { pendingCommitmentIds: new Set<string>() },
  protocolPool: { poolId: null as bigint | null, rootGarden: null, isRegistered: false },
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
  getViewerConfirmedCommitmentIds: mocks.getViewerConfirmedCommitmentIds,
}));

vi.mock("../hooks/roles/useGardenRoles", () => ({
  useGardenRoles: (...args: unknown[]) => mocks.roles(...args),
}));

// The dialog controller's remaining dependencies, held still so the acts it
// offers are decided by the record, its pool and its cycle — nothing ambient.
vi.mock("../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => mocks.viewer,
}));

vi.mock("../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));

vi.mock("../hooks/assessment/useGardenAssessments", () => ({
  useGardenAssessments: () => ({ data: [], isLoading: false }),
}));

vi.mock("../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadataFor: () => null,
}));

vi.mock("../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => mocks.jobs,
}));

vi.mock("../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => mocks.queueState,
}));

vi.mock("../hooks/commitment-pooling/useCommitmentReason", () => ({
  useCommitmentReason: () => ({ reason: null, isLoading: false, isUnavailable: false }),
}));

vi.mock("../hooks/commitment-pooling/useProtocolPool", () => ({
  useProtocolPool: () => mocks.protocolPool,
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
    const { result } = renderHookWithProviders(() => testCase.render());
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

    mocks.roles.mockReturnValue({ roles: ["steward"], isLoading: false, error: null });
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
        consideration: { rail: 1, amount: 2n, source: VIEWER, token: ACCOUNT },
      },
      args: [1n, { rail: 1, amount: 2n, source: VIEWER, token: ACCOUNT }],
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

describe("useCommitmentDialogController", () => {
  const STEWARD = "0x2222222222222222222222222222222222222222";
  const LEAD = "0x4444444444444444444444444444444444444444";
  const TAKER = "0x5555555555555555555555555555555555555555";

  function detail(commitment: Record<string, unknown> = {}, contributors?: unknown[]) {
    return {
      commitment: {
        id: "42161-9",
        chainId: 42161,
        commitmentId: 9n,
        creationSeen: true,
        onchainState: "ACCEPTED",
        state: "ACCEPTED",
        derivedState: "EVIDENCE_SUBMITTED",
        commitmentType: "SUPPORT_SERVICE",
        direction: "OFFER",
        counterpartyKind: "INDIVIDUAL",
        creator: LEAD,
        leadProvider: LEAD,
        counterparty: TAKER,
        confirmers: [],
        confirmationThreshold: 1,
        protocolFallbackEnabled: false,
        evidenceCount: 2,
        approvedUnits: 0n,
        targetUnits: 1n,
        cycleId: 12n,
        dueDate: null,
        requiresAssessment: false,
        assessmentUID: null,
        contributorCount: 1,
        contributorsFrozen: false,
        preDisputeState: null,
        ...commitment,
      },
      requirements: [],
      contributors: contributors ?? [
        {
          contributor: LEAD,
          active: true,
          isLead: true,
          approvedWorkCredits: 0,
          evidenceCredits: 1,
          uncountedLinkedWorkCount: 0,
        },
      ],
      assignments: [],
      workAttributions: [],
      evidenceAttributions: [],
      claimRequests: [],
      counterpartCommitments: [],
    };
  }

  function render() {
    return renderHookWithProviders(() =>
      useCommitmentDialogController({ chainId: 42161, garden: ACCOUNT, commitmentId: 9n })
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.viewer = STEWARD;
    mocks.queueState = { pendingCommitmentIds: new Set<string>() };
    mocks.protocolPool = { poolId: null, rootGarden: null, isRegistered: false };
    mocks.roles.mockReturnValue({ roles: ["steward"], isLoading: false, error: null });
    mocks.getCommitmentDetail.mockResolvedValue(detail());
    mocks.getCommitmentPools.mockResolvedValue([{ ...pool, state: "OPEN" }]);
    mocks.getCommitmentCycleDetail.mockResolvedValue({
      cycle: { cycleId: 12n, state: "OPEN", endTime: null },
    });
    mocks.getCommitmentActivity.mockResolvedValue([]);
    mocks.getViewerConfirmedCommitmentIds.mockResolvedValue([]);
  });

  it("keeps cancellation open while the pool is paused, and holds readying and confirming back", async () => {
    mocks.getCommitmentPools.mockResolvedValue([{ ...pool, state: "PAUSED" }]);
    const { result } = render();

    await waitFor(() => expect(result.current.commitment).not.toBeNull());
    // TerminalLib.sol:11-12 — a pause never blocks the wind-down path.
    expect(result.current.poolPaused).toBe(true);
    expect(result.current.can.cancel).toBe(true);
    expect(result.current.can.markReady).toBe(false);
    expect(result.current.can.sendForConfirmation).toBe(false);
  });

  it("offers a dispute only in the three states raiseDispute accepts", async () => {
    const states: Array<[string, boolean]> = [
      ["ACCEPTED", true],
      ["READY_FOR_CONFIRMATION", true],
      ["EXPIRED", true],
      // TerminalLib.sol:91-96 never takes a fulfilled record.
      ["FULFILLED", false],
      ["CANCELLED", false],
    ];

    for (const [onchainState, expected] of states) {
      mocks.getCommitmentDetail.mockResolvedValue(detail({ onchainState, state: onchainState }));
      const { result, unmount } = render();
      await waitFor(() => expect(result.current.commitment?.onchainState).toBe(onchainState));
      expect(result.current.can.raiseDispute, onchainState).toBe(expected);
      unmount();
    }
  });

  it("withholds submission until every gate the chain applies is clear", async () => {
    const ready = render();
    await waitFor(() => expect(ready.result.current.can.sendForConfirmation).toBe(true));
    ready.unmount();

    const blocked: Array<[string, () => void]> = [
      [
        "a cycle that is no longer open",
        () =>
          mocks.getCommitmentCycleDetail.mockResolvedValue({
            cycle: { cycleId: 12n, state: "RECONCILED", endTime: null },
          }),
      ],
      [
        "a required assessment that is not attached",
        () => mocks.getCommitmentDetail.mockResolvedValue(detail({ requiresAssessment: true })),
      ],
      [
        "a roster carrying no verified credit",
        () =>
          mocks.getCommitmentDetail.mockResolvedValue(
            detail({}, [
              {
                contributor: LEAD,
                active: true,
                isLead: true,
                approvedWorkCredits: 0,
                evidenceCredits: 0,
                uncountedLinkedWorkCount: 0,
              },
            ])
          ),
      ],
      [
        "no confirmer the ordinary path can still reach",
        () =>
          mocks.getCommitmentDetail.mockResolvedValue(
            detail({ counterparty: LEAD, protocolFallbackEnabled: false })
          ),
      ],
      [
        "no proof at all",
        () => mocks.getCommitmentDetail.mockResolvedValue(detail({ evidenceCount: 0 })),
      ],
    ];

    for (const [name, configure] of blocked) {
      configure();
      const { result, unmount } = render();
      await waitFor(() => expect(result.current.commitment).not.toBeNull());
      expect(result.current.can.sendForConfirmation, name).toBe(false);
      unmount();
      mocks.getCommitmentDetail.mockResolvedValue(detail());
      mocks.getCommitmentCycleDetail.mockResolvedValue({
        cycle: { cycleId: 12n, state: "OPEN", endTime: null },
      });
    }
  });

  // ConfirmLib.markReadyForConfirmation never reads the commitment type or the
  // requirement counters, so the steward override is the promised recovery for a
  // Work-backed record whose requirements stalled — and the only one it has.
  it("offers the steward override on a stalled DomainImpact record, on the gates freezeAndReady keeps", async () => {
    const stalled = {
      commitmentType: "DOMAIN_IMPACT",
      // The confirmer must stay reachable, so the taker cannot be on the roster.
      counterparty: TAKER,
    };
    const requirements = [{ requirementIndex: 0, requiredCount: 3, approvedCount: 1 }];

    mocks.getCommitmentDetail.mockResolvedValue({
      ...detail(stalled),
      requirements,
    });
    const offered = render();
    await waitFor(() => expect(offered.result.current.commitment).not.toBeNull());
    expect(offered.result.current.can.markReady).toBe(true);
    // The waiver stops at the proof policy: ordinary submission still refuses.
    expect(offered.result.current.can.sendForConfirmation).toBe(false);
    offered.unmount();

    // freezeAndReady still reverts NoEligibleContributors without verified credit.
    mocks.getCommitmentDetail.mockResolvedValue({
      ...detail(stalled, [
        {
          contributor: LEAD,
          active: true,
          isLead: true,
          approvedWorkCredits: 0,
          evidenceCredits: 0,
          uncountedLinkedWorkCount: 0,
        },
      ]),
      requirements,
    });
    const uncredited = render();
    await waitFor(() => expect(uncredited.result.current.commitment).not.toBeNull());
    expect(uncredited.result.current.can.markReady).toBe(false);
    uncredited.unmount();

    // And RecognitionPolicyUnavailable once the cycle has closed.
    mocks.getCommitmentDetail.mockResolvedValue({ ...detail(stalled), requirements });
    mocks.getCommitmentCycleDetail.mockResolvedValue({
      cycle: { cycleId: 12n, state: "RECONCILED", endTime: null },
    });
    const closed = render();
    await waitFor(() => expect(closed.result.current.commitment).not.toBeNull());
    expect(closed.result.current.can.markReady).toBe(false);
    closed.unmount();
  });

  // ConfirmLib.confirmFulfillment reverts AlreadyConfirmed on a repeat, and a
  // threshold above one keeps the record ready in between.
  it("stops offering ordinary confirmation to a confirmer who already signed", async () => {
    mocks.getCommitmentDetail.mockResolvedValue(
      detail({
        onchainState: "READY_FOR_CONFIRMATION",
        state: "READY_FOR_CONFIRMATION",
        derivedState: "READY_FOR_CONFIRMATION",
        direction: "REQUEST",
        creator: STEWARD,
        leadProvider: TAKER,
        counterparty: TAKER,
        confirmationThreshold: 2,
        contributorsFrozen: true,
      })
    );

    const first = render();
    await waitFor(() => expect(first.result.current.confirmation.allowed).toBe(true));
    expect(first.result.current.can.confirmOrdinary).toBe(true);
    first.unmount();

    mocks.getViewerConfirmedCommitmentIds.mockResolvedValue(["9"]);
    const again = render();
    await waitFor(() => expect(again.result.current.commitment).not.toBeNull());
    await waitFor(() => expect(again.result.current.confirmation.reason).toBe("already-confirmed"));
    expect(again.result.current.can.confirmOrdinary).toBe(false);
  });

  // GuardLib.requirePoolState(Open) and freezeAndReady's Open-cycle check both
  // gate on state a failed read cannot report, so the acts wait for the read.
  it("fails closed on the acts a failed pool or cycle read cannot vouch for", async () => {
    mocks.getCommitmentDetail.mockResolvedValue(
      detail({ onchainState: "OFFERED", state: "OFFERED" })
    );
    mocks.getCommitmentPools.mockRejectedValue(new Error("indexer down"));
    const noPool = render();
    await waitFor(() => expect(noPool.result.current.isError).toBe(true));
    expect(noPool.result.current.poolPaused).toBe(false);
    expect(noPool.result.current.can.acceptClaim).toBe(false);
    expect(noPool.result.current.can.declineClaim).toBe(false);
    noPool.unmount();

    mocks.getCommitmentPools.mockResolvedValue([{ ...pool, state: "OPEN" }]);
    mocks.getCommitmentDetail.mockResolvedValue(detail());
    mocks.getCommitmentCycleDetail.mockRejectedValue(new Error("indexer down"));
    const noCycle = render();
    await waitFor(() => expect(noCycle.result.current.isError).toBe(true));
    expect(noCycle.result.current.can.sendForConfirmation).toBe(false);
    expect(noCycle.result.current.can.markReady).toBe(false);
    // The wind-down path a pause never blocks is untouched by an unread cycle.
    expect(noCycle.result.current.can.cancel).toBe(true);
  });

  // TerminalLib.raiseDispute takes the creator, the counterparty, a named
  // confirmer or a pool steward. On a garden-claimed Request the lead provider
  // is `requestedBy` and the counterparty is the claiming garden, so the lead is
  // none of the four — and normalizeConfirmers has dropped them from the group.
  it("withholds a dispute from a lead provider the contract would reject", async () => {
    const gardenClaimed = {
      direction: "REQUEST",
      counterpartyKind: "GARDEN",
      creator: TAKER,
      leadProvider: STEWARD,
      counterparty: ACCOUNT,
      confirmers: [],
    };
    mocks.roles.mockReturnValue({ roles: [], isLoading: false, error: null });
    mocks.getCommitmentDetail.mockResolvedValue(detail(gardenClaimed));

    const lead = render();
    await waitFor(() => expect(lead.result.current.commitment).not.toBeNull());
    expect(lead.result.current.seat).toBe("provider");
    expect(lead.result.current.can.raiseDispute).toBe(false);
    lead.unmount();

    // The same record read by its creator, who the contract does authorize.
    mocks.getCommitmentDetail.mockResolvedValue(detail({ ...gardenClaimed, creator: STEWARD }));
    const creator = render();
    await waitFor(() => expect(creator.result.current.commitment).not.toBeNull());
    expect(creator.result.current.can.raiseDispute).toBe(true);
    creator.unmount();

    // As is a named confirmer who is neither party.
    mocks.getCommitmentDetail.mockResolvedValue(
      detail({ ...gardenClaimed, confirmers: [STEWARD] })
    );
    const named = render();
    await waitFor(() => expect(named.result.current.commitment).not.toBeNull());
    expect(named.result.current.can.raiseDispute).toBe(true);
  });

  it("reports a failed timeline read instead of rendering an empty one", async () => {
    mocks.getCommitmentActivity.mockRejectedValue(new Error("indexer down"));
    const { result } = render();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.events).toEqual([]);
    expect(result.current.notFound).toBe(false);
  });

  it("names a chain without pooling as unavailable rather than a missing record", async () => {
    mocks.capability = {
      deployment: "deployed",
      activation: "active",
      integration: "not-integrated",
      availability: "deployed-not-available",
      evidence: [],
      verified_at: "2026-08-16",
    };
    const { result } = render();

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(mocks.getCommitmentDetail).not.toHaveBeenCalled();
    expect(result.current.notFound).toBe(false);
    expect(result.current.commitment).toBeNull();
  });
});
