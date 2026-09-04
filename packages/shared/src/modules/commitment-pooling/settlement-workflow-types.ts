/**
 * Settlement workflow types
 *
 * The shapes the settlement workflow selectors read and return: the chain
 * plan, its rows and children, the step ladder, the blockers and the one act
 * the module accepts next. Split from the selectors so each module stays
 * within the source-structure ceiling.
 *
 * @module modules/commitment-pooling/settlement-workflow-types
 */

import type { Address } from "../../types/domain";
import type { IndexedDisbursementState } from "./settlement";
import type { SettlementPayoutKind } from "./settlement-eligibility";

export type SettlementStepId =
  | "create-plan"
  | "contributor-split"
  | "finalize-plan"
  | "prepare-payout"
  | "dispatch"
  | "acknowledgement";

export type SettlementStepStatus = "done" | "current" | "upcoming";

export type SettlementActionBlocker =
  | "wallet-disconnected"
  | "offline"
  | "missing-payer-steward"
  | "missing-operator"
  | "source-paused"
  | "payer-account-inactive"
  | "beneficiary-account-inactive"
  | "gardener-delivery-disabled"
  | "recognition-unready"
  | "chain-read-pending"
  | "chain-read-failed"
  | "acting";

export type SettlementPlanStatus = "DRAFT" | "PENDING" | "PARTIAL" | "COMPLETE" | "FAILED";

/** `getPayoutPlan` plus `payoutPlanStatus`, as the chain returns them. */
export interface SettlementChainPlan {
  payoutPlanId: bigint;
  payoutKind: SettlementPayoutKind;
  status: SettlementPlanStatus;
  finalized: boolean;
  source: Address | null;
  token: Address | null;
  declaredAmount: bigint;
  gardenRetainedAmount: bigint;
  contributorPayoutTotal: bigint;
  beneficiaryGarden: Address | null;
  beneficiaryRecipient: Address | null;
  beneficiaryAmount: bigint;
  beneficiaryDisbursementId: bigint | null;
  payablePayoutCount: number;
  preparedPayoutCount: number;
  confirmedPayoutCount: number;
  failedPayoutCount: number;
  cancelledPayoutCount: number;
}

/** One frozen contributor row (`contributorPayoutOf`). */
export interface SettlementChainRow {
  contributor: Address;
  recipient: Address;
  amount: bigint;
  recognitionWeightBps: number;
  paymentWeightBps: number;
  disbursementId: bigint | null;
}

/** One child disbursement (`getDisbursement`) with its acknowledgement flag. */
export interface SettlementChainDisbursement {
  disbursementId: bigint;
  kind: string;
  contributor: Address | null;
  recipient: Address;
  amount: bigint;
  state: IndexedDisbursementState;
  batchId: bigint | null;
  attempt: number;
  failureCode: number | null;
  cancelledFromState: "QUEUED" | "FAILED" | null;
  dispatchedAt: number | null;
  acknowledgmentPending: boolean;
}

export interface SettlementWorkflowInput {
  kind: SettlementPayoutKind;
  plan: SettlementChainPlan | null;
  rows: readonly SettlementChainRow[];
  disbursements: readonly SettlementChainDisbursement[];
  /** Null while the chain has not answered yet. */
  gardenerDeliveryEnabled: boolean | null;
  sourcePaused: boolean | null;
  payerAccountActive: boolean | null;
  beneficiaryAccountActive: boolean | null;
  /** Null when not checked: the beneficiary shape, or a plan already exists. */
  recognitionReady: boolean | null;
  authority: {
    viewer?: Address;
    isPayerSteward: boolean;
    canDispatchOrRetry: boolean;
    canRequeueOrCancel: boolean;
  };
  isOnline: boolean;
  chainRead: "ready" | "pending" | "failed";
  isActing: boolean;
  /** Unix seconds; defaults to the wall clock. */
  now?: number;
  /** A dispatch older than this without acknowledgement reads as delayed. */
  delayAfterSeconds?: number;
}

export type SettlementNextAction =
  | { kind: "create-plan" }
  | { kind: "finalize-plan"; payoutPlanId: bigint }
  | { kind: "prepare-beneficiary"; payoutPlanId: bigint }
  | { kind: "prepare-contributor"; payoutPlanId: bigint; contributor: Address }
  | { kind: "dispatch"; disbursementId: bigint };

export interface SettlementStep {
  id: SettlementStepId;
  status: SettlementStepStatus;
  /** Why the current step cannot be taken yet; empty on done and upcoming steps. */
  blockers: SettlementActionBlocker[];
}

export type SettlementDisplayState =
  | "queued"
  | "dispatched"
  | "acknowledgement-pending"
  | "delivery-delayed"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "unknown";

export interface SettlementDisbursementView {
  disbursement: SettlementChainDisbursement;
  display: SettlementDisplayState;
  retryable: boolean;
  actions: { dispatch: boolean; retry: boolean; requeue: boolean; cancel: boolean };
}

export interface SettlementWorkflow {
  steps: SettlementStep[];
  currentStep: SettlementStepId | null;
  /** The one call the module accepts next, or null while the current step is blocked. */
  nextAction: SettlementNextAction | null;
  /** The current step's blockers, so a disabled control can say why. */
  blockers: SettlementActionBlocker[];
  disbursements: SettlementDisbursementView[];
  complete: boolean;
}
