import { encodeAbiParameters, keccak256 } from "viem";
import { describe, expect, it } from "vitest";

import { hashRecognitionSnapshot } from "../modules/commitment-pooling/settlement";
import {
  type SettlementChainDisbursement,
  type SettlementChainPlan,
  type SettlementWorkflowInput,
  selectSettlementEligibility,
  selectSettlementPayoutKind,
  selectSettlementWorkflow,
} from "../modules/commitment-pooling/settlement-workflow";
import type { Address } from "../types/domain";
import { availableCapability, commitmentFixture } from "./test-utils/commitment-pooling-fixtures";

const PAYER = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const PROVIDER = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const SAFE = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
const MARIA = "0x1111111111111111111111111111111111111111" as Address;
const JOAO = "0x2222222222222222222222222222222222222222" as Address;
const VIEWER = "0x04d60647836bca09c37b379550038bdaafd82503" as Address;
const G = 10n ** 18n;

const available = { status: "available", capability: availableCapability } as const;

function priced(overrides = {}) {
  return commitmentFixture({
    onchainState: "FULFILLED",
    state: "FULFILLED",
    direction: "REQUEST",
    counterpartyKind: "GARDEN",
    considerationRail: "CELO_SETTLEMENT",
    considerationAmount: 250n * G,
    payerGarden: PAYER,
    providerGarden: PROVIDER,
    ...overrides,
  });
}

function plan(overrides: Partial<SettlementChainPlan> = {}): SettlementChainPlan {
  return {
    payoutPlanId: 7n,
    payoutKind: "GARDEN_BENEFICIARY",
    status: "DRAFT",
    finalized: false,
    source: SAFE,
    token: "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a" as Address,
    declaredAmount: 250n * G,
    gardenRetainedAmount: 0n,
    contributorPayoutTotal: 0n,
    beneficiaryGarden: PROVIDER,
    beneficiaryRecipient: SAFE,
    beneficiaryAmount: 250n * G,
    beneficiaryDisbursementId: null,
    payablePayoutCount: 1,
    preparedPayoutCount: 0,
    confirmedPayoutCount: 0,
    failedPayoutCount: 0,
    cancelledPayoutCount: 0,
    ...overrides,
  };
}

function disbursement(
  overrides: Partial<SettlementChainDisbursement> = {}
): SettlementChainDisbursement {
  return {
    disbursementId: 40n,
    kind: "GARDEN_BENEFICIARY",
    contributor: null,
    recipient: SAFE,
    amount: 250n * G,
    state: "QUEUED",
    batchId: null,
    attempt: 0,
    failureCode: null,
    cancelledFromState: null,
    dispatchedAt: null,
    acknowledgmentPending: false,
    ...overrides,
  };
}

function input(overrides: Partial<SettlementWorkflowInput> = {}): SettlementWorkflowInput {
  return {
    kind: "GARDEN_BENEFICIARY",
    plan: null,
    rows: [],
    disbursements: [],
    gardenerDeliveryEnabled: false,
    sourcePaused: false,
    payerAccountActive: true,
    beneficiaryAccountActive: true,
    recognitionReady: null,
    authority: {
      viewer: VIEWER,
      isPayerSteward: true,
      canDispatchOrRetry: true,
      canRequeueOrCancel: true,
    },
    isOnline: true,
    chainRead: "ready",
    isActing: false,
    now: 1_756_000_000,
    ...overrides,
  };
}

function step(workflow: ReturnType<typeof selectSettlementWorkflow>, id: string) {
  const found = workflow.steps.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing step ${id}`);
  return found;
}

describe("settlement eligibility", () => {
  it("names the payout shape from the record the way PlanLib does", () => {
    expect(selectSettlementPayoutKind({ direction: "REQUEST", counterpartyKind: "GARDEN" })).toBe(
      "GARDEN_BENEFICIARY"
    );
    expect(
      selectSettlementPayoutKind({ direction: "REQUEST", counterpartyKind: "INDIVIDUAL" })
    ).toBe("CONTRIBUTOR_CONSIDERATION");
    expect(selectSettlementPayoutKind({ direction: "OFFER", counterpartyKind: "GARDEN" })).toBe(
      "CONTRIBUTOR_CONSIDERATION"
    );
  });

  it("admits only a fulfilled, Celo-priced commitment with a known payer on an available chain", () => {
    expect(selectSettlementEligibility({ commitment: priced(), availability: available })).toEqual({
      eligible: true,
      kind: "GARDEN_BENEFICIARY",
      blockers: [],
    });
    expect(
      selectSettlementEligibility({
        commitment: priced({ onchainState: "ACCEPTED" }),
        availability: available,
      }).blockers
    ).toEqual(["not-fulfilled"]);
    expect(
      selectSettlementEligibility({
        commitment: priced({ considerationRail: "ARBITRUM_EXTERNAL" }),
        availability: available,
      }).blockers
    ).toEqual(["no-celo-consideration"]);
    expect(
      selectSettlementEligibility({
        commitment: priced({ considerationAmount: 0n }),
        availability: available,
      }).blockers
    ).toEqual(["no-celo-consideration"]);
    expect(
      selectSettlementEligibility({
        commitment: priced({ payerGarden: null }),
        availability: available,
      }).blockers
    ).toEqual(["payer-garden-unknown"]);
    expect(
      selectSettlementEligibility({
        commitment: priced(),
        availability: {
          status: "unavailable",
          reason: "not-integrated",
          capability: availableCapability,
        },
      }).blockers
    ).toEqual(["pooling-unavailable"]);
    expect(
      selectSettlementEligibility({ commitment: null, availability: available }).blockers
    ).toEqual(["not-fulfilled"]);
  });

  it("resumes a recorded plan even when the index has not mirrored the price yet", () => {
    expect(
      selectSettlementEligibility({
        commitment: priced({ considerationAmount: null, payoutPlanId: 7n }),
        availability: available,
      })
    ).toEqual({ eligible: true, kind: "GARDEN_BENEFICIARY", blockers: [] });
  });
});

describe("protocol → garden Safe sequence", () => {
  it("starts at plan creation and offers it to the payer steward", () => {
    const workflow = selectSettlementWorkflow(input());
    expect(workflow.steps.map((entry) => [entry.id, entry.status])).toEqual([
      ["create-plan", "current"],
      ["finalize-plan", "upcoming"],
      ["prepare-payout", "upcoming"],
      ["dispatch", "upcoming"],
      ["acknowledgement", "upcoming"],
    ]);
    expect(workflow.nextAction).toEqual({ kind: "create-plan" });
    expect(workflow.complete).toBe(false);
  });

  it("never offers plan creation again once the chain holds a plan", () => {
    const workflow = selectSettlementWorkflow(input({ plan: plan() }));
    expect(step(workflow, "create-plan").status).toBe("done");
    expect(workflow.currentStep).toBe("finalize-plan");
    expect(workflow.nextAction).toEqual({ kind: "finalize-plan", payoutPlanId: 7n });
  });

  it("prepares the beneficiary payout after finalization without a gardener-delivery gate", () => {
    const workflow = selectSettlementWorkflow(
      input({ plan: plan({ finalized: true, status: "PENDING" }), gardenerDeliveryEnabled: false })
    );
    expect(workflow.currentStep).toBe("prepare-payout");
    expect(workflow.blockers).toEqual([]);
    expect(workflow.nextAction).toEqual({ kind: "prepare-beneficiary", payoutPlanId: 7n });
  });

  it("dispatches the queued child, then waits for the Celo acknowledgement, then completes", () => {
    const prepared = plan({
      finalized: true,
      status: "PENDING",
      beneficiaryDisbursementId: 40n,
      preparedPayoutCount: 1,
    });
    const queued = selectSettlementWorkflow(
      input({ plan: prepared, disbursements: [disbursement()] })
    );
    expect(queued.currentStep).toBe("dispatch");
    expect(queued.nextAction).toEqual({ kind: "dispatch", disbursementId: 40n });
    expect(queued.disbursements[0]?.display).toBe("queued");
    expect(queued.disbursements[0]?.actions).toEqual({
      dispatch: true,
      retry: false,
      requeue: false,
      cancel: true,
    });

    const dispatched = selectSettlementWorkflow(
      input({
        plan: prepared,
        disbursements: [
          disbursement({
            state: "DISPATCHED",
            dispatchedAt: 1_755_999_900,
            acknowledgmentPending: true,
          }),
        ],
      })
    );
    expect(step(dispatched, "dispatch").status).toBe("done");
    expect(dispatched.currentStep).toBe("acknowledgement");
    expect(dispatched.nextAction).toBeNull();
    expect(dispatched.disbursements[0]?.display).toBe("acknowledgement-pending");
    expect(dispatched.disbursements[0]?.actions.retry).toBe(true);

    const delayed = selectSettlementWorkflow(
      input({
        plan: prepared,
        disbursements: [disbursement({ state: "DISPATCHED", dispatchedAt: 1_755_990_000 })],
      })
    );
    expect(delayed.disbursements[0]?.display).toBe("delivery-delayed");

    const confirmed = selectSettlementWorkflow(
      input({
        plan: plan({ ...prepared, status: "COMPLETE", confirmedPayoutCount: 1 }),
        disbursements: [disbursement({ state: "CONFIRMED" })],
      })
    );
    expect(confirmed.steps.every((entry) => entry.status === "done")).toBe(true);
    expect(confirmed.nextAction).toBeNull();
    expect(confirmed.complete).toBe(true);
    expect(confirmed.disbursements[0]?.display).toBe("confirmed");
  });

  it("surfaces failed and cancelled children with only the acts the module still accepts", () => {
    const prepared = plan({
      finalized: true,
      status: "PARTIAL",
      beneficiaryDisbursementId: 40n,
      preparedPayoutCount: 1,
    });
    const failed = selectSettlementWorkflow(
      input({ plan: prepared, disbursements: [disbursement({ state: "FAILED", failureCode: 7 })] })
    );
    expect(failed.disbursements[0]).toMatchObject({
      display: "failed",
      retryable: true,
      actions: { dispatch: false, retry: false, requeue: true, cancel: true },
    });
    expect(failed.currentStep).toBe("dispatch");
    expect(failed.nextAction).toBeNull();

    const cancelled = selectSettlementWorkflow(
      input({
        plan: plan({ ...prepared, status: "FAILED", cancelledPayoutCount: 1 }),
        disbursements: [disbursement({ state: "CANCELLED", cancelledFromState: "FAILED" })],
      })
    );
    expect(cancelled.disbursements[0]).toMatchObject({
      display: "cancelled",
      actions: { dispatch: false, retry: false, requeue: false, cancel: false },
    });
    expect(cancelled.complete).toBe(false);

    const batched = selectSettlementWorkflow(
      input({ plan: prepared, disbursements: [disbursement({ batchId: 3n })] })
    );
    expect(batched.disbursements[0]?.actions).toMatchObject({ dispatch: false, cancel: false });
  });
});

describe("garden → member sequence", () => {
  const rows = [
    {
      contributor: MARIA,
      recipient: MARIA,
      amount: 150n * G,
      recognitionWeightBps: 6000,
      paymentWeightBps: 6000,
      disbursementId: null,
    },
    {
      contributor: JOAO,
      recipient: JOAO,
      amount: 100n * G,
      recognitionWeightBps: 4000,
      paymentWeightBps: 4000,
      disbursementId: null,
    },
  ];
  const contributorPlan = plan({
    payoutKind: "CONTRIBUTOR_CONSIDERATION",
    beneficiaryGarden: null,
    beneficiaryRecipient: null,
    beneficiaryAmount: 0n,
    contributorPayoutTotal: 250n * G,
    payablePayoutCount: 2,
  });

  it("blocks plan creation until the module accepts the recognition vector", () => {
    const unready = selectSettlementWorkflow(
      input({ kind: "CONTRIBUTOR_CONSIDERATION", recognitionReady: false })
    );
    expect(unready.blockers).toEqual(["recognition-unready"]);
    expect(unready.nextAction).toBeNull();
    const ready = selectSettlementWorkflow(
      input({ kind: "CONTRIBUTOR_CONSIDERATION", recognitionReady: true })
    );
    expect(ready.nextAction).toEqual({ kind: "create-plan" });
    expect(ready.steps.map((entry) => entry.id)).toContain("contributor-split");
  });

  it("stays blocked at preparation while gardener delivery is disabled", () => {
    const workflow = selectSettlementWorkflow(
      input({
        kind: "CONTRIBUTOR_CONSIDERATION",
        plan: { ...contributorPlan, finalized: true, status: "PENDING" },
        rows,
        gardenerDeliveryEnabled: false,
      })
    );
    expect(workflow.currentStep).toBe("prepare-payout");
    expect(workflow.blockers).toEqual(["gardener-delivery-disabled"]);
    expect(workflow.nextAction).toBeNull();
  });

  it("prepares members one row at a time once gardener delivery is enabled", () => {
    const first = selectSettlementWorkflow(
      input({
        kind: "CONTRIBUTOR_CONSIDERATION",
        plan: { ...contributorPlan, finalized: true, status: "PENDING" },
        rows,
        gardenerDeliveryEnabled: true,
      })
    );
    expect(first.nextAction).toEqual({
      kind: "prepare-contributor",
      payoutPlanId: 7n,
      contributor: MARIA,
    });

    const second = selectSettlementWorkflow(
      input({
        kind: "CONTRIBUTOR_CONSIDERATION",
        plan: { ...contributorPlan, finalized: true, status: "PENDING", preparedPayoutCount: 1 },
        rows: [{ ...rows[0]!, disbursementId: 41n }, rows[1]!],
        gardenerDeliveryEnabled: true,
        disbursements: [
          disbursement({
            disbursementId: 41n,
            kind: "CONTRIBUTOR_CONSIDERATION",
            contributor: MARIA,
            recipient: MARIA,
            amount: 150n * G,
          }),
        ],
      })
    );
    expect(second.currentStep).toBe("prepare-payout");
    expect(second.nextAction).toEqual({
      kind: "prepare-contributor",
      payoutPlanId: 7n,
      contributor: JOAO,
    });
  });

  it("treats a finalized plan with nothing payable as complete without preparing anything", () => {
    const workflow = selectSettlementWorkflow(
      input({
        kind: "CONTRIBUTOR_CONSIDERATION",
        plan: { ...contributorPlan, finalized: true, status: "COMPLETE", payablePayoutCount: 0 },
        rows: [],
      })
    );
    expect(workflow.steps.every((entry) => entry.status === "done")).toBe(true);
    expect(workflow.complete).toBe(true);
  });
});

describe("authority and connection gates", () => {
  it("withholds plan acts from readers who do not steward the payer garden", () => {
    const workflow = selectSettlementWorkflow(
      input({
        authority: {
          viewer: VIEWER,
          isPayerSteward: false,
          canDispatchOrRetry: true,
          canRequeueOrCancel: true,
        },
      })
    );
    expect(workflow.blockers).toEqual(["missing-payer-steward"]);
    expect(workflow.nextAction).toBeNull();
  });

  it("withholds dispatch from readers who cannot operate settlement and while the source is paused", () => {
    const prepared = plan({
      finalized: true,
      status: "PENDING",
      beneficiaryDisbursementId: 40n,
      preparedPayoutCount: 1,
    });
    const noOperator = selectSettlementWorkflow(
      input({
        plan: prepared,
        disbursements: [disbursement()],
        authority: {
          viewer: VIEWER,
          isPayerSteward: true,
          canDispatchOrRetry: false,
          canRequeueOrCancel: false,
        },
      })
    );
    expect(noOperator.blockers).toEqual(["missing-operator"]);
    expect(noOperator.disbursements[0]?.actions.dispatch).toBe(false);

    const paused = selectSettlementWorkflow(
      input({ plan: prepared, disbursements: [disbursement()], sourcePaused: true })
    );
    expect(paused.blockers).toEqual(["source-paused"]);
    expect(paused.disbursements[0]?.actions.dispatch).toBe(false);
  });

  it("names a disconnected wallet, an offline device, an in-flight act and an unread chain", () => {
    expect(
      selectSettlementWorkflow(
        input({
          authority: {
            viewer: undefined,
            isPayerSteward: false,
            canDispatchOrRetry: false,
            canRequeueOrCancel: false,
          },
        })
      ).blockers
    ).toEqual(["wallet-disconnected", "missing-payer-steward"]);
    expect(selectSettlementWorkflow(input({ isOnline: false })).blockers).toEqual(["offline"]);
    expect(selectSettlementWorkflow(input({ isActing: true })).blockers).toEqual(["acting"]);
    expect(selectSettlementWorkflow(input({ chainRead: "pending" })).blockers).toEqual([
      "chain-read-pending",
    ]);
    expect(selectSettlementWorkflow(input({ chainRead: "failed" })).blockers).toEqual([
      "chain-read-failed",
    ]);
  });

  it("refuses creation and preparation while a settlement account is inactive", () => {
    expect(selectSettlementWorkflow(input({ payerAccountActive: false })).blockers).toEqual([
      "payer-account-inactive",
    ]);
    expect(selectSettlementWorkflow(input({ beneficiaryAccountActive: false })).blockers).toEqual([
      "beneficiary-account-inactive",
    ]);
    expect(
      selectSettlementWorkflow(
        input({
          kind: "CONTRIBUTOR_CONSIDERATION",
          recognitionReady: true,
          beneficiaryAccountActive: false,
        })
      ).blockers
    ).toEqual([]);
  });
});

describe("hashRecognitionSnapshot", () => {
  const entries = [
    { contributor: MARIA, recognitionWeightBps: 6000 },
    { contributor: JOAO, recognitionWeightBps: 4000 },
  ];

  it("hashes abi.encode(chainId, commitmentId, entries) exactly as RecognitionLib does", () => {
    const expected = keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "uint256" },
          {
            type: "tuple[]",
            components: [
              { name: "contributor", type: "address" },
              { name: "recognitionWeightBps", type: "uint16" },
            ],
          },
        ],
        [42161n, 9n, entries]
      )
    );
    expect(hashRecognitionSnapshot({ chainId: 42161, commitmentId: 9n, entries })).toBe(expected);
  });

  it("changes with order, weight, chain and commitment", () => {
    const base = hashRecognitionSnapshot({ chainId: 42161, commitmentId: 9n, entries });
    expect(
      hashRecognitionSnapshot({ chainId: 42161, commitmentId: 9n, entries: [...entries].reverse() })
    ).not.toBe(base);
    expect(
      hashRecognitionSnapshot({
        chainId: 42161,
        commitmentId: 9n,
        entries: [entries[0]!, { ...entries[1]!, recognitionWeightBps: 4001 }],
      })
    ).not.toBe(base);
    expect(hashRecognitionSnapshot({ chainId: 42220, commitmentId: 9n, entries })).not.toBe(base);
    expect(hashRecognitionSnapshot({ chainId: 42161, commitmentId: 10n, entries })).not.toBe(base);
  });
});
