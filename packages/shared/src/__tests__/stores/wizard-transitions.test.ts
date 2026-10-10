import { selectAssessmentDirtyState } from "../../stores/transitions/create-assessment";
import {
  selectHypercertDirtyState,
  selectHypercertTimeframeOrder,
} from "../../stores/transitions/hypercert-wizard";
import { describe, expect, it } from "vitest";
import {
  transitionWizardStep,
  type WizardNavigationEvent,
} from "../../stores/transitions/wizard-navigation";
import { createEmptyAssessmentForm } from "../../stores/useCreateAssessmentStore";
import { Domain } from "../../types/domain";

const day = (month: number, date: number) => Date.UTC(2026, month - 1, date) / 1000;

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
    {
      name: "assessment with a chosen domain",
      currentStep: 0,
      form: { ...pristineAssessment, domain: Domain.AGRO },
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

  // A period is in order when it ends on or after the day it starts, or an end
  // is not set. The step shows its date-range error, and Next waits, from this.
  it.each([
    {
      name: "no dates yet",
      work: [0, 0],
      impact: [0, null],
      workInOrder: true,
      impactInOrder: true,
    },
    {
      name: "a period that ends the day it starts",
      work: [day(3, 25), day(3, 25)],
      impact: [day(3, 25), day(3, 25)],
      workInOrder: true,
      impactInOrder: true,
    },
    {
      name: "work that ends before it starts",
      work: [day(3, 26), day(3, 25)],
      impact: [0, null],
      workInOrder: false,
      impactInOrder: true,
    },
    {
      name: "impact left open after the work",
      work: [day(3, 1), day(8, 26)],
      impact: [day(9, 1), null],
      workInOrder: true,
      impactInOrder: true,
    },
    {
      name: "impact that ends before its own start",
      work: [day(3, 1), day(8, 26)],
      impact: [day(9, 1), day(8, 31)],
      workInOrder: true,
      impactInOrder: false,
    },
    {
      // With no start of its own the impact period starts with the work, as
      // its picker shows and the minted metadata writes.
      name: "impact with no start of its own that ends before the work starts",
      work: [day(8, 26), day(8, 26)],
      impact: [0, day(3, 1)],
      workInOrder: true,
      impactInOrder: false,
    },
  ])("reads $name", ({ work, impact, workInOrder, impactInOrder }) => {
    expect(
      selectHypercertTimeframeOrder({
        workTimeframeStart: work[0],
        workTimeframeEnd: work[1],
        impactTimeframeStart: impact[0] ?? 0,
        impactTimeframeEnd: impact[1],
      })
    ).toEqual({ workInOrder, impactInOrder });
  });
});
