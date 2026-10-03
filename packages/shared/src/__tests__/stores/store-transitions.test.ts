import { describe, expect, it } from "vitest";
import {
  addSmartOutcomeTransition,
  moveAssessmentStepTransition,
  setAssessmentFieldTransition,
  updateSmartOutcomeTransition,
} from "../../stores/transitions/create-assessment";
import {
  addGardenMemberTransition,
  moveGardenStepTransition,
  setGardenFieldTransition,
} from "../../stores/transitions/create-garden";
import {
  loadHypercertDraftTransition,
  nextHypercertStepTransition,
  setHypercertStepTransition,
  toggleAttestationTransition,
  updateHypercertMetadataTransition,
} from "../../stores/transitions/hypercert-wizard";
import {
  registerWorkImageUrlTransition,
  resetWorkFlowTransition,
  revokeWorkImageUrlTransition,
} from "../../stores/transitions/work-flow";
import {
  type CreateAssessmentStore,
  createEmptyAssessmentForm,
} from "../../stores/useCreateAssessmentStore";
import { createEmptyGardenForm, type CreateGardenStore } from "../../stores/useCreateGardenStore";
import type { HypercertWizardStore } from "../../stores/useHypercertWizardStore";
import type { HypercertDraft } from "../../types/hypercerts";
import type { WorkDraftState, WorkFlowState } from "../../stores/useWorkFlowStore";
import { WorkTab } from "../../stores/workFlowTypes";
import { Domain } from "../../types/domain";

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

  // Each end of a hypercert's periods is a calendar day, kept as UTC midnight: a
  // picked day is stored that way, an assessment prefills it that way, and the
  // minted metadata names its UTC day. "Use suggested dates" hands over the
  // moments the work was created and approved, so an end picked on the start's
  // own day used to count as earlier than the start.
  it("keeps each end of a hypercert's periods as the UTC midnight of its day", () => {
    const state = {} as HypercertWizardStore;
    const created = Date.UTC(2026, 2, 25, 22, 15, 8) / 1000;
    const approved = Date.UTC(2026, 7, 26, 9, 37, 49) / 1000;
    const march25 = Date.UTC(2026, 2, 25) / 1000;
    const august26 = Date.UTC(2026, 7, 26) / 1000;

    expect(
      updateHypercertMetadataTransition(state, {
        title: "Left as written",
        workTimeframeStart: created,
        workTimeframeEnd: approved,
        impactTimeframeStart: created,
        impactTimeframeEnd: approved,
      })
    ).toEqual({
      title: "Left as written",
      workTimeframeStart: march25,
      workTimeframeEnd: august26,
      impactTimeframeStart: march25,
      impactTimeframeEnd: august26,
    });
    // An impact period can stay open, and a cleared end stays cleared.
    expect(
      updateHypercertMetadataTransition(state, { workTimeframeEnd: 0, impactTimeframeEnd: null })
    ).toEqual({ workTimeframeEnd: 0, impactTimeframeEnd: null });
    // An assessment's end is a uint256, so a prefill can be no day a calendar
    // holds. That end is not set: its field shows empty and Next waits for one.
    expect(
      updateHypercertMetadataTransition(state, {
        workTimeframeEnd: 1.158e77,
        impactTimeframeEnd: Number.NaN,
      })
    ).toEqual({ workTimeframeEnd: 0, impactTimeframeEnd: 0 });
    // A draft saved before this rule can hold the moments themselves.
    expect(
      loadHypercertDraftTransition(state, {
        workTimeframeStart: created,
        workTimeframeEnd: approved,
        impactTimeframeStart: created,
        impactTimeframeEnd: null,
      } as HypercertDraft)
    ).toMatchObject({
      workTimeframeStart: march25,
      workTimeframeEnd: august26,
      impactTimeframeStart: march25,
      impactTimeframeEnd: null,
    });
  });

  // Next has not always waited on the order, so a saved draft can sit past the
  // metadata step with a time frame that runs backwards. Restoring it would
  // put the steward one press from Mint without ever showing the error.
  it.each([
    {
      name: "a work time frame that runs backwards",
      draft: { stepNumber: 4, workTimeframeStart: 26, workTimeframeEnd: 25 },
      opensOn: 2,
    },
    {
      name: "an impact time frame that ends before the work starts",
      draft: {
        stepNumber: 3,
        workTimeframeStart: 26,
        workTimeframeEnd: 26,
        impactTimeframeEnd: 25,
      },
      opensOn: 2,
    },
    {
      name: "time frames in order",
      draft: {
        stepNumber: 4,
        workTimeframeStart: 25,
        workTimeframeEnd: 26,
        impactTimeframeEnd: 27,
      },
      opensOn: 4,
    },
    {
      // Saved as moments, 22:15 on the 25th is later than the 25th's midnight.
      name: "an end on the start's own day, saved as moments",
      draft: { stepNumber: 4, workTimeframeStart: 25 + 22.25 / 24, workTimeframeEnd: 25 },
      opensOn: 4,
    },
    {
      name: "a backwards time frame on a draft that had not left step 1",
      draft: { stepNumber: 1, workTimeframeStart: 26, workTimeframeEnd: 25 },
      opensOn: 1,
    },
  ])("reopens a saved hypercert draft with $name on step $opensOn", ({ draft, opensOn }) => {
    // Days of March 2026, so each row reads as its dates.
    const march = (day: number | undefined) =>
      day === undefined ? 0 : Math.round(Date.UTC(2026, 2, 1) / 1000 + (day - 1) * 86_400);

    const restored = loadHypercertDraftTransition(
      {} as HypercertWizardStore,
      {
        stepNumber: draft.stepNumber,
        workTimeframeStart: march(draft.workTimeframeStart),
        workTimeframeEnd: march(draft.workTimeframeEnd),
        impactTimeframeStart: 0,
        impactTimeframeEnd:
          draft.impactTimeframeEnd === undefined ? null : march(draft.impactTimeframeEnd),
      } as HypercertDraft
    );

    expect(restored.currentStep).toBe(opensOn);
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

  it("drops the old domain's actions and metrics when the domain changes", () => {
    const state = {
      form: {
        ...createEmptyAssessmentForm(),
        domain: Domain.AGRO,
        selectedActionUIDs: ["action-1"],
        smartOutcomes: [{ description: "Canopy cover", metric: "trees", target: 40 }],
      },
      currentStep: 0,
    } as CreateAssessmentStore;
    const choose = (domain: Domain | null) =>
      setAssessmentFieldTransition(state, { field: "domain", value: domain }).form;

    // The steward's own words stay; picks from the old domain's lists go.
    expect(choose(Domain.SOLAR)).toMatchObject({
      domain: Domain.SOLAR,
      selectedActionUIDs: [],
      smartOutcomes: [{ description: "Canopy cover", metric: "", target: 40 }],
    });
    expect(choose(null)?.selectedActionUIDs).toEqual([]);
    expect(choose(Domain.AGRO)).toEqual(state.form);
  });

  it("owns work-flow URL and reset patches without browser side effects", () => {
    const state = { imageObjectUrls: ["blob:one"], draftEpoch: 2 } as WorkFlowState;
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
      activeDraftId: null,
      draftMissingAttachments: [],
      draftEpoch: 3,
      draftDeleting: false,
      draftSaveState: "idle",
      draftError: null,
      draftLinkCleared: false,
      location: undefined,
      activeTab: WorkTab.Intro,
      submissionCompleted: false,
      workSubmissionJourneyId: null,
      selectedDomain: null,
      imageObjectUrls: [],
    });
    expect(state.imageObjectUrls).toEqual(["blob:one"]);
  });
});
