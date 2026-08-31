import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentActKind } from "../../../modules/commitment-pooling/acts";
import type { CommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import type {
  CommitmentClaimRequestRecord,
  CommitmentDetail,
  CommitmentPoolRecord,
} from "../../../modules/commitment-pooling/types";
import type { CommitmentPoolingAvailability } from "../../../modules/commitment-pooling/types-core";
import type { Action, Address, Work } from "../../../types/domain";
import type { CommitmentViewerRoles } from "../../commitment-pooling/useCommitmentViewerRoles";
import type { CommitmentWorkDecision } from "../../../modules/commitment-pooling/work-decisions";
import type { FailedCommitmentJob } from "../../commitment-pooling/useCommitmentQueueState";

export type GardenCommitmentStatus = "unavailable" | "notFound" | "loading" | "error" | "ready";

export interface CommitmentClaimContext {
  kind: "garden" | "personal";
  garden: Address;
}

export interface GardenCommitmentActs {
  claim: (context: CommitmentClaimContext) => Promise<string>;
  claimPersonal: () => Promise<string>;
  linkWork: (
    workUID: string,
    requirementIndex: number,
    clientOperationId: string
  ) => Promise<string>;
  sendForConfirmation: () => Promise<string>;
  confirm: () => Promise<string>;
  notYet: (reason: string) => Promise<`0x${string}`>;
  join: () => Promise<`0x${string}`>;
  withdraw: (reason: string) => Promise<`0x${string}`>;
  acceptClaim: (claimant: Address) => Promise<`0x${string}`>;
  declineClaim: (claimant: Address, reason: string) => Promise<`0x${string}`>;
}

export interface GardenCommitmentController {
  chainId: number;
  routeGarden: Address | null;
  /** Provider garden where candidate Work is submitted and WorkLink executes. */
  workGarden: Address | null;
  viewer: Address | null;
  isOnline: boolean;
  status: GardenCommitmentStatus;
  availability: CommitmentPoolingAvailability;
  detail: CommitmentDetail | null;
  metadata: CommitmentMetadataV1 | null;
  pool: CommitmentPoolRecord | null;
  works: Work[];
  actions: Action[];
  roles: CommitmentViewerRoles;
  seat: CommitmentSeat | null;
  actGarden: Address | null;
  actKind: CommitmentActKind | null;
  joinable: boolean;
  linkable: boolean;
  linkableWorks: Work[];
  workDecisions: {
    decisions: CommitmentWorkDecision[];
    byWorkUID: Map<string, CommitmentWorkDecision>;
    isLoading: boolean;
    isError: boolean;
    readAvailable: boolean;
    refetch: () => Promise<unknown>;
  };
  ownRequest: CommitmentClaimRequestRecord | null;
  pendingClaimRequests: CommitmentClaimRequestRecord[];
  canAskAgain: boolean;
  claimNeedsContext: boolean;
  queue: {
    hasPendingJob: boolean;
    sendFailed: boolean;
    failedJob: FailedCommitmentJob | null;
    isUnavailable: boolean;
    refresh: () => void;
  };
  confirmation: {
    phase: "ask" | "pending" | "confirmed";
    canNotYet: boolean;
    gardenAddress: Address | null;
    membershipNotRequired: boolean;
  };
  pinFailed: boolean;
  isQueueing: boolean;
  isSending: boolean;
  acts: GardenCommitmentActs;
  refetch: () => Promise<unknown>;
}
