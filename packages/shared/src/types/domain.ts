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

// ============================================
// Gardener Types
// ============================================

/** User profile information for display in cards and lists */
export interface GardenerCard {
  id: string; // Privy ID
  account?: string; // Smart Account Address
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
  operators: string[];
}

/** Full garden entity with all related data (assessments, works, gardeners) */
export interface Garden extends GardenCard {
  chainId: number;
  tokenAddress: string;
  tokenID: bigint; // Canonical type: bigint
  description: string;
  createdAt: number;
  gardeners: string[];
  communityToken?: string;
  assessments: GardenAssessment[];
  works: Work[];
  /** Whether the garden allows open joining (from indexer, updated by OpenJoiningUpdated event) */
  openJoining?: boolean;
}

// ============================================
// Assessment Types
// ============================================

export interface GardenAssessment {
  id: string;
  authorAddress: string;
  gardenAddress: string;
  title: string;
  description: string;
  assessmentType: string;
  capitals: string[];
  metricsCid: string | null;
  metrics: Record<string, unknown> | null;
  evidenceMedia: string[];
  reportDocuments: string[];
  impactAttestations: string[];
  startDate: number | null;
  endDate: number | null;
  location: string;
  tags: string[];
  createdAt: number;
}

export interface AssessmentDraft {
  title: string;
  description: string;
  assessmentType: string;
  capitals: string[];
  metrics: Record<string, unknown>;
  evidenceMedia: File[];
  reportDocuments: string[];
  impactAttestations: string[];
  startDate: number;
  endDate: number;
  location: string;
  tags: string[];
}

// ============================================
// Action Types
// ============================================

/** Minimal action data for display in cards and lists */
export interface ActionCard {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  instructions?: string;
  capitals: Capital[];
  media: string[];
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
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  options: string[];
}

// ============================================
// Work Types
// ============================================

/**
 * Data submitted when a gardener documents their work.
 * This is the form input shape before processing/submission.
 *
 * @example
 * ```typescript
 * const submission: WorkSubmission = {
 *   actionUID: 1,
 *   title: "Planted tomatoes",
 *   plantSelection: ["tomato", "basil"],
 *   plantCount: 12,
 *   timeSpentMinutes: 90,
 *   feedback: "Great growing conditions",
 *   media: [photoFile1, photoFile2]
 * };
 * ```
 *
 * @see WorkDraftRecord for the persisted draft state in IndexedDB
 * @see Work for the final on-chain work record
 */
export interface WorkSubmission {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  /** Time spent on the work in minutes */
  timeSpentMinutes?: number;
  feedback: string;
  media: File[];
  metadata?: Record<string, unknown>;
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
  gardenerAddress: string;
  gardenAddress: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

/** On-chain work record with approval status */
export interface Work extends WorkCard {
  status: "pending" | "approved" | "rejected";
}

export interface WorkMetadata {
  plantCount: number;
  plantSelection: string[];
  /** Time spent on the work in minutes */
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
}

export interface WorkApproval extends WorkApprovalDraft {
  id: string;
  gardenerAddress: string;
  operatorAddress: string;
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
// UI Helper Types
// ============================================

export interface Link<T> {
  title: string;
  Icon: T;
  link: string;
  action?: () => void;
}
