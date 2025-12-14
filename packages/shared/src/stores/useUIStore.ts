import { create } from "zustand";

export type UIState = {
  // Global offline/queue indicators
  isOfflineBannerVisible: boolean;
  setOfflineBannerVisible: (visible: boolean) => void;

  // Work dashboard/modal controls
  isWorkDashboardOpen: boolean;
  openWorkDashboard: () => void;
  closeWorkDashboard: () => void;

  // Garden filter drawer controls (client)
  isGardenFilterOpen: boolean;
  openGardenFilter: () => void;
  closeGardenFilter: () => void;

  // Computed helper to check if any drawer is open (for AppBar hiding)
  isAnyDrawerOpen: () => boolean;

  // Sidebar controls (admin)
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  isOfflineBannerVisible: false,
  setOfflineBannerVisible: (visible) => set({ isOfflineBannerVisible: visible }),

  isWorkDashboardOpen: false,
  openWorkDashboard: () => set({ isWorkDashboardOpen: true }),
  closeWorkDashboard: () => set({ isWorkDashboardOpen: false }),

  isGardenFilterOpen: false,
  openGardenFilter: () => set({ isGardenFilterOpen: true }),
  closeGardenFilter: () => set({ isGardenFilterOpen: false }),

  isAnyDrawerOpen: () => get().isWorkDashboardOpen || get().isGardenFilterOpen,

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
