import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_GARDEN_FILTERS,
  type GardenFiltersState,
  parseGardenFilters,
} from "../hooks/garden/useFilteredGardens";
import type { TimeFilter } from "../utils/time";

// The storage key predates the garden filters: it held only the debug flag, and
// renaming it would drop that flag on every device.
const DEBUG_MODE_STORAGE_KEY = "green-goods:debug-mode";

/** Tabs of the client Work Dashboard modal — lets callers open it to a specific tab. */
export type WorkDashboardTab = "drafts" | "pending" | "completed";

/** Filters of the Work Dashboard's Pending tab — lets callers deep-link a preset. */
export type WorkDashboardPendingFilter = "all" | "needsReview" | "mySubmissions";

/** Filters of the Work Dashboard's Completed tab: everything, work you reviewed, or your own work. */
export type WorkDashboardCompletedFilter = "all" | "reviewedByYou" | "myWorkReviewed";

export interface WorkDashboardReturnState {
  tab: WorkDashboardTab;
  pendingFilter: WorkDashboardPendingFilter;
  completedFilter: WorkDashboardCompletedFilter;
  timeFilter: TimeFilter;
  scrollTop: number;
}

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
  workDashboardReturnState?: WorkDashboardReturnState;
  openWorkDashboard: (tab?: WorkDashboardTab, pendingFilter?: WorkDashboardPendingFilter) => void;
  rememberWorkDashboard: (state: WorkDashboardReturnState) => void;
  restoreWorkDashboard: () => void;
  closeWorkDashboard: () => void;

  // Garden filter sheet controls (client)
  isGardenFilterOpen: boolean;
  openGardenFilter: () => void;
  closeGardenFilter: () => void;

  /**
   * Home's garden filters (client). They live here, and persist, so they hold
   * when someone leaves Home or relaunches the app, until they reset them.
   */
  gardenFilters: GardenFiltersState;
  setGardenFilters: (update: (current: GardenFiltersState) => GardenFiltersState) => void;
  resetGardenFilters: () => void;

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
      workDashboardReturnState: undefined,
      // Both initial fields are overwritten on EVERY open (undefined when omitted) — that is
      // the staleness contract: a bare icon-open must not inherit the previous deep-link.
      openWorkDashboard: (tab, pendingFilter) =>
        set({
          isWorkDashboardOpen: true,
          workDashboardInitialTab: tab,
          workDashboardInitialPendingFilter: pendingFilter,
          workDashboardReturnState: undefined,
        }),
      rememberWorkDashboard: (state) => set({ workDashboardReturnState: state }),
      restoreWorkDashboard: () =>
        set((state) => ({
          isWorkDashboardOpen: true,
          workDashboardInitialTab: state.workDashboardReturnState?.tab ?? "pending",
          workDashboardInitialPendingFilter: state.workDashboardReturnState?.pendingFilter ?? "all",
        })),
      closeWorkDashboard: () => set({ isWorkDashboardOpen: false }),

      isGardenFilterOpen: false,
      openGardenFilter: () => set({ isGardenFilterOpen: true }),
      closeGardenFilter: () => set({ isGardenFilterOpen: false }),

      gardenFilters: DEFAULT_GARDEN_FILTERS,
      setGardenFilters: (update) =>
        set((state) => ({ gardenFilters: update(state.gardenFilters) })),
      resetGardenFilters: () => set({ gardenFilters: DEFAULT_GARDEN_FILTERS }),

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
      // Everything else is per-session UI state.
      partialize: (state) => ({ debugMode: state.debugMode, gardenFilters: state.gardenFilters }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { debugMode?: unknown; gardenFilters?: unknown };
        return {
          ...current,
          debugMode: typeof saved.debugMode === "boolean" ? saved.debugMode : current.debugMode,
          gardenFilters: parseGardenFilters(saved.gardenFilters),
        };
      },
    }
  )
);
