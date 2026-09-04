import type { CommitmentCycleNameMap } from "../../commitment-pooling/useCommitmentCycleNames";
import type { CommitmentMetadataMap } from "../../commitment-pooling/useCommitmentMetadata";
import type { CommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import type { CommitmentReasonResolution } from "../../commitment-pooling/useCommitmentReason";
import type { PoolCharterResolution } from "../../commitment-pooling/usePoolCharter";
import type { selectCommitmentActPermissions } from "../../../modules/commitment-pooling/commitment-act-permissions";
import type {
  CommitmentSeat,
  selectConfirmationEligibility,
} from "../../../modules/commitment-pooling/selectors";
import type { selectPoolConsoleModel } from "../../../modules/commitment-pooling/pool-console";
import type { selectPromiseKeptRate } from "../../../modules/commitment-pooling/disclosure";
import type {
  CommitmentCycleRecord,
  CommitmentDetail,
  CommitmentEventRecord,
  CommitmentPoolRecord,
  CommitmentPoolingAvailability,
  CommitmentReadModel,
  HexString,
  PoolClaimRequestRow,
} from "../../../modules/commitment-pooling/types";
import type { Address } from "../../../types/domain";
import type { EASGardenAssessment } from "../../../types/eas-responses";
import type { CommitmentWorkDecision } from "../../../modules/commitment-pooling/work-decisions";
import type { PoolFundingSnapshot } from "../../../modules/commitment-pooling/pool-funding";
import type {
  CommitmentSettlementChainState,
  SettlementChainAccount,
} from "../../../modules/commitment-pooling/data-settlement-chain";
import type {
  SettlementChainPlan,
  SettlementChainRow,
  SettlementEligibility,
  SettlementPayoutKind,
  SettlementWorkflow,
} from "../../../modules/commitment-pooling/settlement-workflow";

export interface PoolFundingControllerView {
  snapshot: PoolFundingSnapshot | null;
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  hasStaleBalance: boolean;
  lastReadAt: number | null;
  ledgerReadAt: number | null;
  refetch: () => Promise<unknown>;
}

export interface PoolConsoleActs {
  pause: (reason: string) => Promise<HexString>;
  resume: () => Promise<HexString>;
  closePool: () => Promise<HexString>;
  compostPool: () => Promise<HexString>;
  reopenPool: (toOpen: boolean) => Promise<HexString>;
  cancelCycle: (cycleId: bigint, reason: string) => Promise<HexString>;
  closeCycle: (cycleId: bigint) => Promise<HexString>;
  compostCycle: (cycleId: bigint) => Promise<HexString>;
  expire: (commitmentId: bigint) => Promise<HexString>;
  acceptClaim: (commitmentId: bigint, claimant: Address) => Promise<HexString>;
  declineClaim: (commitmentId: bigint, claimant: Address, reason: string) => Promise<HexString>;
  saveSettings: (next: { purpose: string; cap: bigint }) => Promise<void>;
}

export interface PoolConsoleController {
  chainId: number;
  garden: Address;
  viewer?: Address;
  isOnline: boolean;
  availability: CommitmentPoolingAvailability;
  pool:
    | (CommitmentPoolRecord & {
        promiseKeptRate: ReturnType<typeof selectPromiseKeptRate>;
      })
    | null;
  poolId?: bigint;
  model: ReturnType<typeof selectPoolConsoleModel>;
  cycles: CommitmentCycleRecord[];
  cycleNames: CommitmentCycleNameMap["byCycleId"];
  commitments: CommitmentReadModel[];
  titles: CommitmentMetadataMap["byCID"];
  claims: PoolClaimRequestRow[];
  charter: PoolCharterResolution;
  pauseReason: CommitmentReasonResolution;
  pendingCreates: CommitmentQueueState["pendingCreates"];
  queueUnavailable: boolean;
  funding: PoolFundingControllerView;
  acts: PoolConsoleActs;
  isActing: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown[]>;
}

export type ConfirmQueueEligibility =
  | "ORDINARY"
  | "POOL_FALLBACK"
  | "PROTOCOL_FALLBACK"
  | "DISPUTED";

export interface ConfirmQueueRow {
  commitment: CommitmentReadModel;
  /** The garden whose authority the act uses: the party garden, or the fallback garden. */
  garden: Address;
  gardenName: string;
  eligibility: ConfirmQueueEligibility;
  title: string | null;
  poolGarden?: Address | null;
  canDispute?: boolean;
}

export interface HubConfirmQueueActs {
  confirm: (row: ConfirmQueueRow) => Promise<string>;
  notYet: (row: ConfirmQueueRow, reason: string) => Promise<HexString>;
}

export interface HubConfirmQueueController {
  rows: ConfirmQueueRow[];
  isOnline: boolean;
  isLoading: boolean;
  isError: boolean;
  isConfirming: boolean;
  isDisputing: boolean;
  acts: HubConfirmQueueActs;
}

export type DisputeResolutionKey = "RESTORE_PREVIOUS" | "FULFILLED" | "CANCELLED" | "EXPIRED";

export interface CommitmentDialogActs {
  cancel: (reason: string) => Promise<HexString>;
  markReady: (reason: string) => Promise<HexString>;
  sendForConfirmation: () => Promise<string>;
  attachAssessment: (assessmentUID: HexString) => Promise<HexString>;
  raiseDispute: (reason: string) => Promise<HexString>;
  resolveDispute: (resolution: DisputeResolutionKey, reason: string) => Promise<HexString>;
  expire: () => Promise<HexString>;
  confirmOrdinary: () => Promise<string>;
  confirmFallback: (reason: string) => Promise<HexString>;
  acceptClaim: (claimant: Address) => Promise<HexString>;
  declineClaim: (claimant: Address, reason: string) => Promise<HexString>;
  syncWorkDecisions: () => Promise<HexString>;
}

export interface CommitmentWorkReconciliation {
  candidates: CommitmentWorkDecision[];
  count: number;
  decisionUIDs: HexString[];
  readAvailable: boolean;
  isLoading: boolean;
  isError: boolean;
  pendingReadback: boolean;
  succeeded: boolean;
  readbackStatus: "idle" | "pending" | "succeeded" | "unavailable" | "needsFreshReview";
  unavailableReadback: boolean;
  needsFreshReview: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

export interface CommitmentDialogController {
  chainId: number;
  garden: Address;
  viewer?: Address;
  isOnline: boolean;
  availability: CommitmentPoolingAvailability;
  commitment: CommitmentReadModel | null;
  detail: CommitmentDetail | null;
  title: string | null;
  note: string | null;
  cycle: CommitmentCycleRecord | null;
  events: CommitmentEventRecord[];
  disputeReason: CommitmentReasonResolution;
  cancelReason: CommitmentReasonResolution;
  assessments: EASGardenAssessment[];
  assessmentsLoading: boolean;
  activeContributors: Address[];
  seat: CommitmentSeat | null;
  isLocalSteward: boolean;
  isProtocolSteward: boolean;
  onRoster: boolean;
  poolPaused: boolean;
  ordinaryReachable: boolean;
  confirmation: ReturnType<typeof selectConfirmationEligibility>;
  isDue: boolean;
  hasPendingJob: boolean;
  can: ReturnType<typeof selectCommitmentActPermissions>;
  reconciliation: CommitmentWorkReconciliation;
  acts: CommitmentDialogActs;
  isActing: boolean;
  isLoading: boolean;
  isError: boolean;
  unavailable: boolean;
  notFound: boolean;
  refetch: () => Promise<unknown[]>;
}

export type SettlementActPhase = "signing" | "submitted" | "confirmed" | "failed";

export type SettlementActKind =
  | "queue-funding"
  | "create-plan"
  | "finalize-plan"
  | "prepare-beneficiary"
  | "prepare-contributor"
  | "dispatch"
  | "retry"
  | "requeue"
  | "cancel"
  | "set-gardener-delivery";

/** The last settlement transaction a panel sent: wallet, confirmed or failed feedback. */
export interface SettlementActStatus {
  kind: SettlementActKind;
  phase: SettlementActPhase;
  hash?: HexString;
  error?: unknown;
}

export interface CommitmentSettlementActs {
  createPlan: () => Promise<HexString>;
  finalizePlan: () => Promise<HexString>;
  prepareBeneficiary: () => Promise<HexString>;
  prepareContributor: (contributor: Address) => Promise<HexString>;
  dispatch: (disbursementId: bigint) => Promise<HexString>;
  retry: (disbursementId: bigint) => Promise<HexString>;
  requeue: (disbursementId: bigint) => Promise<HexString>;
  /** The reason is pinned first; the chain stores its CID. */
  cancel: (disbursementId: bigint, reason: string) => Promise<HexString>;
}

export interface SettlementAuthority {
  /** Steward or owner of the garden that pays: may create, finalize and prepare. */
  isPayerSteward: boolean;
  /** Executor-garden steward or exact dispatcher: may dispatch and retry. */
  canDispatchOrRetry: boolean;
  /** Executor-garden steward only: may requeue and cancel. */
  canRequeueOrCancel: boolean;
  /** False while any role read is still in flight. */
  resolved: boolean;
}

export interface CommitmentSettlementController {
  chainId: number;
  commitmentId: bigint;
  viewer?: Address;
  isOnline: boolean;
  availability: CommitmentPoolingAvailability;
  eligibility: SettlementEligibility;
  kind: SettlementPayoutKind | null;
  payerGarden: Address | null;
  payerAccount: SettlementChainAccount | null;
  beneficiaryGarden: Address | null;
  beneficiaryAccount: SettlementChainAccount | null;
  declaredAmount: bigint | null;
  token: Address | null;
  chain: CommitmentSettlementChainState | null;
  chainRead: "ready" | "pending" | "failed";
  plan: SettlementChainPlan | null;
  rows: SettlementChainRow[];
  workflow: SettlementWorkflow;
  /** The payer garden's funding snapshot: caps, fee and peer readiness, Safe balance. */
  funding: PoolFundingControllerView;
  authority: SettlementAuthority;
  acts: CommitmentSettlementActs;
  lastAct: SettlementActStatus | null;
  isActing: boolean;
  refetch: () => Promise<unknown>;
}

export interface SettlementOperationsController {
  chainId: number;
  viewer?: Address;
  availability: CommitmentPoolingAvailability;
  /** Null until the chain has answered. */
  gardenerDeliveryEnabled: boolean | null;
  sourcePaused: boolean | null;
  owner: Address | null;
  isSettlementOwner: boolean;
  isDeployer: boolean;
  /** Only the module owner may flip the gate; the chain enforces the same rule. */
  canConfigureDelivery: boolean;
  /** Owners and deployers see the card; everyone else does not. */
  showControl: boolean;
  isLoading: boolean;
  isError: boolean;
  isPending: boolean;
  lastAct: SettlementActStatus | null;
  setGardenerDelivery: (enabled: boolean) => Promise<HexString>;
  /** Re-read the switch and confirm a submitted request only when the chain matches it. */
  checkDeliveryStatus: () => Promise<void>;
  refetch: () => Promise<unknown>;
}

export type ProtocolFundingDisplayState =
  | "queued"
  | "dispatched"
  | "acknowledgement-pending"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "unknown";

export interface ProtocolFundingRow {
  id: string;
  disbursementId: bigint;
  recipient: Address;
  amount: bigint;
  state: ProtocolFundingDisplayState;
  executionKey: HexString | null;
  canDispatch: boolean;
  canRetry: boolean;
  canRequeue: boolean;
  canCancel: boolean;
}

export interface ProtocolFundingOperationsController {
  chainId: number;
  viewer?: Address;
  protocolGarden: Address | null;
  targetGarden: Address | null;
  isOnline: boolean;
  canQueueFunding: boolean;
  canDispatchOrRetry: boolean;
  canRequeueOrCancel: boolean;
  authorityResolved: boolean;
  showOperations: boolean;
  sourceFunding: PoolFundingControllerView;
  targetFunding: PoolFundingControllerView;
  rows: ProtocolFundingRow[];
  lastAct: SettlementActStatus | null;
  isActing: boolean;
  queueFunding: (garden: Address, amount: bigint) => Promise<HexString>;
  dispatch: (disbursementId: bigint) => Promise<HexString>;
  retry: (disbursementId: bigint) => Promise<HexString>;
  requeue: (disbursementId: bigint) => Promise<HexString>;
  cancel: (disbursementId: bigint, reason: string) => Promise<HexString>;
  refetch: () => Promise<unknown>;
}
