// Hooks — EXPLICIT EXPORTS for tree-shaking

export type { CreateActionFormData } from "./action/useActionForm";
export { createActionSchema } from "./action/useActionForm";
// ============================================================================
// ACTION
// ============================================================================
export type { ActionOperationResult } from "./action/useActionOperations";
export { useActionOperations } from "./action/useActionOperations";
export type {
  ActionFiltersState,
  ActionSortOrder,
  UseFilteredActionsResult,
} from "./action/useFilteredActions";
export { useFilteredActions } from "./action/useFilteredActions";
// ============================================================================
// ANALYTICS
// ============================================================================
export type { UseAnalyticsIdentityOptions } from "./analytics/useAnalyticsIdentity";
export { useAnalyticsIdentity } from "./analytics/useAnalyticsIdentity";
export type { UsePageViewOptions } from "./analytics/usePageView";
export { usePageView } from "./analytics/usePageView";
// ============================================================================
// APP
// ============================================================================
export { useBrowserNavigation } from "./app/useBrowserNavigation";
export { useUrlFilters } from "./app/useUrlFilters";
// ============================================================================
// UI
// ============================================================================
export type { CarouselContextProps, CarouselProps } from "./app/useCarousel";
export { CarouselContext, useCarousel } from "./app/useCarousel";
export type { DebugModeState } from "./app/useDebugMode";
export { useDebugMode } from "./app/useDebugMode";
export type {
  InstallAction,
  InstallGuidance,
  InstallScenario,
  ManualInstallStep,
} from "./app/useInstallGuidance";
export { useInstallGuidance } from "./app/useInstallGuidance";
export type {
  UseLoadingWithMinDurationOptions,
  UseLoadingWithMinDurationResult,
} from "./app/useLoadingWithMinDuration";
export { useLoadingWithMinDuration } from "./app/useLoadingWithMinDuration";
export { useMerged } from "./app/useMerged";
export type { NavigateToTopOptions } from "./app/useNavigateToTop";
export { useNavigateToTop } from "./app/useNavigateToTop";
export { useScrollToTop } from "./app/useScrollToTop";
export { useOffline } from "./app/useOffline";
export type { ServiceWorkerUpdateState } from "./app/useServiceWorkerUpdate";
export { useServiceWorkerUpdate } from "./app/useServiceWorkerUpdate";
export { useTheme } from "./app/useTheme";
export type { ToastActionOptions } from "./app/useToastAction";
export { useToastAction } from "./app/useToastAction";
export type {
  AssessmentDraftRecord,
  UseAssessmentDraftResult,
} from "./assessment/useAssessmentDraft";
export { useAssessmentDraft } from "./assessment/useAssessmentDraft";
export type { AssessmentFormData, UseAssessmentFormReturn } from "./assessment/useAssessmentForm";
export {
  assessmentFormSchema,
  createDefaultAssessmentFormData,
  useAssessmentForm,
} from "./assessment/useAssessmentForm";
export type {
  AssessmentStepId,
  CreateAssessmentFormData,
  UseCreateAssessmentFormReturn,
} from "./assessment/useCreateAssessmentForm";
export {
  assessmentStepFields,
  createAssessmentFormSchema,
  createDefaultAssessmentForm,
  useCreateAssessmentForm,
} from "./assessment/useCreateAssessmentForm";
// ============================================================================
// ASSESSMENT
// ============================================================================
export type { CreateAssessmentForm } from "./assessment/useCreateAssessmentWorkflow";
export { useCreateAssessmentWorkflow } from "./assessment/useCreateAssessmentWorkflow";
export { useAllAssessments } from "./assessment/useAllAssessments";
export { useGardenAssessments } from "./assessment/useGardenAssessments";
// ============================================================================
// AUTH
// ============================================================================
export type { AuthContextType, AuthMode } from "./auth/useAuth";
export { useAuth, useAuthContext } from "./auth/useAuth";
export { getPrimaryAddress, usePrimaryAddress } from "./auth/usePrimaryAddress";
export { useUser } from "./auth/useUser";
// ============================================================================
// BLOCKCHAIN
// ============================================================================
export { ensureBaseLists } from "./blockchain/prefetch";
export { useActions, useGardeners, useGardens } from "./blockchain/useBaseLists";
export {
  // Pure functions (preferred for non-React contexts)
  getCurrentChain,
  getEASConfigForChain,
  getNetworkConfigForChain,
  // Hook wrappers (for React component consistency)
  useChainConfig,
  useCurrentChain,
  useEASConfig,
  useNetworkConfig,
} from "./blockchain/useChainConfig";
export type {
  DeploymentAllowlistResult,
  DeploymentRegistryPermissions,
} from "./blockchain/useDeploymentRegistry";
export {
  DEPLOYMENT_REGISTRY_ABI,
  useDeploymentAllowlist,
  useDeploymentRegistry,
} from "./blockchain/useDeploymentRegistry";
export { useEnsAddress } from "./blockchain/useEnsAddress";
export { useEnsAvatar } from "./blockchain/useEnsAvatar";
export { useEnsName } from "./blockchain/useEnsName";
export type { UseEnsQueryOptions, UseEnsQueryResult } from "./blockchain/useEnsQuery";
export { useEnsQuery } from "./blockchain/useEnsQuery";
export { useTransactionSender } from "./blockchain/useTransactionSender";
// Suspense-enabled hooks (for use with SuspenseBoundary)
export {
  useSuspenseActions,
  useSuspenseGardeners,
  useSuspenseGardens,
} from "./blockchain/useSuspenseBaseLists";
export { useAllocateHypercertSupport } from "./conviction/useAllocateHypercertSupport";
// ============================================================================
// CONVICTION VOTING
// ============================================================================
export { useConvictionStrategies } from "./conviction/useConvictionStrategies";
export { useCreateGardenPools } from "./conviction/useCreateGardenPools";
export { useDeregisterHypercert } from "./conviction/useDeregisterHypercert";
export { useGardenCommunity } from "./conviction/useGardenCommunity";
export { useGardenPools } from "./conviction/useGardenPools";
export { useHypercertConviction } from "./conviction/useHypercertConviction";
export { useMemberVotingPower } from "./conviction/useMemberVotingPower";
export { useRegisteredHypercerts } from "./conviction/useRegisteredHypercerts";
export { useRegisterHypercert } from "./conviction/useRegisterHypercert";
export { useSetConvictionStrategies } from "./conviction/useSetConvictionStrategies";
export { useSetDecay } from "./conviction/useSetDecay";
export { useSetPointsPerVoter } from "./conviction/useSetPointsPerVoter";
export { useSetRoleHatIds } from "./conviction/useSetRoleHatIds";
export {
  useCookieJarEmergencyWithdraw,
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateInterval,
  useCookieJarUpdateMaxWithdrawal,
} from "./cookie-jar/useCookieJarAdmin";
export { useCookieJarDeposit } from "./cookie-jar/useCookieJarDeposit";
export { useCookieJarWithdraw } from "./cookie-jar/useCookieJarWithdraw";
// ============================================================================
// COOKIE JAR
// ============================================================================
export { useGardenCookieJars } from "./cookie-jar/useGardenCookieJars";
export { useUserCookieJars } from "./cookie-jar/useUserCookieJars";
// ============================================================================
// ENS (Subdomain registration via CCIP)
// ============================================================================
export type { ENSClaimResult } from "./ens/useENSClaim";
export { useENSClaim } from "./ens/useENSClaim";
export { useENSRegistrationStatus } from "./ens/useENSRegistrationStatus";
export { useProtocolMemberStatus } from "./ens/useProtocolMemberStatus";
export { useSlugAvailability } from "./ens/useSlugAvailability";
export type { SlugFormValues } from "./ens/useSlugForm";
export { slugSchema, useSlugForm } from "./ens/useSlugForm";
// ============================================================================
// GARDEN
// ============================================================================
export type {
  GardenOperationConfig,
  GardenOperationResult,
  OptimisticUpdateCallback,
} from "./garden/createGardenOperation";
export { createGardenOperation, GARDEN_OPERATIONS } from "./garden/createGardenOperation";
export { checkMembership, useAutoJoinRootGarden } from "./garden/useAutoJoinRootGarden";
export type {
  CreateGardenFormData,
  GardenStepId,
  UseCreateGardenFormReturn,
} from "./garden/useCreateGardenForm";
export {
  createDefaultGardenForm,
  createGardenSchema,
  GARDEN_NAME_MAX_LENGTH,
  gardenStepFields,
  useCreateGardenForm,
} from "./garden/useCreateGardenForm";
export { useCreateGardenWorkflow } from "./garden/useCreateGardenWorkflow";
export type {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
  UseFilteredGardensResult,
} from "./garden/useFilteredGardens";
export { useFilteredGardens } from "./garden/useFilteredGardens";
export { useGardenDerivedState } from "./garden/useGardenDerivedState";
export { useGardenDetailData } from "./garden/useGardenDetailData";
export { useGardenDomains } from "./garden/useGardenDomains";
export type { GardenDraft, UseGardenDraftResult } from "./garden/useGardenDraft";
export { useGardenDraft } from "./garden/useGardenDraft";
export type { GardenInvite } from "./garden/useGardenInvites";
export { useGardenInvites } from "./garden/useGardenInvites";
export { useGardenOperations } from "./garden/useGardenOperations";
export type { GardenPermissions } from "./garden/useGardenPermissions";
export { useGardenPermissions } from "./garden/useGardenPermissions";
export { GardenTab, useGardenTabs } from "./garden/useGardenTabs";
export {
  checkGardenOpenJoining,
  isGardenMember,
  useJoinGarden,
} from "./garden/useJoinGarden";
export { useOpenMinting, useSetOpenMinting } from "./garden/useOpenMinting";
export { useSetGardenDomains } from "./garden/useSetGardenDomains";
export {
  useSetMaxGardeners,
  useSetOpenJoining,
  useUpdateGardenBannerImage,
  useUpdateGardenDescription,
  useUpdateGardenLocation,
  useUpdateGardenMetadata,
  useUpdateGardenName,
} from "./garden/useUpdateGarden";
// ============================================================================
// GARDENER
// ============================================================================
export type { GardenerProfile } from "./gardener/useGardenerProfile";
export { useGardenerProfile } from "./gardener/useGardenerProfile";
export type { RoleInfo, UserRole } from "./gardener/useRole";
export { useRole } from "./gardener/useRole";
// ============================================================================
// HYPERCERTS
// Hooks are grouped together with useHypercert* prefix for discoverability
// ============================================================================
export type {
  AttestationFilters,
  UseAttestationsResult,
} from "./hypercerts/useAttestations";
// Re-export with consistent naming (useHypercertAttestations instead of useAttestations)
export { useAttestations as useHypercertAttestations } from "./hypercerts/useAttestations";
export type { BatchProgress, UseBatchListForYieldResult } from "./hypercerts/useBatchListForYield";
export { useBatchListForYield } from "./hypercerts/useBatchListForYield";
export type { UseCancelListingResult } from "./hypercerts/useCancelListing";
export { useCancelListing } from "./hypercerts/useCancelListing";
export { useCreateHypercertWorkflow } from "./hypercerts/useCreateHypercertWorkflow";
export type { ListingStep, UseCreateListingResult } from "./hypercerts/useCreateListing";
export { useCreateListing } from "./hypercerts/useCreateListing";
export { useHypercertAllowlist } from "./hypercerts/useHypercertAllowlist";
export { useHypercertContributorWeights } from "./hypercerts/useHypercertContributorWeights";
export type { UseHypercertDraftResult } from "./hypercerts/useHypercertDraft";
export { useHypercertDraft } from "./hypercerts/useHypercertDraft";
// Marketplace hooks
export type { UseHypercertListingsResult } from "./hypercerts/useHypercertListings";
export { useHypercertListings } from "./hypercerts/useHypercertListings";
export type {
  HypercertSyncStatus,
  OptimisticHypercertData,
  UseHypercertsParams,
  UseHypercertsResult,
} from "./hypercerts/useHypercerts";
export { useHypercerts } from "./hypercerts/useHypercerts";
export type { UseMarketplaceApprovalsResult } from "./hypercerts/useMarketplaceApprovals";
export { useMarketplaceApprovals } from "./hypercerts/useMarketplaceApprovals";
export type { UseMintHypercertResult } from "./hypercerts/useMintHypercert";
export { useMintHypercert } from "./hypercerts/useMintHypercert";
export type { UseTradeHistoryResult } from "./hypercerts/useTradeHistory";
export { useTradeHistory } from "./hypercerts/useTradeHistory";
// ============================================================================
// OPS RUNNER (Local deploy/upgrade/script orchestration)
// ============================================================================
export {
  getOpsRunnerBaseUrl,
  useOpsDeployPlan,
  useOpsFinalizeDeploy,
  useOpsFinalizeUpgrade,
  useOpsJobLogs,
  useOpsRunnerAuth,
  useOpsRunnerHealth,
  useOpsRunnerJob,
  useOpsRunnerJobs,
  useOpsRunnerScripts,
  useOpsRunnerSession,
  useOpsRunScript,
  useOpsUpgradePlan,
} from "./ops/useOpsRunner";
// ============================================================================
// QUERY KEYS
// ============================================================================
export type { QueryKey, QueueQueryKey, WorksQueryKey } from "./query-keys";
// ============================================================================
// STORAGE
// ============================================================================
export {
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  queryInvalidation,
  queryKeys,
  STALE_TIME_FAST,
  STALE_TIME_MEDIUM,
  STALE_TIME_RARE,
  STALE_TIME_SLOW,
} from "./query-keys";
// ============================================================================
// ROLES
// ============================================================================
export type { UseGardenRolesResult } from "./roles/useGardenRoles";
export { useGardenRoles } from "./roles/useGardenRoles";
export type { UseHasRoleResult } from "./roles/useHasRole";
export { useHasRole } from "./roles/useHasRole";
export type { RolePermissions } from "./roles/useRolePermissions";
export { useRolePermissions } from "./roles/useRolePermissions";
// ============================================================================
// TRANSLATION
// ============================================================================
export { useActionTranslation } from "./translation/useActionTranslation";
export { useGardenTranslation } from "./translation/useGardenTranslation";
export { useTranslation } from "./translation/useTranslation";
export { useAddressInput } from "./utils/useAddressInput";
export { useAsyncEffect, useAsyncSetup } from "./utils/useAsyncEffect";
export type {
  UseAudioRecordingOptions,
  UseAudioRecordingReturn,
} from "./utils/useAudioRecording";
export { useAudioRecording } from "./utils/useAudioRecording";
export { useBeforeUnloadWhilePending } from "./utils/useBeforeUnloadWhilePending";
export type {
  UseCopyToClipboardOptions,
  UseCopyToClipboardReturn,
} from "./utils/useCopyToClipboard";
export { useCopyToClipboard } from "./utils/useCopyToClipboard";
export { useDebouncedValue } from "./utils/useDebouncedValue";
// ============================================================================
// UTILS (Low-level hooks for common patterns)
// ============================================================================
export { useDocumentEvent, useEventListener, useWindowEvent } from "./utils/useEventListener";
export { useMutationLock } from "./utils/useMutationLock";
export { useDelayedInvalidation, useTimeout } from "./utils/useTimeout";
export type { UseDepositFormResult } from "./vault/useDepositForm";
export { useDepositForm } from "./vault/useDepositForm";
// ============================================================================
// VAULT / TREASURY
// ============================================================================
export { useAllVaultDeposits } from "./vault/useAllVaultDeposits";
export { useBatchConvertToAssets } from "./vault/useBatchConvertToAssets";
export { useFunderLeaderboard } from "./vault/useFunderLeaderboard";
export { useGardenVaults } from "./vault/useGardenVaults";
export { useMyVaultDeposits } from "./vault/useMyVaultDeposits";
export { useVaultDeposits } from "./vault/useVaultDeposits";
export { useVaultEvents } from "./vault/useVaultEvents";
export {
  useEnableAutoAllocate,
  useEmergencyPause,
  useHarvest,
  useVaultDeposit,
  useVaultWithdraw,
} from "./vault/useVaultOperations";
export { useVaultPreview } from "./vault/useVaultPreview";
export { useHarvestableYield } from "./vault/useHarvestableYield";
export { useStrategyRate } from "./vault/useStrategyRate";
export { useBatchWorkApproval } from "./work/useBatchWorkApproval";
export { useBatchWorkSync } from "./work/useBatchWorkSync";

// ============================================================================
// WORK
// ============================================================================
export { useDraftAutoSave } from "./work/useDraftAutoSave";
export type { PlatformStats } from "./work/usePlatformStats";
export { usePlatformStats } from "./work/usePlatformStats";
export { useDraftResume } from "./work/useDraftResume";
export type { DraftWithImages, UseDraftsReturn } from "./work/useDrafts";
export { useDrafts } from "./work/useDrafts";
export { useMyOnlineWorks, useMyWorks } from "./work/useMyWorks";
export type {
  SubmissionProgressState,
  SubmissionStage,
  UseSubmissionProgressReturn,
} from "./work/useSubmissionProgress";
export { useSubmissionProgress } from "./work/useSubmissionProgress";
export { useWorkApproval } from "./work/useWorkApproval";
export type { EnhancedWorkApproval } from "./work/useWorkApprovals";
export { useWorkApprovals } from "./work/useWorkApprovals";
export type { WorkFormData } from "./work/useWorkForm";
export { buildWorkFormSchema, useWorkForm, workFormSchema } from "./work/useWorkForm";
export { useWorkImages } from "./work/useWorkImages";
export { useWorkMutation } from "./work/useWorkMutation";
export type { UseWorkMutationWithProgressReturn } from "./work/useWorkMutationWithProgress";
export { useWorkMutationWithProgress } from "./work/useWorkMutationWithProgress";
export type { UseWorksOptions } from "./work/useWorks";
export {
  jobToWork,
  usePendingWorksCount,
  useQueueStatistics,
  useWorks,
} from "./work/useWorks";
// ============================================================================
// YIELD
// ============================================================================
export { useAllocateYield } from "./yield/useAllocateYield";
export { usePendingYield } from "./yield/usePendingYield";
export {
  useProtocolYieldSummary,
  type ProtocolYieldSummary,
} from "./yield/useProtocolYieldSummary";
export { useSplitConfig } from "./yield/useSplitConfig";
export { useYieldAllocations } from "./yield/useYieldAllocations";
