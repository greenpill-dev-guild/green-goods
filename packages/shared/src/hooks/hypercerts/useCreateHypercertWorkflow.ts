import { useCallback, useMemo } from "react";

import { validateAllowlist } from "../../lib/hypercerts";
import { selectHypercertMetadataComplete } from "../../stores/transitions/hypercert-wizard";
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
  const impactTimeframeStart = useHypercertWizardStore((state) => state.impactTimeframeStart);
  const impactTimeframeEnd = useHypercertWizardStore((state) => state.impactTimeframeEnd);
  const allowlist = useHypercertWizardStore((state) => state.allowlist);

  // Memoize allowlist validation since it's potentially expensive
  const allowlistValidation = useMemo(() => validateAllowlist(allowlist), [allowlist]);

  const canProceed = useCallback(
    (step = currentStep) => {
      // 4-step wizard: attestations, metadata, distribution, preview+mint
      switch (step) {
        case 1: // Attestations
          return selectedAttestationIds.length > 0;
        case 2: // Metadata: the rule a restored draft is also held to.
          return selectHypercertMetadataComplete({
            title,
            workScopes,
            workTimeframeStart,
            workTimeframeEnd,
            impactTimeframeStart,
            impactTimeframeEnd,
          });
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
      impactTimeframeStart,
      impactTimeframeEnd,
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
