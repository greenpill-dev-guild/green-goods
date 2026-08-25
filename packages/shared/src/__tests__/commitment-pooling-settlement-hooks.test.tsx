/** @vitest-environment jsdom */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../config/query-keys";
import {
  type SettlementMutationInput,
  useSettlementMutation,
  useSettlementOperationsCapabilities,
} from "../hooks/commitment-pooling/useSettlement";
import {
  useCommitmentPayoutPlan,
  useSettlementAccount,
  useSettlementConfigurations,
  useSettlementSubject,
} from "../hooks/commitment-pooling/useSettlementQueries";
import { useSettlementWalletTransfer } from "../hooks/commitment-pooling/useSettlementWalletTransfer";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const TOKEN = "0x3333333333333333333333333333333333333333";
const SETTLEMENT = "0x15c8f6cf25aba2161cc04719b4c4a93c4146935d";

const mocks = await vi.hoisted(async () => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  settlementAddress: "0x15c8f6cf25aba2161cc04719b4c4a93c4146935d",
  senderAvailable: true,
  sender: (await import("@green-goods/shared/testing")).createMockTransactionSender(),
  mutationErrorHandler: vi.fn(),
  roles: vi.fn(),
  useReadContract: vi.fn(),
  ownerRead: { data: undefined, isLoading: false, error: null } as Record<string, unknown>,
  dispatcherRead: { data: undefined, isLoading: false, error: null } as Record<string, unknown>,
  getSettlementConfigurations: vi.fn(),
  getSettlementAccount: vi.fn(),
  getSettlementSubject: vi.fn(),
  getCommitmentPayoutPlan: vi.fn(),
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getSettlementConfigurations: mocks.getSettlementConfigurations,
  getSettlementAccount: mocks.getSettlementAccount,
  getSettlementSubject: mocks.getSettlementSubject,
  getCommitmentPayoutPlan: mocks.getCommitmentPayoutPlan,
}));

vi.mock("../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => 42161,
}));

vi.mock("../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => (mocks.senderAvailable ? mocks.sender : undefined),
}));

vi.mock("../hooks/roles/useGardenRoles", () => ({
  useGardenRoles: (...args: unknown[]) => mocks.roles(...args),
}));

vi.mock("wagmi", () => ({
  useReadContract: (...args: unknown[]) => mocks.useReadContract(...args),
}));

vi.mock("../utils/blockchain/contracts", () => ({
  SettlementModuleABI: [],
  getNetworkContracts: () => ({ settlementModule: mocks.settlementAddress }),
}));

vi.mock("../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "MockContractError" }),
}));

vi.mock("../utils/errors/mutation-error-handler", () => ({
  createMutationErrorHandler: () => mocks.mutationErrorHandler,
}));

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

function settlementSubject(overrides: Record<string, unknown> = {}) {
  return {
    subject: {
      id: "42161-disbursement-4",
      state: "DISPATCHED",
      dispatchedAt: 1_000,
      failureCode: null,
      cancelledFromState: null,
      ...overrides,
    },
    command: null,
    acknowledgment: null,
    execution: null,
  };
}

describe("settlement query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.getSettlementConfigurations.mockResolvedValue([{ id: "configuration" }]);
    mocks.getSettlementAccount.mockResolvedValue({ account: { id: "account" }, route: null });
    mocks.getSettlementSubject.mockResolvedValue(settlementSubject());
    mocks.getCommitmentPayoutPlan.mockResolvedValue({ plan: { id: "plan" } });
  });

  it("returns configuration, account, subject, and payout-plan data", async () => {
    const configurations = renderHookWithProviders(() =>
      useSettlementConfigurations({ chainId: 42161 })
    );
    const account = renderHookWithProviders(() =>
      useSettlementAccount({ chainId: 42161, garden: ACCOUNT })
    );
    const subject = renderHookWithProviders(() =>
      useSettlementSubject({
        chainId: 42161,
        isBatch: false,
        subjectId: 4n,
        now: 1_000,
        gardenerDeliveryEnabled: true,
      })
    );
    const payoutPlan = renderHookWithProviders(() =>
      useCommitmentPayoutPlan({ chainId: 42161, payoutPlanId: 5n })
    );

    await waitFor(() => expect(configurations.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(account.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(subject.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(payoutPlan.result.current.isSuccess).toBe(true));
    expect(configurations.result.current.configurations).toEqual([{ id: "configuration" }]);
    expect(account.result.current.detail).toEqual({ account: { id: "account" }, route: null });
    expect(subject.result.current.delivery).toEqual({ status: "dispatched" });
    expect(payoutPlan.result.current.payoutPlan).toEqual({ id: "plan" });
  });

  it("derives acknowledgment-pending and delayed delivery from indexed execution state", async () => {
    mocks.getSettlementSubject.mockResolvedValueOnce({
      ...settlementSubject(),
      execution: { status: "SUCCESS", acknowledgmentSent: false },
    });
    const acknowledgment = renderHookWithProviders(() =>
      useSettlementSubject({ chainId: 42161, isBatch: false, subjectId: 4n, now: 3_000 })
    );
    await waitFor(() => expect(acknowledgment.result.current.isSuccess).toBe(true));
    expect(acknowledgment.result.current.delivery).toEqual({
      status: "executed-acknowledgment-pending",
    });
    acknowledgment.unmount();

    mocks.getSettlementSubject.mockResolvedValueOnce(settlementSubject());
    const delayed = renderHookWithProviders(() =>
      useSettlementSubject({
        chainId: 42161,
        isBatch: true,
        subjectId: 5n,
        now: 3_000,
        delayAfterSeconds: 30,
      })
    );
    await waitFor(() => expect(delayed.result.current.isSuccess).toBe(true));
    expect(delayed.result.current.delivery).toEqual({ status: "delivery-delayed" });
  });

  it("preserves an indexed settlement failure code", async () => {
    mocks.getSettlementSubject.mockResolvedValue(
      settlementSubject({ state: "FAILED", failureCode: 7 })
    );
    const { result } = renderHookWithProviders(() =>
      useSettlementSubject({ chainId: 42161, isBatch: false, subjectId: 4n })
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.delivery).toEqual({ status: "failed", failureCode: 7 });
  });

  it("keeps every settlement read disabled until pooling is available", async () => {
    mocks.capability = undefined;
    const configurations = renderHookWithProviders(() =>
      useSettlementConfigurations({ chainId: 11155111 })
    );
    const account = renderHookWithProviders(() =>
      useSettlementAccount({ chainId: 11155111, garden: ACCOUNT })
    );
    const subject = renderHookWithProviders(() =>
      useSettlementSubject({ chainId: 11155111, isBatch: false, subjectId: 4n })
    );
    const payoutPlan = renderHookWithProviders(() =>
      useCommitmentPayoutPlan({ chainId: 11155111, payoutPlanId: 5n })
    );

    for (const hook of [configurations, account, subject, payoutPlan]) {
      await waitFor(() => expect(hook.result.current.fetchStatus).toBe("idle"));
      expect(hook.result.current.availability).toEqual({ status: "unknown-chain" });
    }
    expect(mocks.getSettlementConfigurations).not.toHaveBeenCalled();
    expect(mocks.getSettlementAccount).not.toHaveBeenCalled();
    expect(mocks.getSettlementSubject).not.toHaveBeenCalled();
    expect(mocks.getCommitmentPayoutPlan).not.toHaveBeenCalled();
  });

  it("surfaces settlement indexer failures", async () => {
    const error = new Error("indexer unavailable");
    mocks.getSettlementConfigurations.mockRejectedValue(error);
    const { result } = renderHookWithProviders(() =>
      useSettlementConfigurations({ chainId: 42161 })
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.configurations).toEqual([]);
  });
});

describe("useSettlementMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.senderAvailable = true;
    mocks.settlementAddress = SETTLEMENT;
    mocks.sender.sendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: true });
  });

  const actions: Array<{ input: SettlementMutationInput; args: readonly unknown[] }> = [
    { input: { action: "queueFunding", garden: ACCOUNT, amount: 10n }, args: [ACCOUNT, 10n] },
    {
      input: { action: "recordFunding", commitmentId: 1n, funder: ACCOUNT, refundAccount: OTHER },
      args: [1n, ACCOUNT, OTHER],
    },
    {
      input: {
        action: "recordFundingDeposit",
        fundingId: 2n,
        amount: 10n,
        depositReference: "0x1234",
      },
      args: [2n, 10n, "0x1234"],
    },
    { input: { action: "consumeFunding", fundingId: 2n }, args: [2n] },
    { input: { action: "queueFundingRefund", fundingId: 2n }, args: [2n] },
    {
      input: {
        action: "createCommitmentPayoutPlan",
        commitmentId: 1n,
        recognitionEntries: [{ contributor: ACCOUNT, recognitionWeightBps: 10_000 }],
        recognitionSnapshotHash: "0x1234",
      },
      args: [1n, [{ contributor: ACCOUNT, recognitionWeightBps: 10_000 }], "0x1234"],
    },
    {
      input: {
        action: "setContributorPayouts",
        payoutPlanId: 3n,
        gardenRetainedAmount: 1n,
        payouts: [{ contributor: ACCOUNT, amount: 9n }],
        reasonCID: "ipfs://reason",
      },
      args: [3n, 1n, [{ contributor: ACCOUNT, amount: 9n }], "ipfs://reason"],
    },
    { input: { action: "finalizeCommitmentPayoutPlan", payoutPlanId: 3n }, args: [3n] },
    { input: { action: "prepareGardenBeneficiaryPayout", payoutPlanId: 3n }, args: [3n] },
    {
      input: { action: "prepareContributorPayout", payoutPlanId: 3n, contributor: ACCOUNT },
      args: [3n, ACCOUNT],
    },
    { input: { action: "createBatch", disbursementIds: [4n, 5n] }, args: [[4n, 5n]] },
    { input: { action: "dispatchDisbursement", disbursementId: 4n }, args: [4n] },
    { input: { action: "retryCommand", disbursementId: 4n }, args: [4n] },
    { input: { action: "requeue", disbursementId: 4n }, args: [4n] },
    { input: { action: "dispatchBatch", batchId: 5n }, args: [5n] },
    { input: { action: "retryBatchCommand", batchId: 5n }, args: [5n] },
    {
      input: { action: "cancelDisbursement", disbursementId: 4n, reasonCID: "ipfs://reason" },
      args: [4n, "ipfs://reason"],
    },
    {
      input: { action: "cancelBatch", batchId: 5n, reasonCID: "ipfs://reason" },
      args: [5n, "ipfs://reason"],
    },
    { input: { action: "setGardenerDeliveryEnabled", enabled: true }, args: [true] },
    { input: { action: "setAccountActive", garden: ACCOUNT, active: true }, args: [ACCOUNT, true] },
    {
      input: {
        action: "updateSettlementRecovery",
        garden: ACCOUNT,
        recoveryOwners: [ACCOUNT, OTHER, TOKEN],
      },
      args: [ACCOUNT, [ACCOUNT, OTHER, TOKEN]],
    },
  ];

  it("maps every settlement action to its exact contract arguments and invalidates pooling reads", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const { result } = renderHookWithProviders(() => useSettlementMutation({ chainId: 42161 }), {
      queryClient,
    });

    for (const testCase of actions) {
      await act(async () => {
        await result.current.mutateAsync(testCase.input);
      });
      expect(mocks.sender.sendContractCall).toHaveBeenLastCalledWith({
        address: SETTLEMENT,
        abi: [],
        functionName: testCase.input.action,
        args: testCase.args,
        chainId: 42161,
      });
    }
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.commitmentPooling.all(42161) });
  });

  it("uses the application chain when no explicit mutation chain is supplied", async () => {
    const { result } = renderHookWithProviders(() => useSettlementMutation());

    await act(async () => {
      await result.current.mutateAsync({ action: "setGardenerDeliveryEnabled", enabled: true });
    });
    expect(mocks.sender.sendContractCall).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42161 })
    );
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
      name: "zero settlement module",
      configure: () => {
        mocks.settlementAddress = "0x0000000000000000000000000000000000000000";
      },
      message: "Settlement is not deployed on this chain",
    },
  ])("fails closed for $name and reports action context", async ({ configure, message }) => {
    configure();
    const { result } = renderHookWithProviders(() => useSettlementMutation({ chainId: 42161 }));
    const request = { action: "dispatchDisbursement", disbursementId: 4n } as const;

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toThrow(message);
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: {
        action: "dispatchDisbursement",
        chainId: 42161,
        parsedErrorName: "MockContractError",
      },
    });
  });
});

describe("useSettlementOperationsCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAvailable();
    mocks.settlementAddress = SETTLEMENT;
    mocks.ownerRead = { data: ACCOUNT.toUpperCase(), isLoading: false, error: null };
    mocks.dispatcherRead = { data: OTHER, isLoading: false, error: null };
    mocks.useReadContract.mockImplementation((input: { functionName: string }) =>
      input.functionName === "owner" ? mocks.ownerRead : mocks.dispatcherRead
    );
    mocks.roles.mockReturnValue({ roles: [], isLoading: false, error: null });
  });

  it("maps settlement owner, steward, dispatcher, and deployer authority", () => {
    const owner = renderHookWithProviders(() =>
      useSettlementOperationsCapabilities({
        chainId: 42161,
        account: ACCOUNT,
        protocolGarden: ACCOUNT,
        executorGarden: OTHER,
        isDeployer: false,
      })
    );
    expect(owner.result.current).toMatchObject({
      canQueueFunding: true,
      canOperateSettlement: true,
      showOperations: true,
      isLoading: false,
    });
    owner.unmount();

    mocks.ownerRead = { data: OTHER, isLoading: false, error: null };
    mocks.dispatcherRead = { data: ACCOUNT.toUpperCase(), isLoading: false, error: null };
    mocks.roles.mockImplementation((garden: string) => ({
      roles: garden === ACCOUNT ? ["steward"] : [],
      isLoading: false,
      error: null,
    }));
    const stewardDispatcher = renderHookWithProviders(() =>
      useSettlementOperationsCapabilities({
        chainId: 42161,
        account: ACCOUNT,
        protocolGarden: ACCOUNT,
        executorGarden: OTHER,
        isDeployer: false,
      })
    );
    expect(stewardDispatcher.result.current).toMatchObject({
      canQueueFunding: true,
      canOperateSettlement: true,
      showOperations: true,
    });
  });

  it("fails closed while authority is disabled, loading, or errored", () => {
    mocks.ownerRead = { data: ACCOUNT, isLoading: true, error: null };
    const unresolved = renderHookWithProviders(() =>
      useSettlementOperationsCapabilities({
        chainId: 42161,
        account: ACCOUNT,
        protocolGarden: null,
        executorGarden: null,
        isDeployer: true,
      })
    );
    expect(unresolved.result.current).toMatchObject({
      canQueueFunding: false,
      canOperateSettlement: false,
      showOperations: true,
      isLoading: true,
    });
    unresolved.unmount();

    mocks.ownerRead = { data: ACCOUNT, isLoading: false, error: new Error("RPC failed") };
    const errored = renderHookWithProviders(() =>
      useSettlementOperationsCapabilities({
        chainId: 42161,
        account: ACCOUNT,
        protocolGarden: null,
        executorGarden: null,
        isDeployer: false,
      })
    );
    expect(errored.result.current).toMatchObject({
      canQueueFunding: false,
      canOperateSettlement: false,
      showOperations: false,
    });
    errored.unmount();

    mocks.capability = undefined;
    const unavailable = renderHookWithProviders(() =>
      useSettlementOperationsCapabilities({
        chainId: 11155111,
        account: ACCOUNT,
        protocolGarden: null,
        executorGarden: null,
        isDeployer: false,
      })
    );
    expect(unavailable.result.current).toMatchObject({
      canQueueFunding: false,
      canOperateSettlement: false,
      showOperations: false,
    });
    expect(mocks.useReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: { enabled: false } })
    );
  });
});

describe("useSettlementWalletTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.senderAvailable = true;
    mocks.sender.sendContractCall.mockResolvedValue({ hash: "0xabc", sponsored: true });
  });

  function renderTransfer(
    overrides: Partial<Parameters<typeof useSettlementWalletTransfer>[0]> = {}
  ) {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const hook = renderHookWithProviders(
      () =>
        useSettlementWalletTransfer({
          primaryChainId: 42161,
          chainId: 42220,
          indexedGardenerDeliveryEnabled: true,
          mainnetEvidenceReady: true,
          ...overrides,
        }),
      { queryClient }
    );
    return { ...hook, invalidate };
  }

  it("sends an enabled positive transfer and invalidates settlement configuration", async () => {
    const { result, invalidate } = renderTransfer();
    expect(result.current.enabled).toBe(true);

    await act(async () => {
      await result.current.mutateAsync({ token: TOKEN, to: ACCOUNT, amount: 10n });
    });
    expect(mocks.sender.sendContractCall).toHaveBeenCalledWith({
      address: TOKEN,
      abi: expect.any(Array),
      functionName: "transfer",
      args: [ACCOUNT, 10n],
      chainId: 42220,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.commitmentPooling.settlementConfiguration(42220),
    });
  });

  it.each([
    {
      name: "account-profile chain mismatch",
      overrides: { chainId: 421614 },
      configure: () => {},
      amount: 10n,
      message: "Gardener delivery is unavailable",
    },
    {
      name: "missing sender",
      overrides: {},
      configure: () => {
        mocks.senderAvailable = false;
      },
      amount: 10n,
      message: "Transaction sender is unavailable",
    },
    {
      name: "non-positive amount",
      overrides: {},
      configure: () => {},
      amount: 0n,
      message: "Transfer amount must be positive",
    },
  ])("fails closed for $name and reports transfer context", async (testCase) => {
    testCase.configure();
    const { result } = renderTransfer(testCase.overrides);
    const request = { token: TOKEN, to: ACCOUNT, amount: testCase.amount };

    await act(async () => {
      await expect(result.current.mutateAsync(request)).rejects.toThrow(testCase.message);
    });
    expect(mocks.sender.sendContractCall).not.toHaveBeenCalled();
    expect(mocks.mutationErrorHandler).toHaveBeenCalledWith(expect.any(Error), {
      metadata: {
        action: "transfer",
        chainId: testCase.overrides.chainId ?? 42220,
        token: TOKEN,
        parsedErrorName: "MockContractError",
      },
    });
  });
});
