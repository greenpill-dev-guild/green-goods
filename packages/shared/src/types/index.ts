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
// Conviction Types
// ============================================
export type {
  AllocateHypercertSupportParams,
  ConvictionWeight,
  DeregisterHypercertParams,
  HypercertEntry,
  HypercertSignal,
  MemberPower,
  RegisterHypercertParams,
  SetConvictionStrategiesParams,
  SetDecayParams,
  SetPointsPerVoterParams,
  SetRoleHatIdsParams,
  VoterAllocation,
} from "./conviction";
// ============================================
// Cookie Jar Types
// ============================================
export type {
  CookieJar,
  CookieJarAdminParams,
  CookieJarDepositParams,
  CookieJarEmergencyWithdrawParams,
  CookieJarUpdateIntervalParams,
  CookieJarUpdateMaxWithdrawalParams,
  CookieJarWithdrawParams,
} from "./cookie-jar";
// ============================================
// Domain Types
// ============================================
export type {
  Action,
  ActionCard,
  ActionInstructionConfig,
  Address,
  AssessmentAttachment,
  AssessmentDraft,
  AssessmentWorkflowParams,
  CreateAssessmentForm, // @deprecated - use AssessmentWorkflowParams
  ENSRegistrationData,
  Garden,
  GardenAssessment,
  GardenCard,
  GardenerCard,
  Link,
  SmartOutcome,
  Work,
  WorkApproval,
  WorkApprovalDraft,
  WorkCard,
  WorkDisplayStatus,
  WorkDraft, // @deprecated - use WorkSubmission
  WorkInput,
  WorkMetadata,
  WorkMetadataV1,
  WorkSubmission,
} from "./domain";
// Re-export enums (value exports, not type)
export {
  Capital,
  Confidence,
  CynefinPhase,
  DOMAIN_COLORS,
  Domain,
  VerificationMethod,
} from "./domain";
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
export type {
  AllocateYieldParams,
  GardenCommunity,
  GardenSignalPool,
  SetSplitRatioParams,
  SplitConfig,
  WeightSchemeConfig,
  YieldAllocation,
} from "./gardens-community";
// ============================================
// Gardens Community Types
// ============================================
export {
  DEFAULT_SPLIT_CONFIG,
  MIN_YIELD_THRESHOLD_USD,
  PoolType,
  WEIGHT_SCHEME_VALUES,
  WeightScheme,
} from "./gardens-community";
export type {
  ActionDomain,
  ActionType,
  AllowlistEntry,
  AttestationFilters,
  AttestationRef,
  CapitalType,
  CreateListingParams,
  CustomMetric,
  FractionTrade,
  GreenGoodsExtension,
  HypercertAllowlistClaim,
  HypercertAttestation,
  HypercertDraft,
  HypercertListing,
  HypercertMetadata,
  HypercertRecord,
  HypercertStatus,
  ListingStatus,
  MetricValue,
  OutcomeMetrics,
  PredefinedMetric,
  PropertyDefinition,
  RegisteredOrderView,
  ScopeDefinition,
  TimeframeDefinition,
  WorkApprovalNode,
} from "./hypercerts";
// ============================================
// Hypercert Types
// ============================================
export { ACTION_DOMAINS, LISTING_DEFAULTS } from "./hypercerts";
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
  WorkDraft as WorkDraftDB, // @deprecated - use WorkDraftRecord
  WorkDraftRecord,
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
// ============================================
// Ops Runner Types
// ============================================
export type {
  OpsDeployRequest,
  OpsJob,
  OpsJobLogEntry,
  OpsJobLogsState,
  OpsJobStatus,
  OpsJobType,
  OpsRunnerChallengeResponse,
  OpsRunnerHealth,
  OpsRunnerJobResponse,
  OpsRunnerJobsResponse,
  OpsRunnerScriptDefinition,
  OpsRunnerScriptsResponse,
  OpsRunnerSession,
  OpsRunnerVerifyResponse,
  OpsRunScriptRequest,
  OpsUpgradeRequest,
} from "./ops";
// ============================================
// Vault Types
// ============================================
export type {
  DepositParams,
  EmergencyPauseParams,
  GardenVault,
  HarvestParams,
  VaultDeposit,
  VaultEvent,
  VaultEventType,
  VaultPreview,
  WithdrawParams,
} from "./vaults";
