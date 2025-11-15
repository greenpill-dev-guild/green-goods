import type { Hex } from "viem";

export type ChainId = number;
export type Address = Hex;

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
