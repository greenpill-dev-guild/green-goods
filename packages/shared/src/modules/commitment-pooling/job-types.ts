import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { CommitmentMetadataV1 } from "./metadata";

export const COMMITMENT_JOB_KINDS = [
  "commitmentSeries",
  "commitment",
  "claim",
  "evidence",
  "workLink",
  "confirmation",
] as const;

export type CommitmentJobKind = (typeof COMMITMENT_JOB_KINDS)[number];

export interface CommitmentSeriesJobPayload {
  clientSeriesId: string;
  creationRequestKey: Hex;
  poolId: bigint;
  gardenAddress: Address;
  metadataCID: string;
}

export interface CommitmentRequirementInput {
  actionUID: bigint;
  requiredCount: number;
}

export interface DeclaredConsiderationInput {
  rail: number;
  source: Address;
  token: Address;
  amount: bigint;
}

export interface CommitmentCreationPayload {
  clientCommitmentId: string;
  creationRequestKey: Hex;
  poolId: bigint;
  cycleId: bigint;
  commitmentSeriesId: bigint;
  commitmentSeriesClientId?: string;
  direction: number;
  commitmentType: number;
  claimType: number;
  claimMode: number;
  contributorPolicy: number;
  onBehalfOf: Address;
  domainTags: readonly number[];
  requirements: readonly CommitmentRequirementInput[];
  unitLabel: string;
  targetUnits: bigint;
  requiresAssessment: boolean;
  dueDate: bigint;
  metadataCID: string;
  /**
   * The words to publish, carried instead of a CID when the commitment was
   * composed offline. The executor uploads this and fills `metadataCID` before
   * the payload is hashed or sent, the same way work uploads its media at send
   * time rather than at compose time. Content addressing makes that repeatable:
   * a retry re-uploads identical bytes and gets the identical CID back.
   */
  metadata?: CommitmentMetadataV1;
  needUID: Hex;
  counterCommitmentId: bigint;
  confirmers: readonly Address[];
  confirmationThreshold: number;
  protocolFallbackEnabled: boolean;
  consideration: DeclaredConsiderationInput;
  declaredUnitValue: bigint;
  declaredValueBasis: string;
  gardenAddress: Address;
}

/**
 * Carried by every act that a garden hat gates.
 *
 * The executor runs its membership preflight on `gardenAddress` before the
 * first send, so an account still waiting for its hat waits
 * (`membership-unavailable`) instead of spending retries on a revert. It is not
 * part of the job's identity: jobs persisted before 2026-08-21 carry no
 * `gardenAddress` and still send the way they were queued, and an old and a
 * new record of the same act dedupe as one.
 */
export interface MembershipGatedJobPayload {
  gardenAddress: Address;
  /**
   * True when the chain authorizes this act by identity rather than by hat: a
   * confirmer named on the commitment (setConfirmerRule) confirms without any
   * garden role, and isOrdinaryConfirmer checks the list, not Hats. The
   * preflight then stays out of the way; the contract is the only gate.
   */
  membershipNotRequired?: boolean;
}

export interface ClaimJobPayload extends MembershipGatedJobPayload {
  commitmentId: bigint;
  kind: number;
  gardenContext: Address;
}

/**
 * Proof, as composed in the field. The document and its media ride the job
 * until the phone is online; the executor uploads them, pins the document and
 * writes `cid` back before `attachEvidence` is called. A record queued before
 * this shape carried `cid` alone and still sends as it was queued.
 */
export interface EvidenceJobPayload extends MembershipGatedJobPayload {
  /** Stable per composition, so a retry behind the same button is one job. */
  clientEvidenceId: string;
  commitmentId: bigint;
  /** Absent until the executor publishes the document; required at send. */
  cid?: string;
  creditedContributors: readonly Address[];
  note?: string;
  links?: readonly string[];
  /** Persisted by the queue store the way work media is; read back at send. */
  media?: File[];
  audioNotes?: File[];
}

export interface WorkLinkJobPayload extends MembershipGatedJobPayload {
  clientOperationId: string;
  commitmentId: bigint;
  workUID: Hex;
  requirementIndex: number;
  operationKey: Hex;
}

export type ConfirmationJobPayload =
  | ({ action: "submit"; commitmentId: bigint } & MembershipGatedJobPayload)
  | ({ action: "confirm"; commitmentId: bigint } & MembershipGatedJobPayload);

export interface CommitmentJobPayloadMap {
  commitmentSeries: CommitmentSeriesJobPayload;
  commitment: CommitmentCreationPayload;
  claim: ClaimJobPayload;
  evidence: EvidenceJobPayload;
  workLink: WorkLinkJobPayload;
  confirmation: ConfirmationJobPayload;
}

export interface CommitmentJob<K extends CommitmentJobKind = CommitmentJobKind> {
  id: string;
  kind: K;
  payload: CommitmentJobPayloadMap[K];
  chainId: number;
  moduleAddress: Address;
  userAddress: Address;
  submittedTxHash?: Hex;
}

export type CommitmentJobExecutionResult =
  | { status: "recovered"; entityId?: bigint }
  | { status: "sent"; txHash: Hex }
  | {
      status: "waiting";
      reason:
        | "series-not-materialized"
        | "membership-unavailable"
        | "pending-first-send"
        | "evidence-unpublished";
    }
  | {
      status: "identity-conflict";
      reason:
        | "series-payload-mismatch"
        | "commitment-payload-mismatch"
        | "work-link-payload-mismatch";
    };

export interface CommitmentJobExecutionDependencies {
  readSeriesId(holder: Address, key: Hex): Promise<bigint>;
  readSeries(seriesId: bigint): Promise<{
    poolId: bigint;
    createdBy: Address;
    metadataCID: string;
    creationPayloadHash: Hex;
  }>;
  readPoolGarden(poolId: bigint): Promise<Address>;
  readCommitmentId(creator: Address, key: Hex): Promise<bigint>;
  readCommitment(
    commitmentId: bigint
  ): Promise<{ creationPayloadHash: Hex; poolId: bigint; creator: Address }>;
  readWorkLinkPayloadHash(caller: Address, key: Hex): Promise<Hex>;
  /** Whether this CID is already attached, so a re-send after a lost receipt recovers. */
  readEvidenceAttached?(commitmentId: bigint, cid: string): Promise<boolean>;
  resolveSeriesId?(clientSeriesId: string): Promise<bigint | null>;
  hasMembership?(garden: Address, account: Address): Promise<boolean | null>;
  send(input: {
    kind: CommitmentJobKind;
    payload: CommitmentJobPayloadMap[CommitmentJobKind];
    chainId: number;
    moduleAddress: Address;
  }): Promise<Hex>;
}
