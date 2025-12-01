import { create } from "zustand";
import { WorkTab } from "./workFlowTypes";

export type WorkDraftState = {
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  plantSelection: string[];
  plantCount?: number;
  images: File[];
};

export type WorkFlowState = WorkDraftState & {
  activeTab: WorkTab;
  submissionCompleted: boolean;
  /** Tracks object URLs created from images for proper cleanup */
  imageObjectUrls: string[];

  setActiveTab: (tab: WorkTab) => void;
  setSubmissionCompleted: (completed: boolean) => void;

  setGardenAddress: (id: string | null) => void;
  setActionUID: (uid: number | null) => void;
  setFeedback: (text: string) => void;
  setPlantSelection: (vals: string[]) => void;
  setPlantCount: (n?: number) => void;
  setImages: (files: File[]) => void;
  /** Register an object URL for cleanup on reset */
  registerImageUrl: (url: string) => void;
  /** Revoke a specific object URL and remove from tracking */
  revokeImageUrl: (url: string) => void;
  reset: () => void;
};

const initial: WorkDraftState = {
  gardenAddress: null,
  actionUID: null,
  feedback: "",
  plantSelection: [],
  plantCount: undefined,
  images: [],
};

export const useWorkFlowStore = create<WorkFlowState>((set, get) => ({
  ...initial,
  activeTab: WorkTab.Intro,
  submissionCompleted: false,
  imageObjectUrls: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSubmissionCompleted: (completed) => set({ submissionCompleted: completed }),
  setGardenAddress: (id) => set({ gardenAddress: id }),
  setActionUID: (uid) => set({ actionUID: uid }),
  setFeedback: (text) => set({ feedback: text }),
  setPlantSelection: (vals) => set({ plantSelection: vals }),
  setPlantCount: (n) => set({ plantCount: n }),
  setImages: (files) => set({ images: files }),

  registerImageUrl: (url) => {
    set((state) => ({
      imageObjectUrls: [...state.imageObjectUrls, url],
    }));
  },

  revokeImageUrl: (url) => {
    URL.revokeObjectURL(url);
    set((state) => ({
      imageObjectUrls: state.imageObjectUrls.filter((u) => u !== url),
    }));
  },

  reset: () => {
    // Revoke all tracked object URLs to prevent memory leaks
    const { imageObjectUrls } = get();
    imageObjectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    set({
      ...initial,
      activeTab: WorkTab.Intro,
      submissionCompleted: false,
      imageObjectUrls: [],
    });
  },
}));
