/** @vitest-environment happy-dom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentSettlementController } from "../hooks/admin-ui/pool/useCommitmentSettlementController";
import type { CommitmentSettlementChainState } from "../modules/commitment-pooling/data-settlement-chain";
import type { PoolFundingSnapshot } from "../modules/commitment-pooling/pool-funding";
import { hashRecognitionSnapshot } from "../modules/commitment-pooling/settlement";
import { ReceiptWaitLimitError } from "../modules/transactions/types";
import type { Address } from "../types/domain";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "./test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const PAYER = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const PROVIDER = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const PAYER_SAFE = "0xe41a1e446644034f24a4b2e1bfb28fd414dbc66d" as Address;
const PROVIDER_SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
const VIEWER = "0x04d60647836bca09c37b379550038bdaafd82503" as Address;
const MARIA = "0x1111111111111111111111111111111111111111" as Address;
const JOAO = "0x2222222222222222222222222222222222222222" as Address;
const ZERO_HASH = `0x${"0".repeat(64)}`;
const G = 10n ** 18n;

const mocks = vi.hoisted(() => ({
  readChain: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  roles: ["steward"] as string[],
  canDispatchOrRetry: true,
  canRequeueOrCancel: true,
  pinReason: vi.fn(),
  fundingSnapshot: null as PoolFundingSnapshot | null,
  fundingRefetch: vi.fn(),
}));

vi.mock("../modules/commitment-pooling/data-settlement-chain", () => ({
  readCommitmentSettlementChainState: (...args: unknown[]) => mocks.readChain(...args),
}));
vi.mock("../hooks/commitment-pooling/useSettlement", () => ({
  useSettlementMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
  useSettlementOperationsCapabilities: () => ({
    canQueueFunding: false,
    canDispatchOrRetry: mocks.canDispatchOrRetry,
    canRequeueOrCancel: mocks.canRequeueOrCancel,
    showOperations: true,
    isLoading: false,
  }),
}));
vi.mock("../hooks/roles/useGardenRoles", () => ({
  useGardenRoles: () => ({ roles: mocks.roles, isLoading: false, error: null }),
}));
vi.mock("../hooks/commitment-pooling/usePoolFunding", () => ({
  usePoolFunding: () => ({
    snapshot: mocks.fundingSnapshot,
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    hasStaleBalance: false,
    lastReadAt: null,
    ledgerReadAt: null,
    refetch: mocks.fundingRefetch,
  }),
}));
vi.mock("../hooks/commitment-pooling/useProtocolPool", () => ({
  useProtocolPool: () => ({ poolId: 1n, rootGarden: PAYER, isRegistered: true }),
}));
vi.mock("../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => VIEWER }));
vi.mock("../hooks/app/useOnlineStatus", () => ({ useOnlineStatus: () => true }));
vi.mock("../hooks/commitment-pooling/useCommitmentPoolingAvailability", () => ({
  useCommitmentPoolingAvailability: () => ({
    status: "available",
    capability: availableCapability,
  }),
}));
vi.mock("../modules/commitment-pooling/reasons", () => ({
  pinCommitmentReason: (...args: unknown[]) => mocks.pinReason(...args),
}));

function beneficiaryCommitment() {
  return commitmentFixture({
    commitmentId: 9n,
    onchainState: "FULFILLED",
    state: "FULFILLED",
    direction: "REQUEST",
    counterpartyKind: "GARDEN",
    considerationRail: "CELO_SETTLEMENT",
    considerationAmount: 250n * G,
    payerGarden: PAYER,
    providerGarden: PROVIDER,
  });
}

function chainState(
  overrides: Partial<CommitmentSettlementChainState> = {}
): CommitmentSettlementChainState {
  return {
    commitment: {
      state: "FULFILLED",
      direction: "REQUEST",
      counterpartyKind: "GARDEN",
      payerGarden: PAYER,
      providerGarden: PROVIDER,
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: 250n * G,
      considerationSource: null,
      considerationToken: null,
      eligibleContributorCount: 1,
    },
    kind: "GARDEN_BENEFICIARY",
    payoutPlanId: null,
    plan: null,
    rows: [],
    disbursements: [],
    gardenerDeliveryEnabled: false,
    sourcePaused: false,
    payerAccount: { account: PAYER_SAFE, active: true, chainId: 42220 },
    beneficiaryAccount: { account: PROVIDER_SAFE, active: true, chainId: 42220 },
    recognitionReady: null,
    readAt: 1_756_000_000,
    ...overrides,
  };
}

describe("useCommitmentSettlementController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roles = ["steward"];
    mocks.canDispatchOrRetry = true;
    mocks.canRequeueOrCancel = true;
    mocks.isPending = false;
    mocks.mutateAsync.mockResolvedValue({ hash: "0xabc", sponsored: false });
    mocks.pinReason.mockResolvedValue("ipfs://reason");
    mocks.fundingSnapshot = null;
    mocks.fundingRefetch.mockImplementation(async () => ({
      data: mocks.fundingSnapshot,
      isError: false,
    }));
  });

  /** A prepared payout with one queued child, and the paying Safe as a funding read has it. */
  const queuedPayout = () =>
    chainState({
      payoutPlanId: 7n,
      plan: {
        payoutPlanId: 7n,
        payoutKind: "GARDEN_BENEFICIARY",
        status: "PENDING",
        finalized: true,
        source: PAYER_SAFE,
        token: null,
        declaredAmount: 250n * G,
        gardenRetainedAmount: 0n,
        contributorPayoutTotal: 0n,
        beneficiaryGarden: PROVIDER,
        beneficiaryRecipient: PROVIDER_SAFE,
        beneficiaryAmount: 250n * G,
        beneficiaryDisbursementId: 40n,
        payablePayoutCount: 1,
        preparedPayoutCount: 1,
        confirmedPayoutCount: 0,
        failedPayoutCount: 0,
        cancelledPayoutCount: 0,
      },
      disbursements: [
        {
          disbursementId: 40n,
          kind: "GARDEN_BENEFICIARY",
          contributor: null,
          recipient: PROVIDER_SAFE,
          amount: 250n * G,
          state: "QUEUED",
          batchId: null,
          attempt: 0,
          failureCode: null,
          cancelledFromState: null,
          dispatchedAt: null,
          acknowledgmentPending: false,
        },
      ],
    });
  const payerSafe = (balance: bigint) =>
    ({
      balance: { value: balance, blockNumber: 1n, blockTimestamp: 1, readAt: 1 },
      limits: {
        rolesAllowanceRemaining: 1_000n * G,
        periodAllowanceRemaining: 1_000n * G,
        maxTransferAmount: 1_000n * G,
        maxBatchAmount: null,
        batchSizeLimit: null,
      },
      disbursements: [{ id: "42161-40", disbursementId: 40n, state: "QUEUED", attempt: 0 }],
      feeQuotes: [
        { id: "42161-40", amount: 250n * G, fee: 0n, senderPays: false, recipient: PROVIDER_SAFE },
      ],
      feePolicy: { maxFeeBps: 100, maxFeeAmount: 50n * G },
      executorPaused: false,
      commandExecutors: [],
      executions: [],
      settlementUnavailableReasons: [],
    }) as unknown as PoolFundingSnapshot;

  it("holds a queued payout until the paying Safe's limits and the transfer's fee are read", async () => {
    mocks.readChain.mockResolvedValue(queuedPayout());
    const commitment = beneficiaryCommitment();
    const { result, rerender } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.workflow.currentStep).toBe("dispatch"));
    expect(result.current.workflow.blockers).toEqual(["funding-unread"]);
    expect(result.current.workflow.nextAction).toBeNull();

    mocks.fundingSnapshot = payerSafe(500n * G);
    rerender();
    expect(result.current.workflow.nextAction).toEqual({ kind: "dispatch", disbursementId: 40n });
  });

  it("reads the paying Safe again right before a dispatch, and refuses what no longer fits", async () => {
    mocks.readChain.mockResolvedValue(queuedPayout());
    mocks.fundingSnapshot = payerSafe(500n * G);
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() =>
      expect(result.current.workflow.nextAction).toEqual({ kind: "dispatch", disbursementId: 40n })
    );

    mocks.fundingRefetch.mockResolvedValue({ data: payerSafe(1n * G), isError: false });
    await act(async () => {
      await expect(result.current.acts.dispatch(40n)).rejects.toThrow(/balance/);
      await expect(result.current.acts.retry(40n)).rejects.toThrow(/balance/);
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.lastAct).toMatchObject({ kind: "retry", phase: "failed" });

    mocks.fundingRefetch.mockResolvedValue({ data: payerSafe(500n * G), isError: false });
    await act(async () => {
      await result.current.acts.dispatch(40n);
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      action: "dispatchDisbursement",
      disbursementId: 40n,
    });
  });

  it("reads the chain again with the funding read before a resend, and holds one the index is an attempt behind on", async () => {
    // The panel loaded with attempt 0 dispatched. Since then someone outside it requeued and
    // dispatched the transfer again (attempt 1), but the funding index still lists attempt 0,
    // whose command Celo recorded. The resend carries attempt 1's command, which Celo hasn't.
    const dispatched = (attempt: number) => {
      const state = queuedPayout();
      const [row] = state.disbursements;
      return {
        ...state,
        disbursements: [{ ...row!, state: "DISPATCHED" as const, attempt, dispatchedAt: 1 }],
      };
    };
    const key = (n: number) => `0x${String(n).repeat(64)}` as const;
    const indexed = (attempt: number, recorded: boolean) => {
      const read = payerSafe(500n * G);
      return {
        ...read,
        disbursements: [
          {
            id: "42161-40",
            disbursementId: 40n,
            state: "DISPATCHED",
            attempt,
            executionKey: key(attempt),
          },
        ],
        executions: recorded
          ? [
              {
                executionKey: key(attempt),
                status: "FAILED",
                createdAt: 1,
                acknowledgmentSent: false,
              },
            ]
          : [],
        commandExecutors: [{ executionKey: key(attempt), executor: null, paused: false }],
        feeQuotes: [
          { id: "42161-40", amount: 250n * G, fee: 0n, senderPays: true, recipient: PROVIDER_SAFE },
        ],
      } as unknown as PoolFundingSnapshot;
    };
    mocks.readChain.mockResolvedValue(dispatched(0));
    mocks.fundingSnapshot = indexed(0, true);
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));

    mocks.readChain.mockResolvedValue(dispatched(1));
    await act(async () => {
      await expect(result.current.acts.retry(40n)).rejects.toThrow(/limits_unread/);
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    // Once the index lists attempt 1, the resend goes through its own checks.
    mocks.fundingSnapshot = indexed(1, false);
    await act(async () => {
      await result.current.acts.retry(40n);
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ action: "retryCommand", disbursementId: 40n });
  });

  it("holds a step a Safe took as a proposal until the chain shows it ran", async () => {
    mocks.readChain.mockResolvedValue(chainState());
    mocks.mutateAsync.mockResolvedValue({
      hash: "safe-proposal",
      sponsored: false,
      confirmation: "pending",
    });
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() =>
      expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" })
    );

    await act(async () => {
      await result.current.acts.createPlan();
    });
    // Never "confirmed": nothing has run, and the same step can't be proposed twice.
    expect(result.current.lastAct).toMatchObject({ kind: "create-plan", phase: "proposed" });
    expect(result.current.workflow.nextAction).toBeNull();
    expect(result.current.workflow.blockers).toEqual(["proposal-pending"]);

    mocks.readChain.mockResolvedValue(
      chainState({
        payoutPlanId: 7n,
        plan: {
          payoutPlanId: 7n,
          payoutKind: "GARDEN_BENEFICIARY",
          status: "DRAFT",
          finalized: false,
          source: PAYER_SAFE,
          token: null,
          declaredAmount: 250n * G,
          gardenRetainedAmount: 0n,
          contributorPayoutTotal: 0n,
          beneficiaryGarden: PROVIDER,
          beneficiaryRecipient: PROVIDER_SAFE,
          beneficiaryAmount: 250n * G,
          beneficiaryDisbursementId: null,
          payablePayoutCount: 1,
          preparedPayoutCount: 0,
          confirmedPayoutCount: 0,
          failedPayoutCount: 0,
          cancelledPayoutCount: 0,
        },
      })
    );
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.lastAct?.phase).toBe("confirmed"));
    expect(result.current.workflow.nextAction).toEqual({ kind: "finalize-plan", payoutPlanId: 7n });
  });

  it("reads the chain for an eligible commitment and offers plan creation to the payer steward", async () => {
    mocks.readChain.mockResolvedValue(chainState());
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({
        chainId: 42161,
        commitment,
        detail: commitmentDetailFixture({ commitment }),
      })
    );

    await waitFor(() => expect(result.current.chainRead).toBe("ready"));
    expect(result.current.eligibility.eligible).toBe(true);
    expect(result.current.kind).toBe("GARDEN_BENEFICIARY");
    expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" });
    expect(result.current.authority).toEqual({
      isPayerSteward: true,
      canDispatchOrRetry: true,
      canRequeueOrCancel: true,
      resolved: true,
    });
    expect(result.current.beneficiaryGarden).toBe(PROVIDER);
    expect(result.current.declaredAmount).toBe(250n * G);

    await act(async () => {
      await result.current.acts.createPlan();
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      action: "createCommitmentPayoutPlan",
      commitmentId: 9n,
      recognitionEntries: [],
      recognitionSnapshotHash: ZERO_HASH,
    });
    expect(result.current.lastAct).toMatchObject({
      kind: "create-plan",
      phase: "confirmed",
      hash: "0xabc",
    });
    // One initial read, one fresh read before creating, one read-back after.
    expect(mocks.readChain).toHaveBeenCalledTimes(3);
  });

  it("never recreates a plan the chain already holds", async () => {
    mocks.readChain.mockResolvedValueOnce(chainState()).mockResolvedValue(
      chainState({
        payoutPlanId: 7n,
        plan: {
          payoutPlanId: 7n,
          payoutKind: "GARDEN_BENEFICIARY",
          status: "DRAFT",
          finalized: false,
          source: PAYER_SAFE,
          token: null,
          declaredAmount: 250n * G,
          gardenRetainedAmount: 0n,
          contributorPayoutTotal: 0n,
          beneficiaryGarden: PROVIDER,
          beneficiaryRecipient: PROVIDER_SAFE,
          beneficiaryAmount: 250n * G,
          beneficiaryDisbursementId: null,
          payablePayoutCount: 1,
          preparedPayoutCount: 0,
          confirmedPayoutCount: 0,
          failedPayoutCount: 0,
          cancelledPayoutCount: 0,
        },
      })
    );
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));
    expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" });

    await act(async () => {
      await expect(result.current.acts.createPlan()).rejects.toThrow(/already exists \(#7\)/);
    });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.plan?.payoutPlanId).toBe(7n));
    expect(result.current.workflow.nextAction).toEqual({ kind: "finalize-plan", payoutPlanId: 7n });
  });

  it("holds a step past its receipt limit as still confirming, never failed", async () => {
    // It went out and may still land: read as failed, the step would be offered again (PRD-1551).
    mocks.readChain.mockResolvedValue(chainState());
    mocks.mutateAsync.mockRejectedValue(
      new ReceiptWaitLimitError(120_000, { hash: `0x${"ab".repeat(32)}` })
    );
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({
        chainId: 42161,
        commitment: beneficiaryCommitment(),
        detail: null,
      })
    );
    await waitFor(() =>
      expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" })
    );

    await act(async () => {
      await expect(result.current.acts.createPlan()).rejects.toThrow(ReceiptWaitLimitError);
    });
    expect(result.current.lastAct).toMatchObject({
      kind: "create-plan",
      phase: "still-confirming",
    });
    expect(result.current.workflow.nextAction).toBeNull();
  });

  it("keeps the displayed state on the chain's answer when a transaction is rejected", async () => {
    mocks.readChain.mockResolvedValue(chainState());
    mocks.mutateAsync.mockRejectedValue(new Error("User rejected the request"));
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));

    await act(async () => {
      await expect(result.current.acts.createPlan()).rejects.toThrow("User rejected");
    });
    expect(result.current.lastAct).toMatchObject({ kind: "create-plan", phase: "failed" });
    expect(result.current.plan).toBeNull();
    expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" });
    expect(mocks.readChain).toHaveBeenCalledTimes(3);
  });

  it("hands the module the ascending recognition vector and its hash for a contributor plan", async () => {
    mocks.readChain.mockResolvedValue(
      chainState({
        kind: "CONTRIBUTOR_CONSIDERATION",
        commitment: {
          ...chainState().commitment,
          direction: "OFFER",
          counterpartyKind: "INDIVIDUAL",
        },
        recognitionReady: true,
        beneficiaryAccount: null,
      })
    );
    const commitment = beneficiaryCommitment();
    const offer = {
      ...commitment,
      direction: "OFFER" as const,
      counterpartyKind: "INDIVIDUAL" as const,
    };
    const detail = commitmentDetailFixture({
      commitment: offer,
      contributors: [
        contributorFixture({ commitmentId: 9n, contributor: JOAO, recognitionWeightBps: 4000 }),
        contributorFixture({ commitmentId: 9n, contributor: MARIA, recognitionWeightBps: 6000 }),
        contributorFixture({
          commitmentId: 9n,
          contributor: "0x3333333333333333333333333333333333333333" as Address,
          active: false,
          recognitionWeightBps: 0,
        }),
      ],
    });
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment: offer, detail })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));
    const entries = [
      { contributor: MARIA, recognitionWeightBps: 6000 },
      { contributor: JOAO, recognitionWeightBps: 4000 },
    ];
    expect(mocks.readChain).toHaveBeenCalledWith({
      chainId: 42161,
      commitmentId: 9n,
      recognitionEntries: entries,
    });
    expect(result.current.workflow.nextAction).toEqual({ kind: "create-plan" });

    await act(async () => {
      await result.current.acts.createPlan();
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      action: "createCommitmentPayoutPlan",
      commitmentId: 9n,
      recognitionEntries: entries,
      recognitionSnapshotHash: hashRecognitionSnapshot({
        chainId: 42161,
        commitmentId: 9n,
        entries,
      }),
    });
  });

  it("does not read the chain for a commitment that cannot carry a payout plan", async () => {
    const commitment = commitmentFixture({
      commitmentId: 5n,
      onchainState: "ACCEPTED",
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: 10n * G,
      payerGarden: PAYER,
    });
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    expect(result.current.eligibility).toEqual({
      eligible: false,
      kind: "CONTRIBUTOR_CONSIDERATION",
      blockers: ["not-fulfilled"],
    });
    expect(result.current.chainRead).toBe("ready");
    expect(mocks.readChain).not.toHaveBeenCalled();
  });

  it("withholds the plan acts from a reader who does not steward the payer garden", async () => {
    mocks.roles = ["gardener"];
    mocks.readChain.mockResolvedValue(chainState());
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));
    expect(result.current.authority.isPayerSteward).toBe(false);
    expect(result.current.workflow.nextAction).toBeNull();
    expect(result.current.workflow.blockers).toEqual(["missing-payer-steward"]);
  });

  it("pins the reason before cancelling a disbursement", async () => {
    mocks.readChain.mockResolvedValue(chainState());
    const commitment = beneficiaryCommitment();
    const { result } = renderHookWithProviders(() =>
      useCommitmentSettlementController({ chainId: 42161, commitment, detail: null })
    );
    await waitFor(() => expect(result.current.chainRead).toBe("ready"));
    await act(async () => {
      await result.current.acts.cancel(40n, "Wrong recipient Safe");
    });
    expect(mocks.pinReason).toHaveBeenCalledWith({
      reason: "Wrong recipient Safe",
      gardenAddress: PAYER,
      source: "cancelDisbursement",
    });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      action: "cancelDisbursement",
      disbursementId: 40n,
      reasonCID: "ipfs://reason",
    });
  });
});
