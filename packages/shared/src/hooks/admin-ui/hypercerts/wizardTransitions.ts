export type WizardNavigationEvent =
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "GO_TO"; step: number };

interface WizardStepRange {
  first: number;
  last: number;
}

type WizardTransition = (
  currentStep: number,
  event: WizardNavigationEvent,
  range: WizardStepRange
) => number;

function clampStep(step: number, range: WizardStepRange): number {
  return Math.min(Math.max(step, range.first), range.last);
}

export const WIZARD_NAVIGATION_TRANSITIONS = {
  NEXT: ((currentStep, _event, range) => clampStep(currentStep + 1, range)) as WizardTransition,
  PREVIOUS: ((currentStep, _event, range) => clampStep(currentStep - 1, range)) as WizardTransition,
  GO_TO: ((currentStep, event, range) =>
    clampStep(event.type === "GO_TO" ? event.step : currentStep, range)) as WizardTransition,
} satisfies Record<WizardNavigationEvent["type"], WizardTransition>;

export function transitionWizardStep(
  currentStep: number,
  event: WizardNavigationEvent,
  range: WizardStepRange
): number {
  return WIZARD_NAVIGATION_TRANSITIONS[event.type](currentStep, event, range);
}

interface DirtyState {
  isDirty: boolean;
  isPristine: boolean;
}

interface AssessmentDirtyStateInput {
  currentStep: number;
  form: {
    attachments: unknown[];
    description: string;
    diagnosis: string;
    location: string;
    reportingPeriodEnd: string;
    reportingPeriodStart: string;
    sdgTargets: unknown[];
    selectedActionUIDs: unknown[];
    smartOutcomes: Array<{ description: string; metric: string; target: number }>;
    title: string;
  };
  isSubmitting: boolean;
  isSuccess: boolean;
}

export function selectAssessmentDirtyState({
  currentStep,
  form,
  isSubmitting,
  isSuccess,
}: AssessmentDirtyStateInput): DirtyState {
  const hasMeaningfulSmartOutcome =
    form.smartOutcomes.length > 1 ||
    form.smartOutcomes.some(
      (outcome) =>
        outcome.description.trim().length > 0 ||
        outcome.metric.trim().length > 0 ||
        outcome.target !== 0
    );
  const isDirty =
    !isSubmitting &&
    !isSuccess &&
    (currentStep > 0 ||
      form.title.trim().length > 0 ||
      form.description.trim().length > 0 ||
      form.location.trim().length > 0 ||
      form.diagnosis.trim().length > 0 ||
      hasMeaningfulSmartOutcome ||
      form.selectedActionUIDs.length > 0 ||
      form.sdgTargets.length > 0 ||
      form.reportingPeriodStart.length > 0 ||
      form.reportingPeriodEnd.length > 0 ||
      form.attachments.length > 0);

  return { isDirty, isPristine: !isDirty };
}

interface HypercertDirtyStateInput {
  currentStep: number;
  mintingStatus: string;
  selectedAttestationIds: string[];
}

export function selectHypercertDirtyState({
  currentStep,
  mintingStatus,
  selectedAttestationIds,
}: HypercertDirtyStateInput): DirtyState {
  const isDirty =
    !["pending", "confirmed"].includes(mintingStatus) &&
    (selectedAttestationIds.length > 0 || currentStep > 1);
  return { isDirty, isPristine: !isDirty };
}
