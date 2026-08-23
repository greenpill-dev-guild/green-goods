import { type NormalizeWorkMediaOptions, normalizeWorkMediaFiles } from "./media-processing";
import { WorkTab } from "../../stores/workFlowTypes";

export const WORK_SUBMISSION_TAB_ORDER = [
  WorkTab.Intro,
  WorkTab.Media,
  WorkTab.Details,
  WorkTab.Review,
] as const;

export interface WorkSubmissionProgress {
  tab: WorkTab;
  gardenAddress: string | null;
  actionUID: number | null;
  imageCount: number;
  minRequired: number;
  isValid: boolean;
  isSubmitting: boolean;
  isMutationPending: boolean;
  bypassMediaRequirement?: boolean;
}

export function canProceedWithWorkSubmission(progress: WorkSubmissionProgress): boolean {
  switch (progress.tab) {
    case WorkTab.Intro:
      return Boolean(progress.gardenAddress && typeof progress.actionUID === "number");
    case WorkTab.Media:
      return Boolean(
        progress.bypassMediaRequirement || progress.imageCount >= progress.minRequired
      );
    case WorkTab.Details:
      return progress.isValid;
    case WorkTab.Review:
      return progress.isValid && !progress.isSubmitting && !progress.isMutationPending;
  }
}

export function adjacentWorkSubmissionTab(tab: WorkTab, direction: "next" | "previous") {
  const index = WORK_SUBMISSION_TAB_ORDER.indexOf(tab);
  const nextIndex = direction === "next" ? index + 1 : index - 1;
  return WORK_SUBMISSION_TAB_ORDER[nextIndex] ?? tab;
}

export async function prepareWorkSubmission(files: File[], options?: NormalizeWorkMediaOptions) {
  return normalizeWorkMediaFiles(files, options);
}
