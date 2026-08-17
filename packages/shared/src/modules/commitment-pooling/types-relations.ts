import type { Address } from "../../types/domain";
import type {
  CommitmentClaimRequestRecord,
  CommitmentContributorRecord,
  CommitmentCycleRecord,
  CommitmentPoolRecord,
  CommitmentProviderExposureRecord,
  CommitmentReadModel,
  CommitmentRequirementRecord,
  CommitmentSeriesCycleSummaryRecord,
  CommitmentUnitSummaryRecord,
  HexString,
} from "./types-core";
import type { FundingState, HypercertBundleKind } from "./types-vocabulary";

export interface CommitmentPoolDetail {
  pool: CommitmentPoolRecord;
  unitSummaries: CommitmentUnitSummaryRecord[];
  providerExposures: CommitmentProviderExposureRecord[];
}

export interface CommitmentCycleDetail {
  cycle: CommitmentCycleRecord;
  unitSummaries: CommitmentUnitSummaryRecord[];
  seriesSummaries: CommitmentSeriesCycleSummaryRecord[];
}

export interface CommitmentDetail {
  commitment: CommitmentReadModel;
  requirements: CommitmentRequirementRecord[];
  contributors: CommitmentContributorRecord[];
  assignments: Array<Record<string, unknown>>;
  workAttributions: Array<Record<string, unknown>>;
  evidenceAttributions: Array<Record<string, unknown>>;
  claimRequests: CommitmentClaimRequestRecord[];
  counterpartCommitments: CommitmentReadModel[];
}

export interface NeedCommitmentLineage {
  needUID: string;
  commitments: CommitmentReadModel[];
  fulfilledCommitments: CommitmentReadModel[];
  cycles: CommitmentCycleRecord[];
  hypercertEntityIds: string[];
  updatedAt: number;
}

export interface CommitmentExchangeRecord {
  id: string;
  chainId: number;
  poolId: bigint;
  poolEntityId: string;
  commitmentIdA: bigint;
  commitmentEntityIdA: string;
  commitmentIdB: bigint;
  commitmentEntityIdB: string;
  acceptorA: Address;
  acceptorB: Address;
  txHash: HexString;
  acceptedAt: number;
}

export interface CommitmentExchangeView {
  exchange: CommitmentExchangeRecord | null;
  commitmentA: CommitmentReadModel | null;
  commitmentB: CommitmentReadModel | null;
  status: "matched" | "proposed" | "counterpart-lapsed" | "unavailable";
}

export interface HypercertContributorAllocationRecord {
  id: string;
  chainId: number;
  hypercertId: bigint;
  hypercertEntityId: string;
  commitmentId: bigint;
  commitmentEntityId: string;
  contributor: Address;
  contributorEntityId: string;
  recognitionWeightBps: number;
  commitmentGardenersClassUnits: bigint;
  recognitionUnits: bigint;
  createdAt: number;
  updatedAt: number;
}

export interface CommitmentHypercertRecord {
  id: string;
  chainId: number;
  tokenId: bigint;
  garden: Address;
  metadataUri: string;
  mintedAt: number;
  mintedBy: Address;
  txHash: HexString;
  totalUnits: bigint;
  claimedUnits: bigint;
  attestationCount: number;
  attestationUIDs: string[];
  bundleKind: keyof typeof HypercertBundleKind;
  metadataReconciliationRequired: boolean;
  commitmentIds: bigint[];
  commitmentEntityIds: string[];
  needUIDs: string[];
  status: string;
  createdAt: number;
  updatedAt: number;
}

export type CommitmentHypercertBundle =
  | { status: "not-found" }
  | { status: "metadata-pending"; hypercert: CommitmentHypercertRecord }
  | {
      status: "ready";
      bundleKind: keyof typeof HypercertBundleKind;
      hypercert: CommitmentHypercertRecord;
      allocations: HypercertContributorAllocationRecord[];
    };

export interface CommitmentFundingRecord {
  id: string;
  chainId: number;
  fundingId: bigint;
  pledgeSeen: boolean;
  commitmentId: bigint | null;
  commitmentEntityId: string | null;
  funder: Address | null;
  garden: Address | null;
  gardenId: string | null;
  refundAccount: Address | null;
  expectedAmount: bigint | null;
  depositedAmount: bigint;
  depositReference: HexString | null;
  state: keyof typeof FundingState;
  refundDisbursementId: bigint | null;
  refundDisbursementEntityId: string | null;
  pledgedAt: number | null;
  depositRecordedAt: number | null;
  consumedAt: number | null;
  withdrawnAt: number | null;
  closedAt: number | null;
  updatedAt: number;
}
