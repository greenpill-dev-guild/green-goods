import { useMemo } from "react";
import type { IntlShape } from "react-intl";
import type { Step } from "@/components/Form/StepIndicator";

/** Build the 4-step wizard definition (memoized by formatMessage reference). */
export function useWizardSteps(formatMessage: IntlShape["formatMessage"]): Step[] {
  return useMemo(
    () => [
      {
        id: "attestations",
        title: formatMessage({ id: "app.hypercerts.wizard.step.attestations.title" }),
        description: formatMessage({
          id: "app.hypercerts.wizard.step.attestations.description",
        }),
      },
      {
        id: "metadata",
        title: formatMessage({ id: "app.hypercerts.wizard.step.metadata.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.metadata.description" }),
      },
      {
        id: "distribution",
        title: formatMessage({ id: "app.hypercerts.wizard.step.distribution.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.distribution.description" }),
      },
      {
        id: "preview",
        title: formatMessage({ id: "app.hypercerts.wizard.step.preview.title" }),
        description: formatMessage({ id: "app.hypercerts.wizard.step.preview.description" }),
      },
    ],
    [formatMessage]
  );
}

/** Generate validation message based on current step (4-step wizard). */
export function useValidationMessage({
  currentStep,
  nextDisabled,
  selectedAttestationIds,
  wizardTitle,
  wizardWorkScopes,
  wizardWorkTimeframeStart,
  wizardWorkTimeframeEnd,
  formatMessage,
}: {
  currentStep: number;
  nextDisabled: boolean;
  selectedAttestationIds: string[];
  wizardTitle?: string;
  wizardWorkScopes?: string[];
  wizardWorkTimeframeStart?: number;
  wizardWorkTimeframeEnd?: number;
  formatMessage: IntlShape["formatMessage"];
}): string | undefined {
  return useMemo(() => {
    if (!nextDisabled) return undefined;

    switch (currentStep) {
      case 1: // Attestation selection
        return selectedAttestationIds.length === 0
          ? formatMessage({ id: "app.hypercerts.wizard.validation.selectAttestation" })
          : undefined;
      case 2: {
        // Metadata - check all required fields
        const missingFields: string[] = [];
        if (!wizardTitle?.trim()) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.title" }));
        }
        if (!wizardWorkScopes?.length) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workScope" }));
        }
        if (!wizardWorkTimeframeStart) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workTimeframeStart" }));
        }
        if (!wizardWorkTimeframeEnd) {
          missingFields.push(formatMessage({ id: "app.hypercerts.metadata.workTimeframeEnd" }));
        }
        if (missingFields.length > 0) {
          return formatMessage(
            { id: "app.hypercerts.wizard.validation.missingFields" },
            { fields: missingFields.join(", ") }
          );
        }
        return undefined;
      }
      case 3: // Distribution - validation handled by canProceed via allowlistValidation
        return formatMessage({ id: "app.hypercerts.wizard.validation.distribution" });
      default:
        return undefined;
    }
  }, [
    currentStep,
    nextDisabled,
    selectedAttestationIds.length,
    wizardTitle,
    wizardWorkScopes,
    wizardWorkTimeframeStart,
    wizardWorkTimeframeEnd,
    formatMessage,
  ]);
}
