/** @vitest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentSettlementController } from "../hooks/admin-ui/pool/useCommitmentSettlementController";
import type { CommitmentSettlementChainState } from "../modules/commitment-pooling/data-settlement-chain";
import { hashRecognitionSnapshot } from "../modules/commitment-pooling/settlement";
import type { Address } from "../types/domain";
import {
  availableCapability,
  commitmentDetailFixture,
  commitmentFixture,
  contributorFixture,
} from "./test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "./test-utils";

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
    snapshot: null,
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isError: false,
    hasStaleBalance: false,
    lastReadAt: null,
    ledgerReadAt: null,
    refetch: vi.fn(async () => undefined),
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
    mocks.mutateAsync.mockResolvedValue("0xabc");
    mocks.pinReason.mockResolvedValue("ipfs://reason");
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
