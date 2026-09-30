import { WorkTab } from "../workFlowTypes";
import type { WorkDraftState, WorkFlowState } from "../useWorkFlowStore";

type WritableWorkField =
  | "activeTab"
  | "submissionCompleted"
  | "workSubmissionJourneyId"
  | "gardenAddress"
  | "actionUID"
  | "feedback"
  | "details"
  | "tags"
  | "timeSpentMinutes"
  | "images"
  | "audioNotes"
  | "selectedDomain";

export function setWorkFlowFieldTransition<K extends WritableWorkField>(
  _state: WorkFlowState,
  input: { field: K; value: WorkFlowState[K] }
): Partial<WorkFlowState> {
  return { [input.field]: input.value } as Pick<WorkFlowState, K>;
}

export function registerWorkImageUrlTransition(
  state: WorkFlowState,
  url: string
): Partial<WorkFlowState> {
  return { imageObjectUrls: [...state.imageObjectUrls, url] };
}

export function revokeWorkImageUrlTransition(
  state: WorkFlowState,
  url: string
): Partial<WorkFlowState> {
  return { imageObjectUrls: state.imageObjectUrls.filter((item) => item !== url) };
}

export function resetWorkFlowTransition(
  _state: WorkFlowState,
  initial: WorkDraftState
): Partial<WorkFlowState> {
  return {
    ...initial,
    activeDraftId: null,
    draftMissingAttachments: [],
    draftEpoch: _state.draftEpoch + 1,
    draftDeleting: false,
    draftSaveState: "idle",
    draftError: null,
    location: undefined,
    activeTab: WorkTab.Intro,
    submissionCompleted: false,
    workSubmissionJourneyId: null,
    selectedDomain: null,
    imageObjectUrls: [],
  };
}
