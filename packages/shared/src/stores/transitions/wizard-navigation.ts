export type WizardNavigationEvent =
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "GO_TO"; step: number };

interface WizardStepRange {
  first: number;
  last: number;
}

export function transitionWizardStep(
  currentStep: number,
  event: WizardNavigationEvent,
  range: WizardStepRange
): number {
  const step = event.type === "GO_TO" ? event.step : currentStep + (event.type === "NEXT" ? 1 : -1);
  return Math.min(Math.max(step, range.first), range.last);
}
