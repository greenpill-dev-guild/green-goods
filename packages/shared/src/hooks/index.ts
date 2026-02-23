// Hooks — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// UTILS (Low-level hooks for common patterns)
// ============================================================================
export { useEventListener, useWindowEvent, useDocumentEvent } from "./utils/useEventListener";
export { useTimeout, useDelayedInvalidation } from "./utils/useTimeout";
export { useAsyncEffect, useAsyncSetup } from "./utils/useAsyncEffect";
export type {
  UseCopyToClipboardOptions,
  UseCopyToClipboardReturn,
} from "./utils/useCopyToClipboard";
export { useCopyToClipboard } from "./utils/useCopyToClipboard";
export { useDebouncedValue } from "./utils/useDebouncedValue";
export { useAddressInput } from "./utils/useAddressInput";
export { useMutationLock } from "./utils/useMutationLock";
export { useBeforeUnloadWhilePending } from "./utils/useBeforeUnloadWhilePending";

// ============================================================================
// ACTION
// ============================================================================
export type { ActionOperationResult } from "./action/useActionOperations";
export { useActionOperations } from "./action/useActionOperations";
export type { CreateActionFormData } from "./action/useActionForm";
export { createActionSchema } from "./action/useActionForm";

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
export type {
  AssessmentDraftRecord,
  UseAssessmentDraftResult,
} from "./assessment/useAssessmentDraft";
export { useAssessmentDraft } from "./assessment/useAssessmentDraft";
export type { AssessmentFormData, UseAssessmentFormReturn } from "./assessment/useAssessmentForm";
export {
  assessmentFormSchema,
  useAssessmentForm,
  createDefaultAssessmentFormData,
} from "./assessment/useAssessmentForm";
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
// COOKIE JAR
// ============================================================================
export { useGardenCookieJars } from "./cookie-jar/useGardenCookieJars";
export { useCookieJarWithdraw } from "./cookie-jar/useCookieJarWithdraw";
export { useCookieJarDeposit } from "./cookie-jar/useCookieJarDeposit";
export {
  useCookieJarPause,
  useCookieJarUnpause,
  useCookieJarUpdateMaxWithdrawal,
  useCookieJarUpdateInterval,
  useCookieJarEmergencyWithdraw,
} from "./cookie-jar/useCookieJarAdmin";
export { useUserCookieJars } from "./cookie-jar/useUserCookieJars";

// ============================================================================
// CONVICTION VOTING
// ============================================================================
export { useConvictionStrategies } from "./conviction/useConvictionStrategies";
export { useSetConvictionStrategies } from "./conviction/useSetConvictionStrategies";
export { useRegisteredHypercerts } from "./conviction/useRegisteredHypercerts";
export { useHypercertConviction } from "./conviction/useHypercertConviction";
export { useMemberVotingPower } from "./conviction/useMemberVotingPower";
export { useAllocateHypercertSupport } from "./conviction/useAllocateHypercertSupport";
export { useRegisterHypercert } from "./conviction/useRegisterHypercert";
export { useDeregisterHypercert } from "./conviction/useDeregisterHypercert";
export { useSetDecay } from "./conviction/useSetDecay";
export { useSetPointsPerVoter } from "./conviction/useSetPointsPerVoter";
export { useSetRoleHatIds } from "./conviction/useSetRoleHatIds";
export { useGardenCommunity } from "./conviction/useGardenCommunity";
export { useGardenPools } from "./conviction/useGardenPools";
export { useCreateGardenPools } from "./conviction/useCreateGardenPools";

// ============================================================================
// YIELD
// ============================================================================
export { useAllocateYield } from "./yield/useAllocateYield";
export { useYieldAllocations } from "./yield/useYieldAllocations";

// ============================================================================
// ENS (Subdomain registration via CCIP)
// ============================================================================
export type { ENSClaimResult } from "./ens/useENSClaim";
export { useENSClaim } from "./ens/useENSClaim";
export { useENSRegistrationStatus } from "./ens/useENSRegistrationStatus";
export { useProtocolMemberStatus } from "./ens/useProtocolMemberStatus";
export type { SlugFormValues } from "./ens/useSlugForm";
export { slugSchema, useSlugForm } from "./ens/useSlugForm";
export { useSlugAvailability } from "./ens/useSlugAvailability";

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
  createGardenSchema,
  gardenStepFields,
  useCreateGardenForm,
  createDefaultGardenForm,
} from "./garden/useCreateGardenForm";
export type { GardenDraft, UseGardenDraftResult } from "./garden/useGardenDraft";
export { useGardenDraft } from "./garden/useGardenDraft";
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
export { useGardenDomains } from "./garden/useGardenDomains";
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
// ROLES
// ============================================================================
export type { UseGardenRolesResult } from "./roles/useGardenRoles";
export { useGardenRoles } from "./roles/useGardenRoles";
export type { UseHasRoleResult } from "./roles/useHasRole";
export { useHasRole } from "./roles/useHasRole";
export type { RolePermissions } from "./roles/useRolePermissions";
export { useRolePermissions } from "./roles/useRolePermissions";

// ============================================================================
// VAULT / TREASURY
// ============================================================================
export { useGardenVaults } from "./vault/useGardenVaults";
export { useVaultDeposits } from "./vault/useVaultDeposits";
export { useVaultEvents } from "./vault/useVaultEvents";
export type { UseDepositFormResult } from "./vault/useDepositForm";
export { useDepositForm } from "./vault/useDepositForm";
export { useVaultPreview } from "./vault/useVaultPreview";
export {
  useConfigureVaultRoles,
  useEmergencyPause,
  useHarvest,
  useVaultDeposit,
  useVaultWithdraw,
} from "./vault/useVaultOperations";

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
export { useCreateHypercertWorkflow } from "./hypercerts/useCreateHypercertWorkflow";
export { useHypercertAllowlist } from "./hypercerts/useHypercertAllowlist";
export { useHypercertContributorWeights } from "./hypercerts/useHypercertContributorWeights";
export type { UseHypercertDraftResult } from "./hypercerts/useHypercertDraft";
export { useHypercertDraft } from "./hypercerts/useHypercertDraft";
export type {
  UseHypercertsParams,
  UseHypercertsResult,
  OptimisticHypercertData,
  HypercertSyncStatus,
} from "./hypercerts/useHypercerts";
export { useHypercerts } from "./hypercerts/useHypercerts";
export type { UseMintHypercertResult } from "./hypercerts/useMintHypercert";
export { useMintHypercert } from "./hypercerts/useMintHypercert";
// Marketplace hooks
export type { UseHypercertListingsResult } from "./hypercerts/useHypercertListings";
export { useHypercertListings } from "./hypercerts/useHypercertListings";
export type { UseMarketplaceApprovalsResult } from "./hypercerts/useMarketplaceApprovals";
export { useMarketplaceApprovals } from "./hypercerts/useMarketplaceApprovals";
export type { UseTradeHistoryResult } from "./hypercerts/useTradeHistory";
export { useTradeHistory } from "./hypercerts/useTradeHistory";
export type { UseCreateListingResult, ListingStep } from "./hypercerts/useCreateListing";
export { useCreateListing } from "./hypercerts/useCreateListing";
export type { UseCancelListingResult } from "./hypercerts/useCancelListing";
export { useCancelListing } from "./hypercerts/useCancelListing";
export type { UseBatchListForYieldResult, BatchProgress } from "./hypercerts/useBatchListForYield";
export { useBatchListForYield } from "./hypercerts/useBatchListForYield";

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

// ============================================================================
// WORK
// ============================================================================
export { useDraftAutoSave } from "./work/useDraftAutoSave";
export { useDraftResume } from "./work/useDraftResume";
export type { DraftWithImages, UseDraftsReturn } from "./work/useDrafts";
export { useDrafts } from "./work/useDrafts";
export { useMyOnlineWorks, useMyWorks } from "./work/useMyWorks";
export { useWorkApproval } from "./work/useWorkApproval";
export { useBatchWorkApproval } from "./work/useBatchWorkApproval";
export { useBatchWorkSync } from "./work/useBatchWorkSync";
export type { EnhancedWorkApproval } from "./work/useWorkApprovals";
export { useWorkApprovals } from "./work/useWorkApprovals";
export type { WorkFormData } from "./work/useWorkForm";
export { buildWorkFormSchema, useWorkForm, workFormSchema } from "./work/useWorkForm";
export { useWorkImages } from "./work/useWorkImages";
export { useWorkMutation } from "./work/useWorkMutation";
export type { UseWorksOptions } from "./work/useWorks";
export {
  jobToWork,
  usePendingWorksCount,
  useQueueStatistics,
  useWorks,
} from "./work/useWorks";
export type {
  SubmissionProgressState,
  SubmissionStage,
  UseSubmissionProgressReturn,
} from "./work/useSubmissionProgress";
export { useSubmissionProgress } from "./work/useSubmissionProgress";
export type { UseWorkMutationWithProgressReturn } from "./work/useWorkMutationWithProgress";
export { useWorkMutationWithProgress } from "./work/useWorkMutationWithProgress";
