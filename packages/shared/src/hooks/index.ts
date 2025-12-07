// Hooks — EXPLICIT EXPORTS for tree-shaking

// ============================================================================
// ACTION
// ============================================================================
export type { ActionOperationResult } from "./action/useActionOperations";
export { useActionOperations } from "./action/useActionOperations";

// ============================================================================
// APP
// ============================================================================
export { useBrowserNavigation } from "./app/useBrowserNavigation";
export { useMerged } from "./app/useMerged";
export { useNavigateToTop } from "./app/useNavigateToTop";
export { useOffline } from "./app/useOffline";
export { useTheme } from "./app/useTheme";
export type { ToastActionOptions } from "./app/useToastAction";
export { useToastAction } from "./app/useToastAction";

// ============================================================================
// ASSESSMENT
// ============================================================================
export type { CreateAssessmentForm } from "./assessment/useCreateAssessmentWorkflow";
export { useCreateAssessmentWorkflow } from "./assessment/useCreateAssessmentWorkflow";
export { useGardenAssessments } from "./assessment/useGardenAssessments";

// ============================================================================
// AUTH
// ============================================================================
export { useAuth, useClientAuth, usePasskeyAuth, useWalletAuth } from "./auth/useAuth";
export { useUser } from "./auth/useUser";

// ============================================================================
// BLOCKCHAIN
// ============================================================================
export { ensureBaseLists } from "./blockchain/prefetch";
export { useActions, useGardeners, useGardens } from "./blockchain/useBaseLists";
export {
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
export { queryInvalidation, queryKeys } from "./query-keys";

// ============================================================================
// TRANSLATION
// ============================================================================
export { useActionTranslation } from "./translation/useActionTranslation";
export { useGardenTranslation } from "./translation/useGardenTranslation";
export { useTranslation } from "./translation/useTranslation";
// ============================================================================
// UI
// ============================================================================
export { useScrollReveal } from "./ui/useScrollReveal";

// ============================================================================
// WORK
// ============================================================================
export { useMyMergedWorks, useMyOnlineWorks, useMyWorks } from "./work/useMyWorks";
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
