import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_GARDEN_FILTERS,
  type GardenFiltersState,
  parseGardenFilters,
} from "../modules/garden/filters";
import type { TimeFilter } from "../utils/time";

// The storage key predates the garden filters: it held only the debug flag, and
// renaming it would drop that flag on every device.
const DEBUG_MODE_STORAGE_KEY = "green-goods:debug-mode";

/** Tabs of the client Work Dashboard modal — lets callers open it to a specific tab (D3). */
export type WorkDashboardTab = "pending" | "completed";

/**
 * Filters of the Work Dashboard's Pending tab, one per state of its one list
 * (D17): what needs you, what waits to upload, what you're still editing, what
 * is being checked, and what waits for a review. Stewards also get the work
 * waiting for their decision. Lets callers deep-link a preset.
 */
export type WorkDashboardPendingFilter =
  | "all"
  | "needs"
  | "needsReview"
  | "upload"
  | "editing"
  | "checking"
  | "review";

/** Filters of the Work Dashboard's Completed tab: everything, work you reviewed, or your own work. */
export type WorkDashboardCompletedFilter = "all" | "reviewedByYou" | "myWorkReviewed";

export interface WorkDashboardReturnState {
  tab: WorkDashboardTab;
  pendingFilter: WorkDashboardPendingFilter;
  completedFilter: WorkDashboardCompletedFilter;
  timeFilter: TimeFilter;
  scrollTop: number;
}

export type CommitmentsDirectionFilter = "all" | "OFFER" | "REQUEST";
export interface CommitmentsDashboardReturnState {
  tab: "live" | "over-time" | "to-confirm";
  direction: CommitmentsDirectionFilter;
  /** The season or campaign the list was filtered to, as a decimal id. */
  cycleId?: string;
  scrollTop: number;
}

/** Where the Promises sheet opens: a tab, or the list filtered to one season or campaign. */
export interface CommitmentsSheetOpening {
  tab?: CommitmentsDashboardReturnState["tab"];
  /** A season's or campaign's id as a decimal string, as Home's Show Its Promises passes it. */
  cycleId?: string;
}

/** Home's sheet of the garden's open promises, as it opens: whole, or at one season or campaign. */
export interface TakePartSheetOpening {
  /** A season's or campaign's id as a decimal string, from its Show Its Promises; null for all. */
  cycleId: string | null;
}

export type DashboardSnapshot =
  | ({ kind: "work" } & WorkDashboardReturnState)
  | ({ kind: "commitments" } & CommitmentsDashboardReturnState);

/**
 * A garden section open as a `tall` sheet over Home (DL-128): the active garden's Work,
 * Insights or Gardeners, under the one shared sheet header. Home's About rows, Recent Activity's
 * See All and a steward's duty row open them; the Work sheet lists pending work first, as the
 * Work tab does.
 */
export type GardenSheet = "work" | "insights" | "gardeners";

export type UIState = {
  /** Invalidates history snapshots when the signed-in identity changes; never persisted. */
  dashboardNavigationId: string;
  commitmentsSheetReturnState?: CommitmentsDashboardReturnState;
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

  /**
   * A screen outside Home asked for Home's garden switcher (client), as the queue's failure
   * toast does for an upload waiting in another garden. Home opens it once it shows and clears
   * the request; nothing here switches the garden (PWA Home decision 6).
   */
  gardenSwitcherRequested: boolean;
  requestGardenSwitcher: () => void;
  clearGardenSwitcherRequest: () => void;

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

  /**
   * Forget what one account left when another signs in on this device: Home's
   * filters, every sheet flag, and the Work Dashboard's return point. Device
   * state (debug mode, the admin sidebar, the offline banner) stays.
   */
  resetForAccountChange: () => void;

  // Endowment/treasury sheet controls (client)
  isEndowmentSheetOpen: boolean;
  openEndowmentSheet: () => void;
  closeEndowmentSheet: () => void;

  // The garden section open as a sheet over Home (client); null while none is.
  gardenSheet: GardenSheet | null;
  /** Opens one section over Home, in place of any other that was open: the sheets never stack. */
  openGardenSheet: (sheet: GardenSheet) => void;
  closeGardenSheet: () => void;

  // Wallet sheet controls (client)
  isWalletSheetOpen: boolean;
  openWalletSheet: () => void;
  closeWalletSheet: () => void;

  // Commitments sheet controls (client)
  isCommitmentsSheetOpen: boolean;
  /** Where the sheet opens (consumed once on mount); undefined = the Live tab, unfiltered. */
  commitmentsSheetOpening?: CommitmentsSheetOpening;
  openCommitmentsSheet: (opening?: CommitmentsSheetOpening) => void;
  closeCommitmentsSheet: () => void;

  /**
   * The garden's open promises as a sheet over Home (client): every promise Take Part could list,
   * not the reader's own, which the Promises sheet keeps. Null while it is closed.
   */
  takePartSheet: TakePartSheetOpening | null;
  /** Opens it whole, or at one season or campaign (`cycleId` as a decimal string). */
  openTakePartSheet: (opening?: { cycleId?: string }) => void;
  closeTakePartSheet: () => void;

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
      dashboardNavigationId: crypto.randomUUID(),
      commitmentsSheetReturnState: undefined,
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

      gardenSwitcherRequested: false,
      requestGardenSwitcher: () => set({ gardenSwitcherRequested: true }),
      clearGardenSwitcherRequest: () => set({ gardenSwitcherRequested: false }),

      isGardenFilterOpen: false,
      openGardenFilter: () => set({ isGardenFilterOpen: true }),
      closeGardenFilter: () => set({ isGardenFilterOpen: false }),

      gardenFilters: DEFAULT_GARDEN_FILTERS,
      setGardenFilters: (update) =>
        set((state) => ({ gardenFilters: update(state.gardenFilters) })),
      resetGardenFilters: () => set({ gardenFilters: DEFAULT_GARDEN_FILTERS }),
      resetForAccountChange: () =>
        set({
          dashboardNavigationId: crypto.randomUUID(),
          commitmentsSheetReturnState: undefined,
          gardenFilters: DEFAULT_GARDEN_FILTERS,
          gardenSwitcherRequested: false,
          isGardenFilterOpen: false,
          isEndowmentSheetOpen: false,
          gardenSheet: null,
          isWalletSheetOpen: false,
          isCommitmentsSheetOpen: false,
          commitmentsSheetOpening: undefined,
          takePartSheet: null,
          isWorkDashboardOpen: false,
          workDashboardInitialTab: undefined,
          workDashboardInitialPendingFilter: undefined,
          workDashboardReturnState: undefined,
        }),

      isEndowmentSheetOpen: false,
      openEndowmentSheet: () => set({ isEndowmentSheetOpen: true }),
      closeEndowmentSheet: () => set({ isEndowmentSheetOpen: false }),

      gardenSheet: null,
      openGardenSheet: (sheet) => set({ gardenSheet: sheet }),
      closeGardenSheet: () => set({ gardenSheet: null }),

      isWalletSheetOpen: false,
      openWalletSheet: () => set({ isWalletSheetOpen: true }),
      closeWalletSheet: () => set({ isWalletSheetOpen: false }),

      isCommitmentsSheetOpen: false,
      // Overwritten on every open, as the work dashboard's presets are: a bare
      // open never inherits the previous one's tab or season. Home hands this
      // straight to a button, so only the two presets are read from what arrives.
      openCommitmentsSheet: (opening) =>
        set({
          isCommitmentsSheetOpen: true,
          commitmentsSheetOpening: opening && { tab: opening.tab, cycleId: opening.cycleId },
          commitmentsSheetReturnState: undefined,
        }),
      closeCommitmentsSheet: () => set({ isCommitmentsSheetOpen: false }),

      takePartSheet: null,
      // Only a string cycle id is read: Home may hand this straight to a button.
      openTakePartSheet: (opening) =>
        set({
          takePartSheet: {
            cycleId: typeof opening?.cycleId === "string" ? opening.cycleId : null,
          },
        }),
      closeTakePartSheet: () => set({ takePartSheet: null }),

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
