// Hooks — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// ACTION
// ============================================================================
export type { ActionOperationResult } from "./action/useActionOperations";
export { useActionOperations } from "./action/useActionOperations";

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
export type { DebugModeState } from "./app/useDebugMode";
export { useDebugMode } from "./app/useDebugMode";
export { useMerged } from "./app/useMerged";
export type { NavigateToTopOptions } from "./app/useNavigateToTop";
export { useNavigateToTop } from "./app/useNavigateToTop";
export { useOffline } from "./app/useOffline";
export { useTheme } from "./app/useTheme";
export type { ToastActionOptions } from "./app/useToastAction";
export { useToastAction } from "./app/useToastAction";
export type {
  MutationToastConfig,
  MutationTrackingConfig,
  UseMutationWithTrackingOptions,
} from "./app/useMutationWithTracking";
export { useMutationWithTracking } from "./app/useMutationWithTracking";
export type {
  UseLoadingWithMinDurationOptions,
  UseLoadingWithMinDurationResult,
} from "./app/useLoadingWithMinDuration";
export { useLoadingWithMinDuration } from "./app/useLoadingWithMinDuration";
export type { ServiceWorkerUpdateState } from "./app/useServiceWorkerUpdate";
export { useServiceWorkerUpdate } from "./app/useServiceWorkerUpdate";
export type {
  InstallAction,
  InstallGuidance,
  InstallScenario,
  ManualInstallStep,
} from "./app/useInstallGuidance";
export { useInstallGuidance } from "./app/useInstallGuidance";

// ============================================================================
// ASSESSMENT
// ============================================================================
export type { CreateAssessmentForm } from "./assessment/useCreateAssessmentWorkflow";
export { useCreateAssessmentWorkflow } from "./assessment/useCreateAssessmentWorkflow";
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
// Suspense-enabled hooks (for use with SuspenseBoundary)
export {
  useSuspenseActions,
  useSuspenseGardeners,
  useSuspenseGardens,
} from "./blockchain/useSuspenseBaseLists";
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
export type { DeploymentRegistryPermissions } from "./blockchain/useDeploymentRegistry";
export { useDeploymentRegistry } from "./blockchain/useDeploymentRegistry";
export { useEnsAddress } from "./blockchain/useEnsAddress";
export { useEnsAvatar } from "./blockchain/useEnsAvatar";
export { useEnsName } from "./blockchain/useEnsName";
export type { UseEnsQueryOptions, UseEnsQueryResult } from "./blockchain/useEnsQuery";
export { useEnsQuery } from "./blockchain/useEnsQuery";

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
export { useCreateGardenWorkflow } from "./garden/useCreateGardenWorkflow";
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
export type {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
  UseFilteredGardensResult,
} from "./garden/useFilteredGardens";
export { useFilteredGardens } from "./garden/useFilteredGardens";

// ============================================================================
// GARDENER
// ============================================================================
export type { GardenerProfile } from "./gardener/useGardenerProfile";
export { useGardenerProfile } from "./gardener/useGardenerProfile";
export type { RoleInfo, UserRole } from "./gardener/useRole";
export { useRole } from "./gardener/useRole";

// ============================================================================
// QUERY KEYS
// ============================================================================
export type { QueryKey, QueueQueryKey, WorksQueryKey } from "./query-keys";

// ============================================================================
// STORAGE
// ============================================================================
export type { UseStorageQuotaOptions, UseStorageQuotaResult } from "./storage/useStorageQuota";
export { useStorageQuota, useStorageQuotaCheck } from "./storage/useStorageQuota";
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
// TRANSLATION
// ============================================================================
export { useActionTranslation } from "./translation/useActionTranslation";
export { useGardenTranslation } from "./translation/useGardenTranslation";
export { useTranslation } from "./translation/useTranslation";
// ============================================================================
// UI
// ============================================================================
export type { CarouselContextProps, CarouselProps } from "./app/useCarousel";
export { CarouselContext, useCarousel } from "./app/useCarousel";
export { useScrollReveal } from "./app/useScrollReveal";

// ============================================================================
// WORK
// ============================================================================
export { useDraftAutoSave } from "./work/useDraftAutoSave";
export { useDraftResume } from "./work/useDraftResume";
export type { DraftWithImages, UseDraftsReturn } from "./work/useDrafts";
export { useDrafts } from "./work/useDrafts";
export { useMyOnlineWorks, useMyWorks } from "./work/useMyWorks";
export { useWorkApproval } from "./work/useWorkApproval";
export type { EnhancedWorkApproval } from "./work/useWorkApprovals";
export { useWorkApprovals } from "./work/useWorkApprovals";
export type { WorkFormData } from "./work/useWorkForm";
export { useWorkForm, workFormSchema } from "./work/useWorkForm";
export { useWorkImages } from "./work/useWorkImages";
export { useWorkMutation } from "./work/useWorkMutation";
export {
  jobToWork,
  usePendingWorksCount,
  useQueueStatistics,
  useWorks,
} from "./work/useWorks";
