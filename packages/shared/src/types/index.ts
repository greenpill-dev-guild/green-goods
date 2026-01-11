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
// Auth Types
// ============================================
export type { AuthMode, BaseAuthContext } from "./auth";
// ============================================
// Blockchain Types
// ============================================
export type { ChainId, DeploymentConfig } from "./blockchain.d";
// ============================================
// Contract Types
// ============================================
export type { CreateGardenParams, DeploymentParams, NetworkContracts } from "./contracts";
// ============================================
// Domain Types
// ============================================
export type {
  Action,
  ActionCard,
  ActionInstructionConfig,
  Address,
  AssessmentDraft,
  Garden,
  GardenAssessment,
  GardenCard,
  GardenerCard,
  Link,
  PlantInfo,
  SpeciesRegistry,
  Work,
  WorkApproval,
  WorkApprovalDraft,
  WorkCard,
  WorkDraft,
  WorkInput,
  WorkMetadata,
} from "./domain";
// Re-export Capital enum (value export, not type)
export { Capital } from "./domain";

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
// Indexer Response Types
// ============================================
export type {
  IndexerAction,
  IndexerActionsResponse,
  IndexerGarden,
  IndexerGardener,
  IndexerGardenersResponse,
  IndexerGardensResponse,
} from "./indexer-responses";
// ============================================
// Job Queue Types
// ============================================
export type {
  ApprovalJobPayload,
  CachedWork,
  DraftImage,
  // Draft types
  DraftStep,
  Job,
  JobKind,
  JobKindMap,
  JobPayload,
  JobProcessor,
  JobQueueDBImage,
  QueueEvent,
  QueueStats,
  QueueSubscriber,
  SerializedFileData,
  WorkDraft as WorkDraftDB,
  WorkJobPayload,
} from "./job-queue";
// ============================================
// Offline Types
// ============================================
export type {
  DuplicateCheckResult,
  OfflineCapabilities,
  OfflineDashboardData,
  OfflineSettings,
  OfflineStatus,
  OfflineWorkItem,
  SyncMetrics,
  WorkConflict,
} from "./offline";
