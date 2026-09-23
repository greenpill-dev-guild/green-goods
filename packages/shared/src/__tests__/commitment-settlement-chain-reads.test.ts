import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashRecognitionSnapshot } from "../modules/commitment-pooling/settlement";
import type { Address } from "../types/domain";

const PAYER = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const PROVIDER = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const PAYER_SAFE = "0xe41a1e446644034f24a4b2e1bfb28fd414dbc66d" as Address;
const PROVIDER_SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
const TOKEN = "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as Address;
const MARIA = "0x1111111111111111111111111111111111111111" as Address;
const OWNER = "0x1b9ac97ea62f69521a14cbe6f45eb24ad6612c19" as Address;
const SETTLEMENT = "0x15c8f6cf25aba2161cc04719b4c4a93c4146935d";
const POOLING = "0x6bb5b0fd70b6771b0e955fef37f8bd2ce911470a";
const ZERO = "0x0000000000000000000000000000000000000000";
const G = 10n ** 18n;

const mocks = vi.hoisted(() => ({
  readContract: vi.fn(),
}));

vi.mock("@wagmi/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@wagmi/core")>()),
  readContract: mocks.readContract,
}));
vi.mock("../config/appkit", () => ({ getWagmiConfig: () => ({ mocked: true }) }));
vi.mock("../utils/blockchain/contracts", () => ({
  SettlementModuleABI: [{ marker: "settlement" }],
  CommitmentPoolingModuleABI: [{ marker: "pooling" }],
  getNetworkContracts: () => ({ settlementModule: SETTLEMENT, commitmentPoolingModule: POOLING }),
}));

const { readCommitmentSettlementChainState } = await import(
  "../modules/commitment-pooling/data-settlement-chain"
);
const { readSettlementOperationsState } = await import(
  "../modules/commitment-pooling/data-settlement-operations"
);

type Call = { address: string; functionName: string; args?: readonly unknown[] };

function commitmentStruct(overrides: Record<string, unknown> = {}) {
  return {
    state: 5, // Fulfilled
    direction: 1, // Request
    counterpartyKind: 0, // Garden
    payerGarden: PAYER,
    providerGarden: PROVIDER,
    consideration: { rail: 2, source: ZERO, token: ZERO, amount: 250n * G },
    eligibleContributorCount: 1,
    ...overrides,
  };
}

function account(accountAddress: string, active = true) {
  return { chainId: 42220n, account: accountAddress, active };
}

function answer(table: Record<string, unknown | ((call: Call) => unknown)>) {
  mocks.readContract.mockImplementation(async (_config: unknown, call: Call) => {
    const key = `${call.functionName}`;
    const value = table[key];
    if (value === undefined) throw new Error(`unexpected read ${key}`);
    return typeof value === "function" ? (value as (call: Call) => unknown)(call) : value;
  });
}

describe("readCommitmentSettlementChainState", () => {
  beforeEach(() => {
    mocks.readContract.mockReset();
  });

  it("reads a fresh beneficiary commitment without touching plan children", async () => {
    answer({
      getCommitment: commitmentStruct(),
      payoutPlanOfCommitment: 0n,
      gardenerDeliveryEnabled: false,
      paused: false,
      settlementAccountOf: (call: Call) =>
        call.args?.[0] === PAYER ? account(PAYER_SAFE) : account(PROVIDER_SAFE),
    });

    const state = await readCommitmentSettlementChainState({ chainId: 42161, commitmentId: 9n });

    expect(state.kind).toBe("GARDEN_BENEFICIARY");
    expect(state.payoutPlanId).toBeNull();
    expect(state.plan).toBeNull();
    expect(state.commitment).toMatchObject({
      state: "FULFILLED",
      direction: "REQUEST",
      counterpartyKind: "GARDEN",
      considerationRail: "CELO_SETTLEMENT",
      considerationAmount: 250n * G,
      payerGarden: PAYER,
    });
    expect(state.payerAccount).toEqual({ account: PAYER_SAFE, active: true, chainId: 42220 });
    expect(state.beneficiaryAccount).toEqual({
      account: PROVIDER_SAFE,
      active: true,
      chainId: 42220,
    });
    expect(state.gardenerDeliveryEnabled).toBe(false);
    expect(state.sourcePaused).toBe(false);
    expect(state.recognitionReady).toBeNull();
    const functions = mocks.readContract.mock.calls.map(([, call]) => (call as Call).functionName);
    expect(functions).not.toContain("getPayoutPlan");
    expect(functions).not.toContain("validateRecognitionSnapshot");
  });

  it("asks the module whether the recognition vector is canonical before a contributor plan exists", async () => {
    const entries = [{ contributor: MARIA, recognitionWeightBps: 10_000 }];
    answer({
      getCommitment: commitmentStruct({ direction: 0, counterpartyKind: 1 }),
      payoutPlanOfCommitment: 0n,
      gardenerDeliveryEnabled: true,
      paused: false,
      settlementAccountOf: account(PAYER_SAFE),
      validateRecognitionSnapshot: (call: Call) => call.args?.[2],
    });

    const ready = await readCommitmentSettlementChainState({
      chainId: 42161,
      commitmentId: 9n,
      recognitionEntries: entries,
    });
    expect(ready.kind).toBe("CONTRIBUTOR_CONSIDERATION");
    expect(ready.recognitionReady).toBe(true);
    const validate = mocks.readContract.mock.calls
      .map(([, call]) => call as Call)
      .find((call: Call) => call.functionName === "validateRecognitionSnapshot");
    expect(validate?.address).toBe(POOLING);
    expect(validate?.args).toEqual([
      9n,
      entries,
      hashRecognitionSnapshot({ chainId: 42161, commitmentId: 9n, entries }),
    ]);

    answer({
      getCommitment: commitmentStruct({ direction: 0, counterpartyKind: 1 }),
      payoutPlanOfCommitment: 0n,
      gardenerDeliveryEnabled: true,
      paused: false,
      settlementAccountOf: account(PAYER_SAFE),
      validateRecognitionSnapshot: () => {
        throw new Error("InvalidAllocation()");
      },
    });
    const stale = await readCommitmentSettlementChainState({
      chainId: 42161,
      commitmentId: 9n,
      recognitionEntries: entries,
    });
    expect(stale.recognitionReady).toBe(false);
  });

  it("resumes from the plan the chain holds: struct, status, rows, children and acknowledgement", async () => {
    answer({
      getCommitment: commitmentStruct(),
      payoutPlanOfCommitment: 7n,
      gardenerDeliveryEnabled: false,
      paused: false,
      settlementAccountOf: (call: Call) =>
        call.args?.[0] === PAYER ? account(PAYER_SAFE) : account(PROVIDER_SAFE, false),
      getPayoutPlan: {
        commitmentId: 9n,
        providerGarden: PROVIDER,
        payerGarden: PAYER,
        source: PAYER_SAFE,
        token: TOKEN,
        payoutKind: 3,
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
        finalized: true,
      },
      payoutPlanStatus: 1,
      payoutContributors: [],
      getDisbursement: {
        commitmentId: 9n,
        payoutPlanId: 7n,
        contributor: ZERO,
        garden: PROVIDER,
        executorGarden: PAYER,
        kind: 3,
        source: PAYER_SAFE,
        recipient: PROVIDER_SAFE,
        token: TOKEN,
        amount: 250n * G,
        state: 2,
        batchId: 0n,
        attempt: 1,
        dispatchedAt: 1_756_000_000n,
        failureCode: 0,
        cancelledFromState: 0,
      },
      isAcknowledgmentPending: true,
    });

    const state = await readCommitmentSettlementChainState({ chainId: 42161, commitmentId: 9n });
    expect(state.payoutPlanId).toBe(7n);
    expect(state.plan).toMatchObject({
      payoutPlanId: 7n,
      payoutKind: "GARDEN_BENEFICIARY",
      status: "PENDING",
      finalized: true,
      beneficiaryDisbursementId: 40n,
      beneficiaryRecipient: PROVIDER_SAFE,
      token: TOKEN,
    });
    expect(state.rows).toEqual([]);
    expect(state.disbursements).toEqual([
      expect.objectContaining({
        disbursementId: 40n,
        kind: "GARDEN_BENEFICIARY",
        state: "DISPATCHED",
        recipient: PROVIDER_SAFE,
        amount: 250n * G,
        batchId: null,
        attempt: 1,
        dispatchedAt: 1_756_000_000,
        acknowledgmentPending: true,
        cancelledFromState: null,
      }),
    ]);
    expect(state.beneficiaryAccount).toEqual({
      account: PROVIDER_SAFE,
      active: false,
      chainId: 42220,
    });
  });

  it("maps contributor rows and their prepared children", async () => {
    answer({
      getCommitment: commitmentStruct({ direction: 0, counterpartyKind: 1 }),
      payoutPlanOfCommitment: 8n,
      gardenerDeliveryEnabled: true,
      paused: true,
      settlementAccountOf: account(PAYER_SAFE),
      getPayoutPlan: {
        payoutKind: 0,
        declaredAmount: 100n * G,
        gardenRetainedAmount: 0n,
        contributorPayoutTotal: 100n * G,
        beneficiaryGarden: ZERO,
        beneficiaryRecipient: ZERO,
        beneficiaryAmount: 0n,
        beneficiaryDisbursementId: 0n,
        payablePayoutCount: 1,
        preparedPayoutCount: 1,
        confirmedPayoutCount: 1,
        failedPayoutCount: 0,
        cancelledPayoutCount: 0,
        finalized: true,
        source: PAYER_SAFE,
        token: TOKEN,
      },
      payoutPlanStatus: 3,
      payoutContributors: [MARIA],
      contributorPayoutOf: {
        contributor: MARIA,
        recognitionWeightBps: 10_000,
        paymentWeightBps: 10_000,
        amount: 100n * G,
        recipient: MARIA,
        disbursementId: 41n,
      },
      getDisbursement: {
        contributor: MARIA,
        kind: 0,
        recipient: MARIA,
        amount: 100n * G,
        state: 3,
        batchId: 0n,
        attempt: 1,
        dispatchedAt: 1_756_000_000n,
        failureCode: 0,
        cancelledFromState: 0,
      },
    });

    const state = await readCommitmentSettlementChainState({ chainId: 42161, commitmentId: 10n });
    expect(state.plan?.status).toBe("COMPLETE");
    expect(state.sourcePaused).toBe(true);
    expect(state.rows).toEqual([
      {
        contributor: MARIA,
        recipient: MARIA,
        amount: 100n * G,
        recognitionWeightBps: 10_000,
        paymentWeightBps: 10_000,
        disbursementId: 41n,
      },
    ]);
    expect(state.disbursements[0]).toMatchObject({
      disbursementId: 41n,
      kind: "CONTRIBUTOR_CONSIDERATION",
      contributor: MARIA,
      state: "CONFIRMED",
      acknowledgmentPending: false,
    });
    expect(state.recognitionReady).toBeNull();
  });
});

describe("readSettlementOperationsState", () => {
  it("reads owner, dispatcher, the delivery gate and the pause flag from the module", async () => {
    answer({
      owner: OWNER,
      dispatcher: ZERO,
      gardenerDeliveryEnabled: false,
      paused: false,
    });
    const state = await readSettlementOperationsState(42161);
    expect(state).toMatchObject({
      owner: OWNER,
      dispatcher: null,
      gardenerDeliveryEnabled: false,
      sourcePaused: false,
    });
    expect(
      mocks.readContract.mock.calls.every(([, call]) => (call as Call).address === SETTLEMENT)
    ).toBe(true);
  });
});
