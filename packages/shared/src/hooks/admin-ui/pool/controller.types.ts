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
