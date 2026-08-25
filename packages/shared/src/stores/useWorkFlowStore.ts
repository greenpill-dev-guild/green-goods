import { create } from "zustand";
import type { Address, Domain } from "../types/domain";
import {
  registerWorkImageUrlTransition,
  resetWorkFlowTransition,
  revokeWorkImageUrlTransition,
  setWorkFlowFieldTransition,
} from "./transitions/work-flow";
import { WorkTab } from "./workFlowTypes";

export type WorkDraftState = {
  gardenAddress: Address | null;
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
  workSubmissionJourneyId: string | null;
  /** Selected domain for domain-centric action filtering */
  selectedDomain: Domain | null;
  /** Tracks object URLs created from images for proper cleanup */
  imageObjectUrls: string[];

  setActiveTab: (tab: WorkTab) => void;
  setSubmissionCompleted: (completed: boolean) => void;
  ensureWorkSubmissionJourneyId: () => string;
  clearWorkSubmissionJourneyId: () => void;

  setGardenAddress: (id: Address | null) => void;
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

function createWorkSubmissionJourneyId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `work_journey_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export const useWorkFlowStore = create<WorkFlowState>((set, get) => ({
  ...initial,
  activeTab: WorkTab.Intro,
  submissionCompleted: false,
  workSubmissionJourneyId: null,
  selectedDomain: null,
  imageObjectUrls: [],

  setActiveTab: (tab) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "activeTab", value: tab })),
  setSubmissionCompleted: (completed) =>
    set((state) =>
      setWorkFlowFieldTransition(state, { field: "submissionCompleted", value: completed })
    ),
  ensureWorkSubmissionJourneyId: () => {
    const existing = get().workSubmissionJourneyId;
    if (existing) return existing;

    const workSubmissionJourneyId = createWorkSubmissionJourneyId();
    set((state) =>
      setWorkFlowFieldTransition(state, {
        field: "workSubmissionJourneyId",
        value: workSubmissionJourneyId,
      })
    );
    return workSubmissionJourneyId;
  },
  clearWorkSubmissionJourneyId: () =>
    set((state) =>
      setWorkFlowFieldTransition(state, { field: "workSubmissionJourneyId", value: null })
    ),
  setGardenAddress: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "gardenAddress", value })),
  setActionUID: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "actionUID", value })),
  setFeedback: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "feedback", value })),
  setDetails: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "details", value })),
  setTags: (value) => set((state) => setWorkFlowFieldTransition(state, { field: "tags", value })),
  setTimeSpentMinutes: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "timeSpentMinutes", value })),
  setImages: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "images", value })),
  setAudioNotes: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "audioNotes", value })),
  setSelectedDomain: (value) =>
    set((state) => setWorkFlowFieldTransition(state, { field: "selectedDomain", value })),

  registerImageUrl: (url) => {
    set((state) => registerWorkImageUrlTransition(state, url));
  },

  revokeImageUrl: (url) => {
    URL.revokeObjectURL(url);
    set((state) => revokeWorkImageUrlTransition(state, url));
  },

  reset: () => {
    // Revoke all tracked object URLs to prevent memory leaks
    const { imageObjectUrls } = get();
    imageObjectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    set((state) => resetWorkFlowTransition(state, initial));
  },
}));
