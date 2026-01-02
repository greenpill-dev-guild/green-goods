/**
 * Type Exports
 *
 * This folder contains several categories of types:
 *
 * EXPLICIT EXPORTS (import from '@green-goods/shared'):
 * - domain.ts - Core domain types (Garden, Work, Action, etc.)
 * - job-queue.ts - Job queue and offline sync types
 * - offline.ts - Offline feature types
 * - eas-responses.ts - EAS GraphQL response parsing types
 * - indexer-responses.ts - Indexer GraphQL response types
 * - contracts.ts - Contract deployment types
 * - auth.ts - Authentication types
 *
 * GLOBAL DECLARATIONS (*.d.ts - for backward compatibility, will be removed):
 * - greengoods.d.ts - Legacy global types (use domain.ts instead)
 * - job-queue.d.ts - Legacy global types (use job-queue.ts instead)
 * - offline.d.ts - Legacy global types (use offline.ts instead)
 * - global.d.ts - JSX intrinsic elements (AppKit)
 * - react-window.d.ts - React window virtualization types
 *
 * GRAPHQL INTROSPECTION (large generated files for gql.tada):
 * - green-goods.d.ts - Green Goods indexer GraphQL types
 * - eas.d.ts - EAS GraphQL types
 */

// ============================================
// Domain Types
// ============================================
export type {
  Address,
  GardenerCard,
  GardenCard,
  Garden,
  PlantInfo,
  SpeciesRegistry,
  GardenAssessment,
  AssessmentDraft,
  ActionCard,
  Action,
  WorkInput,
  WorkDraft,
  WorkCard,
  Work,
  WorkMetadata,
  WorkApprovalDraft,
  WorkApproval,
  ActionInstructionConfig,
  Link,
} from "./domain";

// Re-export Capital enum (value export, not type)
export { Capital } from "./domain";

// ============================================
// Job Queue Types
// ============================================
export type {
  Job,
  QueueEvent,
  JobProcessor,
  WorkJobPayload,
  ApprovalJobPayload,
  JobKindMap,
  JobKind,
  JobPayload,
  QueueSubscriber,
  QueueStats,
  JobQueueDBImage,
  CachedWork,
} from "./job-queue";

// ============================================
// Offline Types
// ============================================
export type {
  OfflineStatus,
  OfflineDashboardData,
  OfflineWorkItem,
  SyncMetrics,
  OfflineSettings,
  OfflineCapabilities,
  WorkConflict,
  DuplicateCheckResult,
} from "./offline";

// ============================================
// Indexer Response Types
// ============================================
export type {
  IndexerGarden,
  IndexerGardensResponse,
  IndexerAction,
  IndexerActionsResponse,
  IndexerGardener,
  IndexerGardenersResponse,
} from "./indexer-responses";

// ============================================
// EAS Response Types
// ============================================
export type {
  EASAttestationRaw,
  EASAttestationsResponse,
  EASDecodedField,
  EASGardenAssessment,
  EASWork,
  EASWorkApproval,
} from "./eas-responses";

// ============================================
// Contract Types
// ============================================
export type { CreateGardenParams, DeploymentParams, NetworkContracts } from "./contracts";

// ============================================
// Blockchain Types
// ============================================
export type { ChainId, DeploymentConfig } from "./blockchain.d";

// ============================================
// Auth Types
// ============================================
export type { AuthMode, BaseAuthContext } from "./auth";
