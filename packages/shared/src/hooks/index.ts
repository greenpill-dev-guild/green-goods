// Re-export all hooks organized by domain - EXPLICIT EXPORTS for tree-shaking

// From app/
export { useBrowserNavigation } from "./app/useBrowserNavigation";
export { useDarkMode } from "./app/useDarkMode";
export type { ThemeMode } from "./app/useDarkMode";
export { useMerged } from "./app/useMerged";
export { useNavigateToTop } from "./app/useNavigateToTop";
export { useOffline } from "./app/useOffline";
export { useToastAction } from "./app/useToastAction";
export type { ToastActionOptions } from "./app/useToastAction";

// From assessment/
export { useCreateAssessmentWorkflow } from "./assessment/useCreateAssessmentWorkflow";
export type { CreateAssessmentForm } from "./assessment/useCreateAssessmentWorkflow";

// From auth/
export { useAuth, usePasskeyAuth } from "./auth/useAuth";
export { useUser } from "./auth/useUser";

// From blockchain/
export { ensureBaseLists } from "./blockchain/prefetch";
export { useActions, useGardens, useGardeners } from "./blockchain/useBaseLists";
export {
  useCurrentChain,
  useEASConfig,
  useNetworkConfig,
  useChainConfig,
} from "./blockchain/useChainConfig";
export { useEnsName } from "./blockchain/useEnsName";
export { useEnsAddress } from "./blockchain/useEnsAddress";
export { useDeploymentRegistry } from "./blockchain/useDeploymentRegistry";
export type { DeploymentRegistryPermissions } from "./blockchain/useDeploymentRegistry";

// From garden/
export { useAutoJoinRootGarden } from "./garden/useAutoJoinRootGarden";
export { useGardenTabs, GardenTab } from "./garden/useGardenTabs";
export { useGardenAssessments } from "./garden/useGardenAssessments";
export { useGardenInvites } from "./garden/useGardenInvites";
export type { GardenInvite } from "./garden/useGardenInvites";
export { useGardenOperations } from "./garden/useGardenOperations";
export { useGardenPermissions } from "./garden/useGardenPermissions";
export type { GardenPermissions } from "./garden/useGardenPermissions";
export { useCreateGardenWorkflow } from "./garden/useCreateGardenWorkflow";

// From gardener/
export { useGardenerProfile } from "./gardener/useGardenerProfile";
export type { GardenerProfile } from "./gardener/useGardenerProfile";
export { useRole } from "./gardener/useRole";
export type { UserRole, RoleInfo } from "./gardener/useRole";

// From work/
export { useStorageManager } from "./work/useStorageManager";
export type { UseStorageManagerReturn } from "./work/useStorageManager";
export { useWorkApproval } from "./work/useWorkApproval";
export { useWorkApprovals } from "./work/useWorkApprovals";
export type { EnhancedWorkApproval } from "./work/useWorkApprovals";
export {
  useWorks,
  usePendingWorksCount,
  useQueueStatistics,
  jobToWork,
} from "./work/useWorks";

// From query-keys.ts
export {
  queryKeys,
  queryInvalidation,
} from "./query-keys";
export type {
  QueryKey,
  WorksQueryKey,
  QueueQueryKey,
} from "./query-keys";
