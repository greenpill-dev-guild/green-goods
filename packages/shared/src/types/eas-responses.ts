/**
 * EAS GraphQL Response Types
 *
 * Type definitions for Ethereum Attestation Service GraphQL API responses.
 * These types match the structure returned by the EAS GraphQL endpoint.
 * Import these explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { EASAttestationRaw, EASWork, EASWorkApproval } from '@green-goods/shared';
 * ```
 */

import type { Address } from "./domain";

// ============================================
// Raw Attestation Types
// ============================================

export interface EASAttestationRaw {
  id: string;
  attester: Address;
  recipient: Address;
  timeCreated: number | string;
  decodedDataJson: string;
  revoked?: boolean;
  schemaId?: string;
}

export interface EASAttestationsResponse {
  attestations: EASAttestationRaw[];
}

export interface EASDecodedField {
  name: string;
  value: {
    value: unknown;
    hex?: string;
  };
}

// ============================================
// Parsed Attestation Types
// ============================================

export interface EASGardenAssessment {
  id: string;
  authorAddress: Address;
  gardenAddress: Address;
  title: string;
  description: string;
  /** IPFS CID referencing the full assessment config JSON (assessment_v2) */
  assessmentConfigCID: string;
  /** Domain enum value (uint8 on-chain) */
  domain: number;
  startDate: number | null;
  endDate: number | null;
  location: string;
  createdAt: number;
}

export interface EASWork {
  id: string;
  gardenerAddress: Address;
  gardenAddress: Address;
  actionUID: number;
  title: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

export interface EASWorkApproval {
  id: string;
  operatorAddress: Address;
  gardenerAddress: Address;
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback: string;
  confidence: number;
  verificationMethod: number;
  reviewNotesCID: string;
  createdAt: number;
}
