import type { OntologyChainCapability } from "../../ontology/types";
import type { Address } from "../../types/domain";

export enum CommitmentPoolType {
  UNKNOWN = "UNKNOWN",
  GARDEN = "GARDEN",
  PROTOCOL = "PROTOCOL",
}

export enum CommitmentPoolState {
  UNKNOWN = "UNKNOWN",
  NOT_READY = "NOT_READY",
  READY = "READY",
  OPEN = "OPEN",
  PAUSED = "PAUSED",
  CLOSED = "CLOSED",
  COMPOSTED = "COMPOSTED",
}

export enum CommitmentCycleType {
  UNKNOWN = "UNKNOWN",
  SEASON = "SEASON",
  CAMPAIGN = "CAMPAIGN",
}

export enum CommitmentCycleState {
  UNKNOWN = "UNKNOWN",
  SEEDED = "SEEDED",
  OPEN = "OPEN",
  RECONCILED = "RECONCILED",
  COMPOSTED = "COMPOSTED",
  CANCELLED = "CANCELLED",
}

export enum CommitmentDirection {
  UNKNOWN = "UNKNOWN",
  OFFER = "OFFER",
  REQUEST = "REQUEST",
}

export enum CommitmentClaimType {
  UNKNOWN = "UNKNOWN",
  GARDEN = "GARDEN",
  INDIVIDUAL = "INDIVIDUAL",
}

export enum CommitmentContributorPolicy {
  UNKNOWN = "UNKNOWN",
  OPEN = "OPEN",
  LEAD_MANAGED = "LEAD_MANAGED",
}

export enum CommitmentClaimMode {
  UNKNOWN = "UNKNOWN",
  OPEN = "OPEN",
  APPROVAL_GATED = "APPROVAL_GATED",
}

export enum FundingState {
  UNKNOWN = "UNKNOWN",
  PLEDGED = "PLEDGED",
  DEPOSIT_RECORDED = "DEPOSIT_RECORDED",
  CONSUMED = "CONSUMED",
  CLOSED = "CLOSED",
  REFUND_QUEUED = "REFUND_QUEUED",
  REFUNDED = "REFUNDED",
  WITHDRAWN = "WITHDRAWN",
}

export enum DisbursementKind {
  UNKNOWN = "UNKNOWN",
  CONTRIBUTOR_CONSIDERATION = "CONTRIBUTOR_CONSIDERATION",
  FUNDING = "FUNDING",
  LOAN_PRINCIPAL = "LOAN_PRINCIPAL",
  GARDEN_BENEFICIARY = "GARDEN_BENEFICIARY",
  REFUND = "REFUND",
}

export enum HypercertBundleKind {
  WORK_LEGACY = "WORK_LEGACY",
  COMMITMENT = "COMMITMENT",
}

export enum CommitmentSettlementFlow {
  UNKNOWN = "UNKNOWN",
  INTERNAL = "INTERNAL",
  PROTOCOL_TO_GARDEN = "PROTOCOL_TO_GARDEN",
  GARDEN_TO_PROTOCOL = "GARDEN_TO_PROTOCOL",
  GARDEN_TO_GARDEN = "GARDEN_TO_GARDEN",
}

export enum CommitmentOnchainState {
  UNKNOWN = "UNKNOWN",
  OFFERED = "OFFERED",
  REQUESTED = "REQUESTED",
  ACCEPTED = "ACCEPTED",
  READY_FOR_CONFIRMATION = "READY_FOR_CONFIRMATION",
  FULFILLED = "FULFILLED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  DISPUTED = "DISPUTED",
}

export enum CommitmentKind {
  UNKNOWN = "UNKNOWN",
  DOMAIN_IMPACT = "DOMAIN_IMPACT",
  SUPPORT_SERVICE = "SUPPORT_SERVICE",
  SEASON_CAMPAIGN = "SEASON_CAMPAIGN",
  STEWARD_CAPTURED = "STEWARD_CAPTURED",
}

export enum CommitmentClaimRequestState {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
  SUPERSEDED = "SUPERSEDED",
}

export enum CommitmentUnitScope {
  POOL = "POOL",
  CYCLE = "CYCLE",
}

export enum CommitmentSeriesState {
  UNKNOWN = "UNKNOWN",
  ACTIVE = "ACTIVE",
  RESTING = "RESTING",
  RETIRED = "RETIRED",
}

export enum CommitmentConsiderationRail {
  UNKNOWN = "UNKNOWN",
  NONE = "NONE",
  ARBITRUM_EXTERNAL = "ARBITRUM_EXTERNAL",
  CELO_SETTLEMENT = "CELO_SETTLEMENT",
}

export enum CommitmentConfirmationPath {
  UNKNOWN = "UNKNOWN",
  ORDINARY = "ORDINARY",
  POOL_FALLBACK = "POOL_FALLBACK",
  PROTOCOL_FALLBACK = "PROTOCOL_FALLBACK",
}

export type CommitmentDerivedState =
  | keyof typeof CommitmentOnchainState
  | "DRAFT"
  | "ACTIVE"
  | "EVIDENCE_SUBMITTED"
  | "PARTIALLY_APPROVED"
  | "RECONCILED";

export interface CommitmentReadModel {
  id: string;
  chainId: number;
  commitmentId: bigint;
  creationSeen: boolean;
  state: keyof typeof CommitmentOnchainState;
  approvedUnits: bigint;
  evidenceCount: number;
  cycleId: bigint | null;
  declaredUnitValue: bigint | null;
  declaredValueBasis: string | null;
  targetUnits: bigint;
  poolId?: bigint | null;
  commitmentSeriesId?: bigint | null;
  creator?: Address | null;
  leadProvider?: Address | null;
  unitLabel?: string | null;
  needUID?: string | null;
  counterCommitmentId?: bigint | null;
  considerationRail?: keyof typeof CommitmentConsiderationRail | null;
  considerationPaid?: boolean;
}

export interface PoolMemberHistory {
  id: string;
  chainId: number;
  poolId: bigint;
  account: Address;
  leadAccepted: number;
  leadFulfilled: number;
  leadCancelled: number;
  leadExpired: number;
  contributorFulfilled: number;
  receivedFulfilled: number;
  confirmationsGiven: number;
  disputesRaised: number;
  updatedAt: number;
}

export type PoolMemberHistoryDisclosure =
  | { status: "visible"; history: PoolMemberHistory }
  | { status: "hidden" }
  | { status: "unauthenticated" };

export type CommitmentPoolingAvailability =
  | { status: "available"; capability: OntologyChainCapability }
  | {
      status: "unavailable";
      reason: "not-deployed" | "not-activated" | "not-integrated";
      capability: OntologyChainCapability;
    }
  | { status: "unknown-chain" };

export interface CommitmentPoolRecord {
  id: string;
  chainId: number;
  poolId: bigint;
  registrationSeen: true;
  garden: Address | null;
  gardenId: string | null;
  poolType: keyof typeof CommitmentPoolType | null;
  state: keyof typeof CommitmentPoolState | null;
  charterCID: string | null;
  openSeasonCycleId: bigint | null;
  openSeasonCycleEntityId: string | null;
  openCampaignIds: bigint[];
  openCampaignEntityIds: string[];
  providerOpenCommitmentCap: bigint;
  liveCommitmentCount: bigint;
  nonTerminalCycleCount: bigint;
  commitmentsOffered: bigint;
  commitmentsRequested: bigint;
  commitmentsAccepted: bigint;
  commitmentsReadyForConfirmation: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  workLinkedCount: bigint;
  workApprovedCount: bigint;
  openCommitmentCount: bigint;
  commitmentsDue: bigint;
  createdAt: number | null;
  updatedAt: number;
}

export interface CommitmentCycleRecord {
  id: string;
  chainId: number;
  cycleId: bigint;
  seedSeen: true;
  poolId: bigint;
  poolEntityId: string;
  garden: Address | null;
  gardenId: string | null;
  cycleType: keyof typeof CommitmentCycleType | null;
  state: keyof typeof CommitmentCycleState | null;
  startTime: bigint | null;
  endTime: bigint | null;
  metadataCID: string | null;
  gardenersBps: number;
  treasuryBps: number;
  operatorBps: number;
  evaluatorBps: number;
  communityBps: number;
  funderBps: number;
  equalParticipationBps: number;
  verifiedContributionBps: number;
  liveCommitmentCount: bigint;
  commitmentsAccepted: bigint;
  commitmentsReadyForConfirmation: bigint;
  commitmentsFulfilled: bigint;
  commitmentsCancelled: bigint;
  commitmentsExpired: bigint;
  commitmentsDisputed: bigint;
  commitmentsDue: bigint;
  openCommitmentCount: bigint;
  createdAt: number | null;
  updatedAt: number;
}

export interface CommitmentUnitSummaryRecord {
  id: string;
  chainId: number;
  scope: "POOL" | "CYCLE";
  scopeId: bigint;
  poolId: bigint;
  cycleId: bigint | null;
  unitLabel: string;
  unitLabelHash: HexString;
  expectedUnits: bigint;
  approvedUnits: bigint;
  fulfilledUnits: bigint;
  openUnits: bigint;
  updatedAt: number;
}

export interface CommitmentProviderExposureRecord {
  id: string;
  chainId: number;
  poolId: bigint;
  provider: Address;
  openCommitmentCount: bigint;
  updatedAt: number;
}

export interface CommitmentSeriesRecord {
  id: string;
  chainId: number;
  seriesId: bigint;
  creationSeen: true;
  poolId: bigint;
  poolEntityId: string;
  createdBy: Address;
  currentHolder: Address;
  state: keyof typeof CommitmentSeriesState;
  metadataCID: string;
  instanceCount: bigint;
  offeredCount: bigint;
  acceptedCount: bigint;
  readyCount: bigint;
  fulfilledCount: bigint;
  cancelledCount: bigint;
  expiredCount: bigint;
  disputedCount: bigint;
  fulfilledCycleIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CommitmentSeriesCycleSummaryRecord {
  id: string;
  chainId: number;
  seriesId: bigint;
  seriesEntityId: string;
  cycleId: bigint;
  cycleEntityId: string;
  poolId: bigint;
  poolEntityId: string;
  instanceCount: bigint;
  offeredCount: bigint;
  acceptedCount: bigint;
  readyCount: bigint;
  fulfilledCount: bigint;
  cancelledCount: bigint;
  expiredCount: bigint;
  disputedCount: bigint;
  updatedAt: number;
}

export interface CommitmentRequirementRecord {
  id: string;
  chainId: number;
  commitmentId: bigint;
  requirementIndex: number;
  creationSeen: true;
  domain: number | null;
  actionUID: bigint;
  requiredCount: number;
  approvedCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CommitmentContributorRecord {
  id: string;
  chainId: number;
  commitmentId: bigint;
  contributor: Address;
  additionSeen: true;
  active: boolean;
  isLead: boolean;
  approvedWorkCredits: number;
  evidenceCredits: number;
  uncountedLinkedWorkCount: number;
  requirementIndexes: number[];
  recognitionWeightBps: number | null;
  addedBy: Address | null;
  addedAt: number | null;
  removedBy: Address | null;
  removedAt: number | null;
  updatedAt: number;
}

export interface CommitmentClaimRequestRecord {
  id: string;
  chainId: number;
  commitmentId: bigint;
  claimant: Address;
  requestSeen: true;
  requestedBy: Address;
  claimType: keyof typeof CommitmentClaimType;
  gardenContext: Address | null;
  state: keyof typeof CommitmentClaimRequestState;
  reasonCID: string | null;
  resolutionCode: string | null;
  requestedAt: number;
  resolvedAt: number | null;
  updatedAt: number;
}

export interface CommitmentEventRecord {
  id: string;
  chainId: number;
  poolId: bigint | null;
  cycleId: bigint | null;
  commitmentId: bigint | null;
  eventType: string;
  actor: Address | null;
  configurationKey: number | null;
  previousValue: string | null;
  newValue: string | null;
  units: bigint | null;
  data: string | null;
  txHash: HexString;
  timestamp: number;
}

export type HexString = `0x${string}`;

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

export interface SettlementConfigurationRecord {
  id: string;
  chainId: number;
  role: string;
  gardenerDeliveryEnabled: boolean | null;
  protocolGarden: Address | null;
  gDollarToken: Address;
  hatsModule: Address | null;
  commitmentPoolingModule: Address | null;
  localContract: Address;
  localRouter: Address;
  localChainSelector: bigint;
  remoteChainSelector: bigint | null;
  remoteEvmChainId: number | null;
  destinationGasLimit: number | null;
  activePeer: Address | null;
  previousPeer: Address | null;
  previousPeerExpiresAt: bigint | null;
  protocolVersion: number;
  dispatcher: Address | null;
  batchSizeLimit: number;
  maxTransferAmount: bigint | null;
  maxBatchAmount: bigint | null;
  maxFeeBps: number | null;
  maxFeeAmount: bigint | null;
  periodDuration: number | null;
  maxPeriodAmount: bigint | null;
  feeReserveMinimum: bigint;
  nativeFeeBalance: bigint;
  feeReserveLow: boolean;
  peerConfigured: boolean;
  paused: boolean;
  updatedAt: number;
}

export interface SettlementSubjectRecord {
  id: string;
  chainId: number;
  isBatch: boolean;
  subjectId: bigint;
  executorGarden: Address;
  state: "UNKNOWN" | "QUEUED" | "DISPATCHED" | "CONFIRMED" | "FAILED" | "CANCELLED";
  attempt: number;
  executionKey: HexString | null;
  commandMessageId: HexString | null;
  acknowledgmentMessageId: HexString | null;
  dispatchedAt: number | null;
  confirmedAt: number | null;
  failureCode: number | null;
  reasonCID: string | null;
  cancelledFromState: "QUEUED" | "FAILED" | null;
  batchId: bigint | null;
  kind: string | null;
  fundingRoute: string | null;
  source: Address | null;
  recipient: Address | null;
  token: Address | null;
  amount: bigint | null;
  updatedAt: number;
}

export interface SettlementMessageRecord {
  id: string;
  chainId: number;
  messageId: HexString;
  executionKey: HexString;
  direction: "COMMAND" | "ACKNOWLEDGMENT";
  status: string;
  isBatch: boolean;
  subjectId: bigint;
  attempt: number | null;
  destinationPeer: Address | null;
  destinationGasLimit: number | null;
  protocolVersion: number;
  commandPayloadHash: HexString | null;
  sourceChainId: number;
  destinationChainId: number;
  fee: bigint | null;
  reserveFunded: boolean | null;
  failureCode: number | null;
  txHash: HexString;
  createdAt: number;
  updatedAt: number;
}

export interface SettlementExecutionRecord {
  id: string;
  chainId: number;
  sourceChainId: number;
  executionKey: HexString;
  commandMessageId: HexString;
  acknowledgmentReceiver: Address;
  protocolVersion: number;
  executorGarden: Address;
  isBatch: boolean;
  settlementId: bigint;
  attempt: number;
  status: string;
  failureCode: number;
  txHash: HexString;
  acknowledgmentMessageId: HexString | null;
  acknowledgmentSent: boolean;
  acknowledgmentDeferralCode: string;
  createdAt: number;
  updatedAt: number;
}

export interface SettlementSubjectDetail {
  subject: SettlementSubjectRecord;
  command: SettlementMessageRecord | null;
  acknowledgment: SettlementMessageRecord | null;
  execution: SettlementExecutionRecord | null;
}

export interface CommitmentPayoutPlanRecord {
  id: string;
  chainId: number;
  payoutPlanId: bigint;
  commitmentId: bigint;
  payerGarden: Address;
  payerGardenId: string;
  providerGarden: Address;
  providerGardenId: string;
  settlementFlow: keyof typeof CommitmentSettlementFlow;
  payoutKind: keyof typeof DisbursementKind;
  declaredAmount: bigint;
  gardenRetainedAmount: bigint;
  contributorPayoutTotal: bigint;
  beneficiaryGarden: Address | null;
  beneficiaryRecipient: Address | null;
  beneficiaryAmount: bigint;
  beneficiaryDisbursementId: bigint | null;
  recognitionSnapshotHash: HexString;
  paymentSnapshotHash: HexString;
  paymentSnapshotVersion: number;
  finalized: boolean;
  status: string;
  payablePayoutCount: number;
  preparedPayoutCount: number;
  confirmedPayoutCount: number;
  failedPayoutCount: number;
  cancelledPayoutCount: number;
  createdAt: number;
  finalizedAt: number | null;
  updatedAt: number;
}

export interface ContributorPayoutRecord {
  id: string;
  chainId: number;
  payoutPlanId: bigint;
  commitmentId: bigint;
  contributor: Address;
  recipient: Address;
  paymentSnapshotVersion: number;
  recognitionWeightBps: number;
  paymentWeightBps: number;
  amount: bigint;
  disbursementId: bigint | null;
  disbursementEntityId: string | null;
  latestEditReasonCID: string | null;
  editedBy: Address;
  createdAt: number;
  updatedAt: number;
}

export interface CommitmentPayoutPlanDetail {
  plan: CommitmentPayoutPlanRecord;
  contributorPayouts: ContributorPayoutRecord[];
  disbursements: SettlementSubjectRecord[];
}

export interface SettlementAccountRecord {
  id: string;
  chainId: number;
  garden: Address;
  gardenId: string;
  accountChainId: bigint;
  account: Address;
  active: boolean;
  recoveryOwners: Address[];
  rolesModifier: Address;
  roleKey: HexString;
  allowanceKey: HexString;
  permissionsConfigHash: HexString;
  recoveryConfigHash: HexString;
  recoveryThreshold: number;
  updatedAt: number;
}

export interface SettlementGardenRouteRecord {
  id: string;
  chainId: number;
  sourceChainId: number;
  garden: Address;
  gardenId: string;
  settlementAccountId: string;
  safe: Address;
  rolesModifier: Address;
  roleKey: HexString;
  allowanceKey: HexString;
  permissionsConfigHash: HexString;
  active: boolean;
  configuredAt: number;
  updatedAt: number;
}

export interface SettlementAccountDetail {
  account: SettlementAccountRecord | null;
  route: SettlementGardenRouteRecord | null;
}
