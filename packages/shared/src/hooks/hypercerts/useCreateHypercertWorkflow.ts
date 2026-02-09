import { useCallback, useMemo } from "react";

import { validateAllowlist } from "../../lib/hypercerts";
import { useHypercertWizardStore } from "../../stores/useHypercertWizardStore";

export interface UseCreateHypercertWorkflowResult {
  currentStep: number;
  nextStep: () => void;
  previousStep: () => void;
  setStep: (step: number) => void;
  canProceed: (step?: number) => boolean;
  reset: () => void;
}

export function useCreateHypercertWorkflow(): UseCreateHypercertWorkflowResult {
  const currentStep = useHypercertWizardStore((state) => state.currentStep);
  const nextStep = useHypercertWizardStore((state) => state.nextStep);
  const previousStep = useHypercertWizardStore((state) => state.previousStep);
  const setStep = useHypercertWizardStore((state) => state.setStep);
  const reset = useHypercertWizardStore((state) => state.reset);

  // Subscribe to fields needed for validation so canProceed updates reactively
  const selectedAttestationIds = useHypercertWizardStore((state) => state.selectedAttestationIds);
  const title = useHypercertWizardStore((state) => state.title);
  const workScopes = useHypercertWizardStore((state) => state.workScopes);
  const workTimeframeStart = useHypercertWizardStore((state) => state.workTimeframeStart);
  const workTimeframeEnd = useHypercertWizardStore((state) => state.workTimeframeEnd);
  const allowlist = useHypercertWizardStore((state) => state.allowlist);

  // Memoize allowlist validation since it's potentially expensive
  const allowlistValidation = useMemo(() => validateAllowlist(allowlist), [allowlist]);

  const canProceed = useCallback(
    (step = currentStep) => {
      // 4-step wizard: attestations, metadata, distribution, preview+mint
      switch (step) {
        case 1: // Attestations
          return selectedAttestationIds.length > 0;
        case 2: // Metadata
          // Required fields: title, workScopes, workTimeframeStart, workTimeframeEnd
          // (as indicated by * in UI)
          return (
            title.trim().length > 0 &&
            workScopes.length > 0 &&
            workTimeframeStart > 0 &&
            workTimeframeEnd > 0
          );
        case 3: // Distribution
          return allowlistValidation.valid;
        case 4: // Preview & Mint - always true (submit handled separately)
          return true;
        default:
          return false;
      }
    },
    [
      currentStep,
      selectedAttestationIds,
      title,
      workScopes,
      workTimeframeStart,
      workTimeframeEnd,
      allowlistValidation,
    ]
  );

  return {
    currentStep,
    nextStep,
    previousStep,
    setStep,
    canProceed,
    reset,
  };
}
