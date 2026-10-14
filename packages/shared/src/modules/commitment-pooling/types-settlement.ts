import type { Address } from "../../types/domain";
import type { HexString } from "./types-core";
import type { CommitmentSettlementFlow, DisbursementKind } from "./types-vocabulary";
import type { SettlementDeliveryState } from "./settlement";

export interface GardenerSettlementReceipt {
  id: string;
  sourceChainId: number;
  chainId: 42220;
  payoutPlanId: bigint;
  commitmentId: bigint;
  contributor: Address;
  recipient: Address;
  amount: bigint;
  createdAt: number;
  updatedAt: number;
  metadataCID: string | null;
  title: string | null;
  metadataUnavailable: boolean;
  delivery: SettlementDeliveryState;
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
