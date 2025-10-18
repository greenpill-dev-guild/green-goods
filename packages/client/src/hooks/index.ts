/** Convenience re-exports for frequently used application hooks. */

export { useBrowserNavigation } from "./app/useBrowserNavigation";
export { useMerged } from "./app/useMerged";
export { useNavigateToTop } from "./app/useNavigateToTop";
// App hooks
export { useOffline } from "./app/useOffline";

// Auth hooks
export { useAuth } from "./auth/useAuth";
export { useUser } from "./auth/useUser";
export { useActions, useGardeners, useGardens } from "./blockchain/useBaseLists";
// Blockchain hooks
export { useChainConfig } from "./blockchain/useChainConfig";

// Garden hooks
export { useAutoJoinRootGarden } from "./garden/useAutoJoinRootGarden";
export { useGardenTabs } from "./garden/useGardenTabs";

// Work hooks
export { useStorageManager } from "./work/useStorageManager";
export { useWorkApprovals } from "./work/useWorkApprovals";
export { useWorks } from "./work/useWorks";
