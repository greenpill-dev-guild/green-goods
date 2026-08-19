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
  /** Offer or Request. Null until creation is seen. */
  direction?: keyof typeof CommitmentDirection | null;
  /** What kind of commitment this is. Null until creation is seen. */
  commitmentType?: keyof typeof CommitmentKind | null;
  /** Whether taking this up is open or steward-reviewed. Null until creation is seen. */
  claimMode?: keyof typeof CommitmentClaimMode | null;
  /** Whether a team may be joined. Null until creation is seen. */
  contributorPolicy?: keyof typeof CommitmentContributorPolicy | null;
  /** The named confirmer group. Empty when confirmation follows the ordinary rule. */
  confirmers: Address[];
  /** Team size without loading the team itself, which every card row needs. */
  contributorCount: number;
  /** Whether the team still accepts people. */
  contributorsFrozen: boolean;
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
