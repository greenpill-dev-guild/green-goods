import { create } from "zustand";

type UIState = {
  // Global offline/queue indicators
  isOfflineBannerVisible: boolean;
  setOfflineBannerVisible: (visible: boolean) => void;

  // Work dashboard/modal controls
  isWorkDashboardOpen: boolean;
  openWorkDashboard: () => void;
  closeWorkDashboard: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  isOfflineBannerVisible: false,
  setOfflineBannerVisible: (visible) => set({ isOfflineBannerVisible: visible }),

  isWorkDashboardOpen: false,
  openWorkDashboard: () => set({ isWorkDashboardOpen: true }),
  closeWorkDashboard: () => set({ isWorkDashboardOpen: false }),
}));
