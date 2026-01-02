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

export type Address = ViemAddress;

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

export interface GardenCard {
  id: string;
  name: string;
  location: string;
  bannerImage: string;
  operators: string[];
}

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
// Plant & Species Types
// ============================================

export interface PlantInfo {
  genus: string;
  height: number;
  latitude: number;
  longitude: number;
  image: string;
}

export interface SpeciesRegistry {
  trees: PlantInfo[];
  weeds: PlantInfo[];
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

export interface WorkDraft {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  media: File[];
  metadata?: Record<string, unknown>;
}

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

export interface Work extends WorkCard {
  status: "pending" | "approved" | "rejected";
}

export interface WorkMetadata {
  plantCount: number;
  plantSelection: string[];
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
