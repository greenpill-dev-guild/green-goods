/**
 * Green Goods Indexer GraphQL Response Types
 *
 * Type definitions for the Green Goods indexer (Envio) GraphQL API responses.
 * Import these explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { IndexerGarden, IndexerGardensResponse } from '@green-goods/shared';
 * ```
 */

import type { Address } from "./domain";

// ============================================
// Garden Responses
// ============================================

export interface IndexerGarden {
  id: string;
  chainId: number;
  tokenAddress: Address;
  tokenID: string | bigint;
  name: string | null;
  description: string | null;
  location: string | null;
  bannerImage: string | null;
  gardeners: Address[] | null;
  operators: Address[] | null;
  evaluators: Address[] | null;
  owners: Address[] | null;
  funders: Address[] | null;
  communities: Address[] | null;
  createdAt: number | null;
}

export interface IndexerGardensResponse {
  Garden: IndexerGarden[];
}

// ============================================
// Action Responses
// ============================================

export interface IndexerAction {
  id: string;
  chainId: number;
  startTime: string | number | null;
  endTime: string | number | null;
  title: string;
  instructions: string | null;
  capitals: (string | number)[] | null;
  media: string[] | null;
  createdAt: number | null;
}

export interface IndexerActionsResponse {
  Action: IndexerAction[];
}

// ============================================
// Gardener Responses
// ============================================

export interface IndexerGardener {
  id: string;
  chainId: number;
  createdAt: number | null;
  firstGarden: Address | null;
  joinedVia: Address | null;
}

export interface IndexerGardenersResponse {
  Gardener: IndexerGardener[];
}

// ============================================
// Commitment Settlement Responses
// ============================================

export type IndexerDisbursementKind =
  | "CONTRIBUTOR_CONSIDERATION"
  | "FUNDING"
  | "LOAN_PRINCIPAL"
  | "GARDEN_BENEFICIARY"
  | "UNKNOWN";

export type IndexerCommitmentSettlementFlow =
  | "INTERNAL"
  | "PROTOCOL_TO_GARDEN"
  | "GARDEN_TO_PROTOCOL"
  | "GARDEN_TO_GARDEN"
  | "UNKNOWN";

export type IndexerCommitmentPayoutPlanStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIAL"
  | "COMPLETE"
  | "FAILED";

export type IndexerDisbursementState =
  | "QUEUED"
  | "DISPATCHED"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

export interface IndexerCommitmentPayoutPlan {
  id: string;
  chainId: number;
  payoutPlanId: string | bigint;
  commitmentId: string | bigint;
  commitmentEntityId: string;
  providerGarden: Address;
  providerGardenId: string;
  payerGarden: Address;
  payerGardenId: string;
  settlementFlow: IndexerCommitmentSettlementFlow;
  source: Address;
  token: Address;
  payoutKind: IndexerDisbursementKind;
  declaredAmount: string | bigint;
  gardenRetainedAmount: string | bigint;
  contributorPayoutTotal: string | bigint;
  beneficiaryGarden: Address | null;
  beneficiaryGardenId: string | null;
  beneficiaryRecipient: Address | null;
  beneficiaryAmount: string | bigint;
  beneficiaryDisbursementId: string | bigint | null;
  beneficiaryDisbursementEntityId: string | null;
  recognitionContributorCount: number;
  payablePayoutCount: number;
  preparedPayoutCount: number;
  confirmedPayoutCount: number;
  failedPayoutCount: number;
  cancelledPayoutCount: number;
  recognitionSnapshotHash: string;
  paymentSnapshotHash: string;
  paymentSnapshotVersion: number;
  latestEditReasonCID: string | null;
  finalized: boolean;
  status: IndexerCommitmentPayoutPlanStatus;
  disbursementEntityIds: string[];
  createdBy: Address;
  createdAt: number;
  finalizedAt: number | null;
  updatedAt: number;
}

export interface IndexerDisbursement {
  id: string;
  chainId: number;
  disbursementId: string | bigint;
  garden: Address;
  gardenId: string;
  executorGarden: Address;
  executorGardenId: string;
  commitmentId: string | bigint | null;
  commitmentEntityId: string | null;
  payoutPlanId: string | bigint | null;
  payoutPlanEntityId: string | null;
  contributor: Address | null;
  contributorEntityId: string | null;
  settlementFlow: IndexerCommitmentSettlementFlow | null;
  kind: IndexerDisbursementKind;
  fundingRoute: "NONE" | "PROTOCOL_TO_GARDEN" | "UNKNOWN";
  source: Address;
  recipient: Address;
  token: Address;
  amount: string | bigint;
  state: IndexerDisbursementState;
  batchId: string | bigint | null;
  batchEntityId: string | null;
  reasonCID: string | null;
  attempt: number;
  executionKey: string | null;
  commandMessageId: string | null;
  dispatchedAt: number | null;
  celoExecutionTx: string | null;
  acknowledgmentMessageId: string | null;
  confirmedAt: number | null;
  failureCode: number | null;
  cancelledFromState: IndexerDisbursementState | null;
  createdAt: number;
  updatedAt: number;
}

export interface IndexerCommitmentPayoutPlansResponse {
  CommitmentPayoutPlan: IndexerCommitmentPayoutPlan[];
}

export interface IndexerDisbursementsResponse {
  Disbursement: IndexerDisbursement[];
}
