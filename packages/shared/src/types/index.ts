/**
 * Type Exports - @green-goods/shared
 *
 * Organized by domain:
 *
 * DOMAIN ENTITIES (domain.ts):
 *   Garden, GardenCard, GardenAssessment - Garden-related types
 *   Action, ActionCard, WorkInput - Action configuration
 *   Work, WorkCard, WorkSubmission, WorkApproval - Work documentation
 *   GardenerCard - User profiles
 *
 * API RESPONSES:
 *   eas-responses.ts - Parsed EAS attestation data (EASWork, EASWorkApproval, etc.)
 *   indexer-responses.ts - Green Goods indexer responses (IndexerGarden, etc.)
 *
 * OFFLINE/QUEUE SYSTEM:
 *   job-queue.ts - Job queue, WorkDraftRecord, file serialization
 *   offline.ts - OfflineStatus, SyncMetrics, WorkConflict
 *
 * INFRASTRUCTURE:
 *   auth.ts - AuthMode, BaseAuthContext
 *   contracts.ts - NetworkContracts, DeploymentParams
 *   blockchain.ts - ChainId, DeploymentConfig
 *
 * GENERATED (do not edit manually):
 *   green-goods.d.ts - Indexer GraphQL schema (gql.tada)
 *   eas.d.ts - EAS GraphQL schema (gql.tada)
 *
 * TYPE DECLARATIONS (*.d.ts):
 *   global.d.ts - JSX intrinsic elements (AppKit web components)
 *   react-window.d.ts - Virtual scrolling types (library ships Flow types)
 *   temporal.d.ts - Temporal API declarations
 */

// ============================================
// Auth Types
// ============================================
export type { AuthMode, BaseAuthContext } from "./auth";
// ============================================
// Blockchain Types
// ============================================
export type { ChainId, DeploymentConfig } from "./blockchain";
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
  Work,
  WorkApproval,
  WorkApprovalDraft,
  WorkCard,
  WorkSubmission,
  WorkDraft, // @deprecated - use WorkSubmission
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
  WorkDraftRecord,
  WorkDraft as WorkDraftDB, // @deprecated - use WorkDraftRecord
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
