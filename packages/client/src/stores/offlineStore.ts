import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface OfflineState {
  // Core status
  isOnline: boolean;
  syncStatus: "idle" | "syncing" | "error";

  // Job queue status
  pendingCount: number;

  // Conflict resolution
  conflictCount: number;

  // Storage management
  needsCleanup: boolean;

  // Computed properties (cached and stable)
  displayPriority: "conflicts" | "cleanup" | "syncing" | "offline" | "pending" | null;
  hasIssues: boolean;

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  setSyncStatus: (status: "idle" | "syncing" | "error") => void;
  setPendingCount: (count: number) => void;
  setConflictCount: (count: number) => void;
  setNeedsCleanup: (needs: boolean) => void;

  // Computed selectors (legacy)
  getDisplayPriority: () => "conflicts" | "cleanup" | "syncing" | "offline" | "pending" | null;
}

// Helper function to compute display priority - memoized to prevent unnecessary recalculations
const computeDisplayPriority = (state: {
  conflictCount: number;
  needsCleanup: boolean;
  syncStatus: "idle" | "syncing" | "error";
  isOnline: boolean;
  pendingCount: number;
}): "conflicts" | "cleanup" | "syncing" | "offline" | "pending" | null => {
  // Priority order (highest to lowest)
  if (state.conflictCount > 0) return "conflicts";
  if (state.needsCleanup) return "cleanup";
  if (state.syncStatus === "syncing") return "syncing";
  if (!state.isOnline) return "offline";
  if (state.pendingCount > 0) return "pending";

  return null; // Nothing to show
};

// Cache for the last computed priority to prevent unnecessary updates
let lastComputedPriority: "conflicts" | "cleanup" | "syncing" | "offline" | "pending" | null = null;
let lastStateSignature = "";

const getCachedDisplayPriority = (state: any) => {
  // Create a signature of the state that affects priority
  const signature = `${state.conflictCount}-${state.needsCleanup}-${state.syncStatus}-${state.isOnline}-${state.pendingCount}`;

  // Only recompute if the signature changed
  if (signature !== lastStateSignature) {
    lastComputedPriority = computeDisplayPriority(state);
    lastStateSignature = signature;
  }

  return lastComputedPriority;
};

export const useOfflineStore = create<OfflineState>()(
  subscribeWithSelector((set, get) => {
    const computeHasIssues = (state: any) => {
      return (
        !state.isOnline ||
        state.pendingCount > 0 ||
        state.syncStatus !== "idle" ||
        state.conflictCount > 0 ||
        state.needsCleanup
      );
    };

    const initialState = {
      isOnline: navigator.onLine,
      syncStatus: "idle" as const,
      pendingCount: 0,
      conflictCount: 0,
      needsCleanup: false,
    };

    const initialDisplayPriority = getCachedDisplayPriority(initialState);
    const initialHasIssues = computeHasIssues(initialState);

    return {
      // Initial state
      ...initialState,
      displayPriority: initialDisplayPriority,
      hasIssues: initialHasIssues,

      // Actions - update both computed properties
      setOnlineStatus: (isOnline) =>
        set((state) => {
          const newState = { ...state, isOnline };
          return {
            ...newState,
            displayPriority: getCachedDisplayPriority(newState),
            hasIssues: computeHasIssues(newState),
          };
        }),
      setSyncStatus: (syncStatus) =>
        set((state) => {
          const newState = { ...state, syncStatus };
          return {
            ...newState,
            displayPriority: getCachedDisplayPriority(newState),
            hasIssues: computeHasIssues(newState),
          };
        }),
      setPendingCount: (pendingCount) =>
        set((state) => {
          const newState = { ...state, pendingCount };
          return {
            ...newState,
            displayPriority: getCachedDisplayPriority(newState),
            hasIssues: computeHasIssues(newState),
          };
        }),
      setConflictCount: (conflictCount) =>
        set((state) => {
          const newState = { ...state, conflictCount };
          return {
            ...newState,
            displayPriority: getCachedDisplayPriority(newState),
            hasIssues: computeHasIssues(newState),
          };
        }),
      setNeedsCleanup: (needsCleanup) =>
        set((state) => {
          const newState = { ...state, needsCleanup };
          return {
            ...newState,
            displayPriority: getCachedDisplayPriority(newState),
            hasIssues: computeHasIssues(newState),
          };
        }),

      // Legacy computed selectors (for backward compatibility)
      getDisplayPriority: () => {
        const state = get();
        return getCachedDisplayPriority(state);
      },
    };
  })
);

// Optimized selectors for specific use cases - all stable references
export const useIsOnline = () => useOfflineStore((state) => state.isOnline);
export const useHasOfflineIssues = () => useOfflineStore((state) => state.hasIssues);
export const useOfflineDisplayPriority = () => useOfflineStore((state) => state.displayPriority);

// Event handlers (exported for testing)
export let handleOnline: () => void;
export let handleOffline: () => void;

// Cleanup function (for testing)
export const cleanupOfflineListeners = () => {
  if (typeof window !== "undefined" && handleOnline && handleOffline) {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }
};

// Initialize browser event listeners
if (typeof window !== "undefined") {
  const { setOnlineStatus } = useOfflineStore.getState();

  handleOnline = () => setOnlineStatus(true);
  handleOffline = () => setOnlineStatus(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
}
