import type { OntologyChainCapability } from "../../ontology/types";
import type { Address } from "../../types/domain";
import type {
  CommitmentClaimMode,
  CommitmentClaimRequestState,
  CommitmentClaimType,
  CommitmentConsiderationRail,
  CommitmentContributorPolicy,
  CommitmentCycleState,
  CommitmentCycleType,
  CommitmentDerivedState,
  CommitmentDirection,
  CommitmentKind,
  CommitmentOnchainState,
  CommitmentPoolState,
  CommitmentPoolType,
  CommitmentSeriesState,
} from "./types-vocabulary";

export interface CommitmentReadModel {
  id: string;
  chainId: number;
  commitmentId: bigint;
  creationSeen: boolean;
  /** Raw state stored by the indexer from the contract vocabulary. */
  onchainState: keyof typeof CommitmentOnchainState;
  /** Presentation state derived by shared selectors. */
  derivedState: CommitmentDerivedState;
  /** @deprecated Prefer onchainState for explicit state semantics. */
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
  /**
   * The other side of the agreement, written at acceptance and null before it.
   * On an Offer this is the person who took it up. On a Request the contract
   * stores the taker here as well, so it repeats `leadProvider` on an
   * individual claim rather than naming the asker (AcceptanceLib.sol:172-174).
   * Resolve the reader's relationship with `selectCommitmentSeat`, never by
   * comparing this field directly.
   */
  counterparty?: Address | null;
  /** Who recorded this on someone else's behalf. Null until creation is seen. */
  recordedBy?: Address | null;
  /**
   * Who took it up: a person or a garden account. Written at acceptance, null
   * before. On an Offer a garden took up, the garden's stewards and owners are
   * its ordinary confirmers (CreditLib.isOrdinaryConfirmer), not the garden
   * address itself.
   */
  counterpartyKind?: keyof typeof CommitmentClaimType | null;
  /** Offer or Request. Null until creation is seen. */
  direction?: keyof typeof CommitmentDirection | null;
  /** What kind of commitment this is. Null until creation is seen. */
  commitmentType?: keyof typeof CommitmentKind | null;
  /** Whether taking this up is open or steward-reviewed. Null until creation is seen. */
  claimMode?: keyof typeof CommitmentClaimMode | null;
  /**
   * Unix seconds, or null for none. A cycle-scoped commitment without its own
   * date is due at the cycle's end (`selectDueLiveCommitments`).
   */
  dueDate?: bigint | null;
  /** The garden whose provider delivered it, frozen at acceptance; null before. */
  providerGarden?: Address | null;
  /** An assessment gate, and the attestation once one is attached. */
  requiresAssessment?: boolean | null;
  assessmentUID?: string | null;
  /** A steward marked it ready with a recorded reason rather than the ordinary send. */
  readyOverridden?: boolean;
  /** The state a dispute froze, so a resolution can restore it; null outside a dispute. */
  preDisputeState?: keyof typeof CommitmentOnchainState | null;
  /** The words behind the latest dispute and cancellation, as CIDs. */
  disputeReasonCID?: string | null;
  cancelReasonCID?: string | null;
  /** Whether a team may be joined. Null until creation is seen. */
  contributorPolicy?: keyof typeof CommitmentContributorPolicy | null;
  /** The named confirmer group. Empty when confirmation follows the ordinary rule. */
  confirmers: Address[];
  /** How many confirmations have landed, and how many it takes. */
  confirmationCount?: number;
  confirmationThreshold?: number;
  /** Whether the Green Goods team may step in when nobody local is eligible. */
  protocolFallbackEnabled?: boolean;
  /**
   * Who confirmed it and by which path, once Fulfilled. Ordinary names the
   * confirmer plainly; a fallback carries its reason. Null until then, and
   * null when fulfilment came from a dispute resolution rather than a
   * confirmation.
   */
  fulfilledBy?: Address | null;
  confirmationPath?: "ORDINARY" | "POOL_FALLBACK" | "PROTOCOL_FALLBACK" | null;
  fallbackReason?: string | null;
  /** Team size without loading the team itself, which every card row needs. */
  contributorCount: number;
  /** Whether the team still accepts people. */
  contributorsFrozen: boolean;
  /**
   * Where the commitment's own words live. The contract stores only this, so a
   * title needs a second read; resolve it with `useCommitmentMetadata` rather
   * than describing the record back to the member.
   */
  metadataCID?: string | null;
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
  /** Why the pool is paused, as a reason CID. Set by PoolPaused, cleared by PoolResumed. */
  pauseReasonCID: string | null;
  pauseReasonBlockNumber: bigint | null;
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
  distinctProviderCount: bigint;
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

/** A pool-wide claim row: the request and the commitment it sits on. */
export interface PoolClaimRequestRow {
  claim: CommitmentClaimRequestRecord;
  commitment: CommitmentReadModel;
}

/** A ready-for-confirmation commitment with the roster that bounds who may confirm it. */
export interface FallbackConfirmationCandidate {
  commitment: CommitmentReadModel;
  activeContributors: Address[];
}
