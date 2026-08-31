import { describe, expect, it } from "vitest";
import {
  addSmartOutcomeTransition,
  moveAssessmentStepTransition,
  updateSmartOutcomeTransition,
} from "../../stores/transitions/create-assessment";
import {
  addGardenMemberTransition,
  moveGardenStepTransition,
  setGardenFieldTransition,
} from "../../stores/transitions/create-garden";
import {
  nextHypercertStepTransition,
  setHypercertStepTransition,
  toggleAttestationTransition,
} from "../../stores/transitions/hypercert-wizard";
import {
  registerWorkImageUrlTransition,
  resetWorkFlowTransition,
  revokeWorkImageUrlTransition,
} from "../../stores/transitions/work-flow";
import type { CreateAssessmentStore } from "../../stores/useCreateAssessmentStore";
import { createEmptyGardenForm, type CreateGardenStore } from "../../stores/useCreateGardenStore";
import type { HypercertWizardStore } from "../../stores/useHypercertWizardStore";
import type { WorkDraftState, WorkFlowState } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";

describe("store domain transitions", () => {
  it("clamps hypercert steps and toggles attestations without mutating state", () => {
    const state = {
      currentStep: 4,
      selectedAttestationIds: ["attestation-1"],
    } as HypercertWizardStore;

    expect(nextHypercertStepTransition(state)).toEqual({ currentStep: 4 });
    expect(setHypercertStepTransition(state, -2)).toEqual({ currentStep: 1 });
    expect(toggleAttestationTransition(state, "attestation-2")).toEqual({
      selectedAttestationIds: ["attestation-1", "attestation-2"],
    });
    expect(state.selectedAttestationIds).toEqual(["attestation-1"]);
  });

  it("updates garden fields, membership, and bounded steps as pure patches", () => {
    const state = {
      form: createEmptyGardenForm(),
      currentStep: 0,
      steps: [{ id: "details" }, { id: "team" }, { id: "review" }],
    } as CreateGardenStore;
    const address = "0x1111111111111111111111111111111111111111";

    expect(setGardenFieldTransition(state, { field: "name", value: "My Garden" })).toEqual({
      form: { ...state.form, name: "My Garden" },
    });
    expect(addGardenMemberTransition(state, { role: "gardeners", address })).toEqual({
      form: { ...state.form, gardeners: [address] },
    });
    expect(moveGardenStepTransition(state, { index: 99 })).toEqual({ currentStep: 2 });
  });

  it("updates assessment outcomes and bounds navigation", () => {
    const state = {
      form: { smartOutcomes: [{ description: "Before", metric: "items", target: 1 }] },
      currentStep: 1,
    } as CreateAssessmentStore;

    expect(updateSmartOutcomeTransition(state, { index: 0, field: "target", value: 3 })).toEqual({
      form: { smartOutcomes: [{ description: "Before", metric: "items", target: 3 }] },
    });
    expect(addSmartOutcomeTransition(state).form?.smartOutcomes).toHaveLength(2);
    expect(moveAssessmentStepTransition(state, { direction: 1, totalSteps: 2 })).toEqual({
      currentStep: 1,
    });
  });

  it("owns work-flow URL and reset patches without browser side effects", () => {
    const state = { imageObjectUrls: ["blob:one"] } as WorkFlowState;
    const initial: WorkDraftState = {
      gardenAddress: null,
      actionUID: null,
      feedback: "",
      details: {},
      tags: [],
      images: [],
      audioNotes: [],
    };

    expect(registerWorkImageUrlTransition(state, "blob:two")).toEqual({
      imageObjectUrls: ["blob:one", "blob:two"],
    });
    expect(revokeWorkImageUrlTransition(state, "blob:one")).toEqual({ imageObjectUrls: [] });
    expect(resetWorkFlowTransition(state, initial)).toEqual({
      ...initial,
      activeTab: WorkTab.Intro,
      submissionCompleted: false,
      workSubmissionJourneyId: null,
      selectedDomain: null,
      imageObjectUrls: [],
    });
    expect(state.imageObjectUrls).toEqual(["blob:one"]);
  });
});
