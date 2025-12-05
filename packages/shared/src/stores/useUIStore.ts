import { create } from "zustand";

export type UIState = {
  // Global offline/queue indicators
  isOfflineBannerVisible: boolean;
  setOfflineBannerVisible: (visible: boolean) => void;

  // Work dashboard/modal controls
  isWorkDashboardOpen: boolean;
  openWorkDashboard: () => void;
  closeWorkDashboard: () => void;

  // Sidebar controls (admin)
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  isOfflineBannerVisible: false,
  setOfflineBannerVisible: (visible) => set({ isOfflineBannerVisible: visible }),

  isWorkDashboardOpen: false,
  openWorkDashboard: () => set({ isWorkDashboardOpen: true }),
  closeWorkDashboard: () => set({ isWorkDashboardOpen: false }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
