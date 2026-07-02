import { create } from "zustand";
import { persist } from "zustand/middleware";

// Storage key for debug mode persistence
const DEBUG_MODE_STORAGE_KEY = "green-goods:debug-mode";

/** Tabs of the client Work Dashboard modal — lets callers open it to a specific tab. */
export type WorkDashboardTab = "drafts" | "pending" | "completed";

/** Filters of the Work Dashboard's Pending tab — lets callers deep-link a preset. */
export type WorkDashboardPendingFilter = "all" | "needsReview" | "mySubmissions";

export type UIState = {
  // Global offline/queue indicators
  isOfflineBannerVisible: boolean;
  setOfflineBannerVisible: (visible: boolean) => void;

  // Work dashboard/modal controls
  isWorkDashboardOpen: boolean;
  /** Tab the dashboard should open to (consumed once on mount); undefined = default tab. */
  workDashboardInitialTab?: WorkDashboardTab;
  /** Pending-tab filter to preset (consumed once on mount); undefined = default ("all"). */
  workDashboardInitialPendingFilter?: WorkDashboardPendingFilter;
  openWorkDashboard: (tab?: WorkDashboardTab, pendingFilter?: WorkDashboardPendingFilter) => void;
  closeWorkDashboard: () => void;

  // Garden filter drawer controls (client)
  isGardenFilterOpen: boolean;
  openGardenFilter: () => void;
  closeGardenFilter: () => void;

  // Endowment/treasury drawer controls (client)
  isEndowmentDrawerOpen: boolean;
  openEndowmentDrawer: () => void;
  closeEndowmentDrawer: () => void;

  // Computed helper to check if any drawer is open (for AppBar hiding)
  isAnyDrawerOpen: () => boolean;

  // Sidebar controls (admin)
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Debug mode - shows verbose error info in toasts
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isOfflineBannerVisible: false,
      setOfflineBannerVisible: (visible) => set({ isOfflineBannerVisible: visible }),

      isWorkDashboardOpen: false,
      workDashboardInitialTab: undefined,
      workDashboardInitialPendingFilter: undefined,
      // Both initial fields are overwritten on EVERY open (undefined when omitted) — that is
      // the staleness contract: a bare icon-open must not inherit the previous deep-link.
      openWorkDashboard: (tab, pendingFilter) =>
        set({
          isWorkDashboardOpen: true,
          workDashboardInitialTab: tab,
          workDashboardInitialPendingFilter: pendingFilter,
        }),
      closeWorkDashboard: () => set({ isWorkDashboardOpen: false }),

      isGardenFilterOpen: false,
      openGardenFilter: () => set({ isGardenFilterOpen: true }),
      closeGardenFilter: () => set({ isGardenFilterOpen: false }),

      isEndowmentDrawerOpen: false,
      openEndowmentDrawer: () => set({ isEndowmentDrawerOpen: true }),
      closeEndowmentDrawer: () => set({ isEndowmentDrawerOpen: false }),

      isAnyDrawerOpen: () =>
        get().isWorkDashboardOpen || get().isGardenFilterOpen || get().isEndowmentDrawerOpen,

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      debugMode: false,
      setDebugMode: (enabled) => set({ debugMode: enabled }),
      toggleDebugMode: () => set((state) => ({ debugMode: !state.debugMode })),
    }),
    {
      name: DEBUG_MODE_STORAGE_KEY,
      // Only persist debugMode to localStorage
      partialize: (state) => ({ debugMode: state.debugMode }),
    }
  )
);
