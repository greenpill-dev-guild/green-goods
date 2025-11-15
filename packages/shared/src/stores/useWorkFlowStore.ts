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
  setActiveTab: (tab: WorkTab) => void;
  setSubmissionCompleted: (completed: boolean) => void;

  setGardenAddress: (id: string | null) => void;
  setActionUID: (uid: number | null) => void;
  setFeedback: (text: string) => void;
  setPlantSelection: (vals: string[]) => void;
  setPlantCount: (n?: number) => void;
  setImages: (files: File[]) => void;
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
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSubmissionCompleted: (completed) => set({ submissionCompleted: completed }),
  setGardenAddress: (id) => {
    const currentState = get();
    console.log("[useWorkFlowStore] setGardenAddress called:", {
      oldValue: currentState.gardenAddress,
      newValue: id,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n'), // Show caller
    });
    set({ gardenAddress: id });
  },
  setActionUID: (uid) => set({ actionUID: uid }),
  setFeedback: (text) => set({ feedback: text }),
  setPlantSelection: (vals) => set({ plantSelection: vals }),
  setPlantCount: (n) => set({ plantCount: n }),
  setImages: (files) => set({ images: files }),
  reset: () => {
    console.log("[useWorkFlowStore] reset() called - clearing all state including gardenAddress", {
      currentGardenAddress: get().gardenAddress,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n'),
    });
    set({ ...initial, activeTab: WorkTab.Intro, submissionCompleted: false });
  },
}));
