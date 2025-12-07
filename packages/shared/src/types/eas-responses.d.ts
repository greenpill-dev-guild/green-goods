/**
 * EAS GraphQL Response Types
 *
 * Type definitions for Ethereum Attestation Service GraphQL API responses.
 * These types match the structure returned by the EAS GraphQL endpoint.
 */

/**
 * Raw attestation as returned from EAS GraphQL
 */
declare interface EASAttestationRaw {
  id: string;
  attester: string;
  recipient: string;
  timeCreated: number | string;
  decodedDataJson: string;
  revoked?: boolean;
  schemaId?: string;
}

/**
 * Response from attestations query
 */
declare interface EASAttestationsResponse {
  attestations: EASAttestationRaw[];
}

/**
 * Decoded field from attestation data
 */
declare interface EASDecodedField {
  name: string;
  value: {
    value: unknown;
    hex?: string;
  };
}

/**
 * Parsed garden assessment from EAS attestation
 */
declare interface EASGardenAssessment {
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

/**
 * Parsed work submission from EAS attestation
 */
declare interface EASWork {
  id: string;
  gardenerAddress: string;
  gardenAddress: string;
  actionUID: number;
  title: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

/**
 * Parsed work approval from EAS attestation
 */
declare interface EASWorkApproval {
  id: string;
  operatorAddress: string;
  gardenerAddress: string;
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback: string;
  createdAt: number;
}
