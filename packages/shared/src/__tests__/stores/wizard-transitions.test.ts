import { selectAssessmentDirtyState } from "../../stores/transitions/create-assessment";
import { selectHypercertDirtyState } from "../../stores/transitions/hypercert-wizard";
import { describe, expect, it } from "vitest";
import {
  transitionWizardStep,
  type WizardNavigationEvent,
} from "../../stores/transitions/wizard-navigation";
import { createEmptyAssessmentForm } from "../../stores/useCreateAssessmentStore";

describe("wizard navigation transitions", () => {
  it.each<{
    current: number;
    event: WizardNavigationEvent;
    expected: number;
    first: number;
    last: number;
    name: string;
  }>([
    { name: "hypercert next", current: 1, event: { type: "NEXT" }, first: 1, last: 4, expected: 2 },
    {
      name: "hypercert next clamp",
      current: 4,
      event: { type: "NEXT" },
      first: 1,
      last: 4,
      expected: 4,
    },
    {
      name: "hypercert previous clamp",
      current: 1,
      event: { type: "PREVIOUS" },
      first: 1,
      last: 4,
      expected: 1,
    },
    {
      name: "hypercert direct clamp",
      current: 2,
      event: { type: "GO_TO", step: 99 },
      first: 1,
      last: 4,
      expected: 4,
    },
    {
      name: "assessment next",
      current: 0,
      event: { type: "NEXT" },
      first: 0,
      last: 2,
      expected: 1,
    },
    {
      name: "assessment previous",
      current: 2,
      event: { type: "PREVIOUS" },
      first: 0,
      last: 2,
      expected: 1,
    },
    {
      name: "assessment direct clamp",
      current: 1,
      event: { type: "GO_TO", step: -1 },
      first: 0,
      last: 2,
      expected: 0,
    },
  ])("applies $name", ({ current, event, expected, first, last }) => {
    expect(transitionWizardStep(current, event, { first, last })).toBe(expected);
  });
});

describe("wizard dirty-state projections", () => {
  const pristineAssessment = createEmptyAssessmentForm();

  it.each([
    { name: "untouched assessment", currentStep: 0, form: pristineAssessment, expected: false },
    { name: "advanced assessment", currentStep: 1, form: pristineAssessment, expected: true },
    {
      name: "edited assessment",
      currentStep: 0,
      form: { ...pristineAssessment, title: "Watershed review" },
      expected: true,
    },
  ])("marks $name", ({ currentStep, form, expected }) => {
    const state = selectAssessmentDirtyState({
      currentStep,
      form,
      isSubmitting: false,
      isSuccess: false,
    });

    expect(state).toEqual({ isDirty: expected, isPristine: !expected });
  });

  it.each([
    {
      name: "untouched hypercert",
      currentStep: 1,
      ids: [],
      status: "idle" as const,
      expected: false,
    },
    {
      name: "selected hypercert",
      currentStep: 1,
      ids: ["attestation-1"],
      status: "idle" as const,
      expected: true,
    },
    {
      name: "advanced hypercert",
      currentStep: 2,
      ids: [],
      status: "idle" as const,
      expected: true,
    },
    {
      name: "pending hypercert",
      currentStep: 2,
      ids: ["attestation-1"],
      status: "pending" as const,
      expected: false,
    },
  ])("marks $name", ({ currentStep, ids, status, expected }) => {
    const state = selectHypercertDirtyState({
      currentStep,
      mintingStatus: status,
      selectedAttestationIds: ids,
    });

    expect(state).toEqual({ isDirty: expected, isPristine: !expected });
  });
});
