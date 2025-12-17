/**
 * Type Exports
 *
 * This folder contains several categories of types:
 *
 * GLOBAL DECLARATIONS (*.d.ts - automatically available, not exported):
 * - greengoods.d.ts - Core domain types (Garden, Work, Action, etc.)
 * - job-queue.d.ts - Job queue and offline sync types
 * - eas-responses.d.ts - EAS GraphQL response parsing types
 * - offline.d.ts - Offline feature types
 * - global.d.ts - JSX intrinsic elements (AppKit)
 * - react-window.d.ts - React window virtualization types
 *
 * GRAPHQL INTROSPECTION (large generated files for gql.tada):
 * - green-goods.d.ts - Green Goods indexer GraphQL types
 * - eas.d.ts - EAS GraphQL types
 *
 * EXPORTED TYPES:
 * - contracts.ts - Contract deployment types
 * - blockchain.d.ts - Chain config types
 * - auth.ts - Authentication types
 */

// From contracts.ts
export type { CreateGardenParams, DeploymentParams, NetworkContracts } from "./contracts";

// From blockchain.d.ts
export type { Address, ChainId, DeploymentConfig } from "./blockchain";

// From auth.ts
export type { AuthMode, BaseAuthContext } from "./auth";

// Note: Global declaration files (*.d.ts with 'declare global' or 'declare interface')
// are automatically available and should NOT be exported here.
