/**
 * Settlement chain mappers
 *
 * Decode the settlement and pooling module structs the chain returns into the
 * records the workflow reads. Enum ordinals are spelled out beside their
 * Solidity source so a reordered enum fails loudly in review, not in a payout.
 *
 * @module modules/commitment-pooling/data-settlement-chain-mappers
 */

import type { Address } from "../../types/domain";
import type {
  SettlementChainDisbursement,
  SettlementChainPlan,
  SettlementChainRow,
} from "./settlement-workflow-types";
import type { SettlementPayoutKind, SettlementPlanStatus } from "./settlement-workflow";
import { isZeroAddress } from "../../utils/blockchain/address";

type RawStruct = Record<string, unknown>;

/** ISettlementModule.DisbursementState, by ordinal; `None` reads as unknown. */
export const DISBURSEMENT_STATES = [
  "UNKNOWN",
  "QUEUED",
  "DISPATCHED",
  "CONFIRMED",
  "FAILED",
  "CANCELLED",
] as const;
/** ISettlementModule.DisbursementKind, by ordinal. */
const DISBURSEMENT_KINDS = [
  "CONTRIBUTOR_CONSIDERATION",
  "FUNDING",
  "LOAN_PRINCIPAL",
  "GARDEN_BENEFICIARY",
  "REFUND",
] as const;
/** ISettlementModule.PayoutPlanStatus, by ordinal. */
const PLAN_STATUSES: readonly SettlementPlanStatus[] = [
  "DRAFT",
  "PENDING",
  "PARTIAL",
  "COMPLETE",
  "FAILED",
];
/** ICommitmentPoolingModule.CommitmentState, by ordinal; `None` reads as unknown. */
const COMMITMENT_STATES = [
  "UNKNOWN",
  "OFFERED",
  "REQUESTED",
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
] as const;
/** ICommitmentPoolingModule.ConsiderationRail, by ordinal. */
const CONSIDERATION_RAILS = ["NONE", "ARBITRUM_EXTERNAL", "CELO_SETTLEMENT"] as const;

export function asRecord(value: unknown): RawStruct {
  return value && typeof value === "object" ? (value as RawStruct) : {};
}

export function big(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  return 0n;
}

export function count(value: unknown): number {
  return Number(big(value));
}

export function addressOrNull(value: unknown): Address | null {
  return typeof value === "string" && !isZeroAddress(value)
    ? (value.toLowerCase() as Address)
    : null;
}

export function ordinal<T extends readonly string[]>(
  table: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  const index = count(value);
  return table[index] ?? fallback;
}

export interface SettlementChainAccount {
  account: Address;
  active: boolean;
  chainId: number;
}

export interface SettlementChainCommitment {
  state: (typeof COMMITMENT_STATES)[number];
  direction: "OFFER" | "REQUEST";
  counterpartyKind: "GARDEN" | "INDIVIDUAL";
  payerGarden: Address | null;
  providerGarden: Address | null;
  considerationRail: (typeof CONSIDERATION_RAILS)[number];
  considerationAmount: bigint;
  considerationSource: Address | null;
  considerationToken: Address | null;
  eligibleContributorCount: number;
}

export interface CommitmentSettlementChainState {
  commitment: SettlementChainCommitment;
  kind: SettlementPayoutKind;
  payoutPlanId: bigint | null;
  plan: SettlementChainPlan | null;
  rows: SettlementChainRow[];
  disbursements: SettlementChainDisbursement[];
  gardenerDeliveryEnabled: boolean;
  sourcePaused: boolean;
  payerAccount: SettlementChainAccount | null;
  beneficiaryAccount: SettlementChainAccount | null;
  /** Null when not checked: a beneficiary plan, an existing plan, or no roster supplied. */
  recognitionReady: boolean | null;
  readAt: number;
}

export function mapAccount(raw: unknown): SettlementChainAccount | null {
  const record = asRecord(raw);
  const account = addressOrNull(record.account);
  if (!account) return null;
  return { account, active: record.active === true, chainId: count(record.chainId) };
}

export function mapCommitment(raw: unknown): SettlementChainCommitment {
  const record = asRecord(raw);
  const consideration = asRecord(record.consideration);
  return {
    state: ordinal(COMMITMENT_STATES, record.state, "UNKNOWN"),
    direction: count(record.direction) === 1 ? "REQUEST" : "OFFER",
    counterpartyKind: count(record.counterpartyKind) === 0 ? "GARDEN" : "INDIVIDUAL",
    payerGarden: addressOrNull(record.payerGarden),
    providerGarden: addressOrNull(record.providerGarden),
    considerationRail: ordinal(CONSIDERATION_RAILS, consideration.rail, "NONE"),
    considerationAmount: big(consideration.amount),
    considerationSource: addressOrNull(consideration.source),
    considerationToken: addressOrNull(consideration.token),
    eligibleContributorCount: count(record.eligibleContributorCount),
  };
}

export function mapPlan(payoutPlanId: bigint, raw: unknown, status: unknown): SettlementChainPlan {
  const record = asRecord(raw);
  const beneficiaryDisbursementId = big(record.beneficiaryDisbursementId);
  return {
    payoutPlanId,
    payoutKind:
      ordinal(DISBURSEMENT_KINDS, record.payoutKind, "CONTRIBUTOR_CONSIDERATION") ===
      "GARDEN_BENEFICIARY"
        ? "GARDEN_BENEFICIARY"
        : "CONTRIBUTOR_CONSIDERATION",
    status: ordinal(PLAN_STATUSES, status, "DRAFT"),
    finalized: record.finalized === true,
    source: addressOrNull(record.source),
    token: addressOrNull(record.token),
    declaredAmount: big(record.declaredAmount),
    gardenRetainedAmount: big(record.gardenRetainedAmount),
    contributorPayoutTotal: big(record.contributorPayoutTotal),
    beneficiaryGarden: addressOrNull(record.beneficiaryGarden),
    beneficiaryRecipient: addressOrNull(record.beneficiaryRecipient),
    beneficiaryAmount: big(record.beneficiaryAmount),
    beneficiaryDisbursementId: beneficiaryDisbursementId === 0n ? null : beneficiaryDisbursementId,
    payablePayoutCount: count(record.payablePayoutCount),
    preparedPayoutCount: count(record.preparedPayoutCount),
    confirmedPayoutCount: count(record.confirmedPayoutCount),
    failedPayoutCount: count(record.failedPayoutCount),
    cancelledPayoutCount: count(record.cancelledPayoutCount),
  };
}

export function mapRow(contributor: Address, raw: unknown): SettlementChainRow {
  const record = asRecord(raw);
  const disbursementId = big(record.disbursementId);
  return {
    contributor,
    recipient: addressOrNull(record.recipient) ?? contributor,
    amount: big(record.amount),
    recognitionWeightBps: count(record.recognitionWeightBps),
    paymentWeightBps: count(record.paymentWeightBps),
    disbursementId: disbursementId === 0n ? null : disbursementId,
  };
}

export function mapDisbursement(
  disbursementId: bigint,
  raw: unknown,
  acknowledgmentPending: boolean
): SettlementChainDisbursement {
  const record = asRecord(raw);
  const batchId = big(record.batchId);
  const cancelledFrom = ordinal(DISBURSEMENT_STATES, record.cancelledFromState, "UNKNOWN");
  const dispatchedAt = count(record.dispatchedAt);
  return {
    disbursementId,
    kind: ordinal(DISBURSEMENT_KINDS, record.kind, "CONTRIBUTOR_CONSIDERATION"),
    contributor: addressOrNull(record.contributor),
    recipient:
      addressOrNull(record.recipient) ?? ("0x0000000000000000000000000000000000000000" as Address),
    amount: big(record.amount),
    state: ordinal(DISBURSEMENT_STATES, record.state, "UNKNOWN"),
    batchId: batchId === 0n ? null : batchId,
    attempt: count(record.attempt),
    failureCode: record.failureCode === undefined ? null : count(record.failureCode),
    cancelledFromState:
      cancelledFrom === "QUEUED" || cancelledFrom === "FAILED" ? cancelledFrom : null,
    dispatchedAt: dispatchedAt === 0 ? null : dispatchedAt,
    acknowledgmentPending,
  };
}
