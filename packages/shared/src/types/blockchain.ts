/**
 * Blockchain Configuration Types
 *
 * Types for chain IDs and deployment configuration.
 */

import type { Address } from "./domain";

/** Chain ID type alias */
export type ChainId = number;

/** Deployment configuration for a specific chain */
export interface DeploymentConfig {
  gardenToken?: Address;
  actionRegistry?: Address;
  workResolver?: Address;
  workApprovalResolver?: Address;
  deploymentRegistry?: Address;
  eas?: {
    address: Address;
    schemaRegistry: Address;
  };
  schemas?: {
    gardenAssessmentSchemaUID: string;
    workSchemaUID: string;
    workApprovalSchemaUID: string;
  };
  rootGarden?: {
    address: Address;
    tokenId: number;
  };
}
