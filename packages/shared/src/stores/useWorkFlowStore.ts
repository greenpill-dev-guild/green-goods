import { create } from "zustand";
import type { Domain } from "../types/domain";
import { WorkTab } from "./workFlowTypes";

export type WorkDraftState = {
  gardenAddress: string | null;
  actionUID: number | null;
  feedback: string;
  /** Generic domain-specific details (replaces plantSelection/plantCount) */
  details: Record<string, unknown>;
  /** Optional standardized tags */
  tags: string[];
  timeSpentMinutes?: number;
  images: File[];
  /** Optional audio recordings */
  audioNotes: File[];
};

export type WorkFlowState = WorkDraftState & {
  activeTab: WorkTab;
  submissionCompleted: boolean;
  /** Selected domain for domain-centric action filtering */
  selectedDomain: Domain | null;
  /** Tracks object URLs created from images for proper cleanup */
  imageObjectUrls: string[];

  setActiveTab: (tab: WorkTab) => void;
  setSubmissionCompleted: (completed: boolean) => void;

  setGardenAddress: (id: string | null) => void;
  setActionUID: (uid: number | null) => void;
  setFeedback: (text: string) => void;
  setDetails: (details: Record<string, unknown>) => void;
  setTags: (tags: string[]) => void;
  setTimeSpentMinutes: (n?: number) => void;
  setImages: (files: File[]) => void;
  setAudioNotes: (files: File[]) => void;
  setSelectedDomain: (domain: Domain | null) => void;
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
  details: {},
  tags: [],
  timeSpentMinutes: undefined,
  images: [],
  audioNotes: [],
};

export const useWorkFlowStore = create<WorkFlowState>((set, get) => ({
  ...initial,
  activeTab: WorkTab.Intro,
  submissionCompleted: false,
  selectedDomain: null,
  imageObjectUrls: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSubmissionCompleted: (completed) => set({ submissionCompleted: completed }),
  setGardenAddress: (id) => set({ gardenAddress: id }),
  setActionUID: (uid) => set({ actionUID: uid }),
  setFeedback: (text) => set({ feedback: text }),
  setDetails: (details) => set({ details }),
  setTags: (tags) => set({ tags }),
  setTimeSpentMinutes: (n) => set({ timeSpentMinutes: n }),
  setImages: (files) => set({ images: files }),
  setAudioNotes: (files) => set({ audioNotes: files }),
  setSelectedDomain: (domain) => set({ selectedDomain: domain }),

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
      selectedDomain: null,
      imageObjectUrls: [],
    });
  },
}));
