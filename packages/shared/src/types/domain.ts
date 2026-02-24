/**
 * Green Goods Domain Types
 *
 * Core domain entities for the Green Goods protocol.
 * These types should be imported explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { Garden, Work, Action } from '@green-goods/shared';
 * ```
 */

import type { Address as ViemAddress } from "viem";

// ============================================
// Base Types
// ============================================

/** Ethereum address type from viem */
export type Address = ViemAddress;

/**
 * Eight capitals framework for categorizing regenerative impact.
 * Used to tag actions and assessments by the type of value they create.
 */
export enum Capital {
  SOCIAL = 0,
  MATERIAL = 1,
  FINANCIAL = 2,
  LIVING = 3,
  INTELLECTUAL = 4,
  EXPERIENTIAL = 5,
  SPIRITUAL = 6,
  CULTURAL = 7,
}

/**
 * Action domain — mirrors the Solidity Domain enum exactly.
 * On-chain for indexer queryability and SignalPool filtering.
 */
export enum Domain {
  SOLAR = 0,
  AGRO = 1,
  EDU = 2,
  WASTE = 3,
}

/**
 * CSS color values for each action domain, referencing theme CSS variables.
 * Matches the domainConfig in actions.json (solar=amber, agro=green, edu=blue, waste=orange).
 *
 * Use with inline styles: `style={{ borderLeftColor: DOMAIN_COLORS[domain] }}`
 */
export const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.SOLAR]: "rgb(var(--yellow-500))",
  [Domain.AGRO]: "rgb(var(--green-500))",
  [Domain.EDU]: "rgb(var(--blue-500))",
  [Domain.WASTE]: "rgb(var(--orange-500))",
};

/**
 * Cynefin complexity framework phase — classifies the operating environment
 * for a garden assessment's strategy kernel.
 *
 * CLEAR:       Known knowns — best practices apply, cause-effect obvious
 * COMPLICATED: Known unknowns — expert analysis needed, multiple right answers
 * COMPLEX:     Unknown unknowns — safe-to-fail probes, emergent practice
 * CHAOTIC:     No cause-effect — act first, novel practice required
 */
export enum CynefinPhase {
  CLEAR = 0,
  COMPLICATED = 1,
  COMPLEX = 2,
  CHAOTIC = 3,
}

/**
 * 4-value verification confidence — simple for field operators.
 * On-chain as uint8. Off-chain scoring maps these to numeric weights.
 */
export enum Confidence {
  NONE = 0, // not assessed (valid only for rejections)
  LOW = 1, // minimal evidence, trust-based
  MEDIUM = 2, // photo/document evidence reviewed by operator
  HIGH = 3, // strong proof (receipt, IoT, on-chain tx, witness)
}

/**
 * Verification method flags — stored as bitmask (uint8).
 * Multiple methods can apply to a single review (e.g., HUMAN + IOT).
 *
 * Bit mapping:
 *   bit 0 (1) = HUMAN   — human-driven review (photos, receipts, witnesses, onsite)
 *   bit 1 (2) = IOT     — sensor/meter/inverter data
 *   bit 2 (4) = ONCHAIN — blockchain transaction proof
 *   bit 3 (8) = AGENT   — automated/AI verification
 */
export enum VerificationMethod {
  HUMAN = 1 << 0, // 1
  IOT = 1 << 1, // 2
  ONCHAIN = 1 << 2, // 4
  AGENT = 1 << 3, // 8
}

// ============================================
// Gardener Types
// ============================================

/** User profile information for display in cards and lists */
export interface GardenerCard {
  id: string; // Privy ID
  /**
   * Smart Account Ethereum address.
   */
  account?: Address;
  username?: string | null; // Unique username
  email?: string;
  phone?: string;
  location?: string;
  avatar?: string | null;
  registeredAt: number;
}

// ============================================
// Garden Types - Single Source of Truth
// ============================================

/** Minimal garden data for display in cards and lists */
export interface GardenCard {
  id: string;
  name: string;
  location: string;
  bannerImage: string;
  /**
   * Operator Ethereum addresses.
   */
  operators: Address[];
}

/** Full garden entity with all related data (assessments, works, gardeners) */
export interface Garden extends GardenCard {
  chainId: number;
  /** Garden token contract address */
  tokenAddress: Address;
  tokenID: bigint; // Canonical type: bigint
  description: string;
  createdAt: number;
  /**
   * Gardener Ethereum addresses.
   */
  gardeners: Address[];
  /**
   * Evaluator Ethereum addresses.
   */
  evaluators: Address[];
  /**
   * Owner Ethereum addresses.
   */
  owners: Address[];
  /**
   * Funder Ethereum addresses.
   */
  funders: Address[];
  /**
   * Community member Ethereum addresses.
   */
  communities: Address[];
  /** Community token contract address */
  communityToken?: Address;
  assessments: GardenAssessment[];
  works: Work[];
  /** Whether the garden allows open joining (from indexer, updated by OpenJoiningUpdated event) */
  openJoining?: boolean;
  /** Domain bitmask from ActionRegistry (bit 0=Solar, 1=Agro, 2=Edu, 3=Waste). 0 = no domains set. */
  domainMask?: number;
}

// ============================================
// Assessment Types
// ============================================

/** A SMART outcome target within an assessment's strategy kernel */
export interface SmartOutcome {
  /** What this outcome achieves */
  description: string;
  /** Metric name from the domain action list */
  metric: string;
  /** Numeric target value for the metric */
  target: number;
}

/** File attachment stored on IPFS, referenced by CID */
export interface AssessmentAttachment {
  /** Human-readable file name */
  name: string;
  /** IPFS content identifier */
  cid: string;
  /** MIME type (e.g., "application/pdf", "image/png") */
  mimeType: string;
}

export interface GardenAssessment {
  id: string;
  schemaVersion: "assessment_v2";
  /**
   * Assessment author's Ethereum address.
   */
  authorAddress: Address;
  /**
   * Garden contract address.
   */
  gardenAddress: Address;
  title: string;
  description: string;

  // Strategy kernel
  /** Root-cause analysis of the challenge being addressed */
  diagnosis: string;
  /** SMART outcome targets with metric + numeric target */
  smartOutcomes: SmartOutcome[];
  /** Cynefin complexity phase for the operating environment */
  cynefinPhase: CynefinPhase;

  // Domain selection
  /** Primary action domain for this assessment */
  domain: Domain;
  /** UIDs of the selected actions within the domain */
  selectedActionUIDs: string[];

  // Harvest intent
  /** Reporting window for work aggregation into hypercerts */
  reportingPeriod: { start: number; end: number };

  // SDG alignment
  /** UN SDG goal IDs (1-17) this assessment aligns with */
  sdgTargets: number[];

  // Attachments
  /** Supporting documents stored on IPFS */
  attachments: AssessmentAttachment[];

  location: string;
  createdAt: number;
}

export interface AssessmentDraft {
  title: string;
  description: string;

  // Strategy kernel
  diagnosis: string;
  smartOutcomes: SmartOutcome[];
  cynefinPhase: CynefinPhase;

  // Domain selection
  domain: Domain;
  selectedActionUIDs: string[];

  // Harvest intent
  reportingPeriod: { start: number; end: number };

  // SDG alignment
  sdgTargets: number[];

  // Attachments (File objects for upload, not yet stored on IPFS)
  attachments: File[];

  location: string;
}

// ============================================
// Action Types
// ============================================

/** Minimal action data for display in cards and lists */
export interface ActionCard {
  id: string;
  slug: string;
  startTime: number;
  endTime: number;
  title: string;
  instructions?: string;
  capitals: Capital[];
  media: string[];
  domain: Domain;
  createdAt: number;
}

/** Full action with form configuration and UI settings */
export interface Action extends ActionCard {
  description: string;
  inputs: WorkInput[];
  mediaInfo?: {
    title: string;
    description?: string;
    maxImageCount?: number;
    required?: boolean;
    minImageCount?: number;
    needed?: string[];
    optional?: string[];
  };
  details?: {
    title: string;
    description: string;
    feedbackPlaceholder: string;
  };
  review?: {
    title: string;
    description: string;
  };
}

export interface WorkInput {
  key: string;
  title: string;
  placeholder: string;
  type: "text" | "textarea" | "select" | "multi-select" | "number" | "band" | "repeater";
  required: boolean;
  options: string[];
  bands?: string[];
  unit?: string;
  repeaterFields?: WorkInput[];
}

// ============================================
// Work Types
// ============================================

/**
 * Data submitted when a gardener documents their work.
 * This is the form input shape before processing/submission.
 * Generalized to support all 22 actions across 4 domains.
 *
 * @example
 * ```typescript
 * const submission: WorkSubmission = {
 *   actionUID: 1,
 *   title: "Cleanup Event",
 *   timeSpentMinutes: 90,
 *   feedback: "Collected lots of plastic",
 *   media: [photoFile1, photoFile2],
 *   details: { participantsCount: 12, amountRemovedKg: 32.5 },
 *   tags: ["riverbank", "plastic"],
 * };
 * ```
 *
 * @see WorkDraftRecord for the persisted draft state in IndexedDB
 * @see Work for the final on-chain work record
 */
export interface WorkSubmission {
  actionUID: number;
  title: string;
  /** Time spent on the work in minutes (required for all actions) */
  timeSpentMinutes: number;
  feedback: string;
  media: File[];
  /** Domain-specific fields from action config */
  details: Record<string, unknown>;
  /** Optional standardized tags */
  tags?: string[];
  /** Optional audio recordings */
  audioNotes?: File[];
}

/**
 * @deprecated Use WorkSubmission instead. Kept for backward compatibility.
 */
export type WorkDraft = WorkSubmission;

/** Minimal work data for display in cards and lists */
export interface WorkCard {
  id: string;
  title: string;
  actionUID: number;
  /**
   * Gardener's Ethereum address.
   */
  gardenerAddress: Address;
  /**
   * Garden contract address.
   */
  gardenAddress: Address;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

/** On-chain work record with approval status */
export interface Work extends WorkCard {
  status: "pending" | "approved" | "rejected";
}

/**
 * Work metadata v2 — generic, domain-aware.
 * Stored as JSON on IPFS, CID referenced in EAS attestation.
 */
export interface WorkMetadata {
  schemaVersion: "work_metadata_v2";
  domain: Domain;
  actionSlug: string;
  timeSpentMinutes: number;
  details: Record<string, unknown>;
  tags?: string[];
  audioNoteCids?: string[];
  clientWorkId: string;
  submittedAt: string;
  /** Optional GPS location (coarse, user-triggered) */
  location?: { lat: number; lng: number; accuracy: number } | null;
}

/**
 * Work metadata v1 — old shape for legacy works.
 * Kept for backward compatibility with existing attestations.
 */
export interface WorkMetadataV1 {
  plantCount: number;
  plantSelection: string[];
  timeSpentMinutes?: number;
}

// ============================================
// Work Approval Types
// ============================================

export interface WorkApprovalDraft {
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
  /** Verification confidence (required: NONE for rejections, >=LOW for approvals) */
  confidence: Confidence;
  /** Bitmask of VerificationMethod flags (at least 1 required for approvals) */
  verificationMethod: number;
  /** Optional IPFS CID for review audio + notes JSON */
  reviewNotesCID?: string;
}

export interface WorkApproval extends WorkApprovalDraft {
  id: string;
  /** Gardener's Ethereum address */
  gardenerAddress: Address;
  /** Operator's Ethereum address */
  operatorAddress: Address;
  createdAt: number;
}

// ============================================
// Action Instruction Types
// ============================================

/** Configuration for action instructions UI (admin setup) */
export interface ActionInstructionConfig {
  description: string;
  uiConfig: {
    media: {
      title: string;
      description: string;
      maxImageCount: number;
      minImageCount: number;
      required: boolean;
      needed: string[];
      optional: string[];
    };
    details: {
      title: string;
      description: string;
      feedbackPlaceholder: string;
      inputs: WorkInput[];
    };
    review: {
      title: string;
      description: string;
    };
  };
}

// ============================================
// ENS Registration Types
// ============================================

/**
 * ENS registration status data tracked through CCIP delivery.
 * Fully serializable for IndexedDB persistence via PersistQueryClientProvider.
 */
export interface ENSRegistrationData {
  status: "available" | "pending" | "active" | "timed_out";
  ccipMessageId?: string;
  submittedAt?: number;
  registration?: {
    owner: Address;
    nameType: number;
    registeredAt: string; // Serialized bigint (string, not BigInt) for IndexedDB
  };
}

// ============================================
// Assessment Workflow Types
// ============================================

/** Parameters for the assessment creation XState workflow */
export interface AssessmentWorkflowParams {
  gardenId: Address;
  title: string;
  description: string;
  assessmentType: string;
  capitals: string[];
  metrics: string | Record<string, unknown>;
  evidenceMedia: File[];
  reportDocuments: string[];
  impactAttestations: string[];
  startDate: string | number | null;
  endDate: string | number | null;
  location: string;
  tags: string[];
  domain?: number;
}

/** @deprecated Use AssessmentWorkflowParams instead */
export type CreateAssessmentForm = AssessmentWorkflowParams;

// ============================================
// UI Helper Types
// ============================================

export interface Link<T> {
  title: string;
  Icon: T;
  link: string;
  action?: () => void;
}
