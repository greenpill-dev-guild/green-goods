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

  // Garden filter sheet controls (client)
  isGardenFilterOpen: boolean;
  openGardenFilter: () => void;
  closeGardenFilter: () => void;

  // Endowment/treasury sheet controls (client)
  isEndowmentSheetOpen: boolean;
  openEndowmentSheet: () => void;
  closeEndowmentSheet: () => void;

  // Wallet sheet controls (client)
  isWalletSheetOpen: boolean;
  openWalletSheet: () => void;
  closeWalletSheet: () => void;

  // Commitments sheet controls (client)
  isCommitmentsSheetOpen: boolean;
  openCommitmentsSheet: () => void;
  closeCommitmentsSheet: () => void;

  /**
   * How many sheets and dialogs are open right now. Every sheet surface
   * registers itself while open (`useSheetPresence`), so chrome that must step
   * aside for any overlay, such as the PWA AppBar, reads one count instead of
   * a hand-maintained list of sheets (DL-015).
   */
  openSheetCount: number;
  /** Register an open sheet or dialog. Returns its release function; reference-counted. */
  registerOpenSheet: () => () => void;
  /** True while at least one sheet or dialog is registered as open. */
  isAnySheetOpen: () => boolean;

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

      isEndowmentSheetOpen: false,
      openEndowmentSheet: () => set({ isEndowmentSheetOpen: true }),
      closeEndowmentSheet: () => set({ isEndowmentSheetOpen: false }),

      isWalletSheetOpen: false,
      openWalletSheet: () => set({ isWalletSheetOpen: true }),
      closeWalletSheet: () => set({ isWalletSheetOpen: false }),

      isCommitmentsSheetOpen: false,
      openCommitmentsSheet: () => set({ isCommitmentsSheetOpen: true }),
      closeCommitmentsSheet: () => set({ isCommitmentsSheetOpen: false }),

      openSheetCount: 0,
      registerOpenSheet: () => {
        set((state) => ({ openSheetCount: state.openSheetCount + 1 }));
        let released = false;
        return () => {
          if (released) return;
          released = true;
          set((state) => ({ openSheetCount: Math.max(0, state.openSheetCount - 1) }));
        };
      },
      isAnySheetOpen: () => get().openSheetCount > 0,

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
