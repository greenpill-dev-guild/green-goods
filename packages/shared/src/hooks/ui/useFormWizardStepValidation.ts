import { useCallback, useEffect, useRef, useState } from "react";

export type FormWizardValidationStep<TStepId extends string = string> = {
  id: TStepId;
};

export type FormWizardTrigger<TFieldName extends string = string> = (
  fields?: TFieldName[] | undefined,
  options?: { shouldFocus?: boolean }
) => Promise<boolean>;

export type FormWizardStepFields<
  TStepId extends string = string,
  TFieldName extends string = string,
> = Partial<Record<TStepId, readonly TFieldName[]>>;

export interface UseFormWizardStepValidationOptions<
  TStepId extends string = string,
  TFieldName extends string = string,
> {
  currentStep: number;
  steps: readonly FormWizardValidationStep<TStepId>[];
  stepFields?: FormWizardStepFields<TStepId, TFieldName>;
  trigger?: FormWizardTrigger<TFieldName>;
  onValidNext: () => void;
  onBack?: () => void;
  onStepClick?: (stepIndex: number) => void;
  clearValidationAfterValidNext?: boolean;
}

export interface UseFormWizardStepValidationResult {
  showValidation: boolean;
  setShowValidation: (showValidation: boolean) => void;
  validateCurrentStep: () => Promise<boolean>;
  validateAll: () => Promise<boolean>;
  /**
   * Show validation on a step the flow is about to move to, such as Submit
   * sending the person back to a step with a bad value. Every other step
   * change hides validation.
   */
  showValidationOnStep: (stepIndex: number) => void;
  handleNext: () => Promise<void>;
  handleBack: () => void;
  handleStepClick: (stepIndex: number) => void;
}

export function useFormWizardStepValidation<
  TStepId extends string = string,
  TFieldName extends string = string,
>({
  currentStep,
  steps,
  stepFields,
  trigger,
  onValidNext,
  onBack,
  onStepClick,
  clearValidationAfterValidNext = false,
}: UseFormWizardStepValidationOptions<TStepId, TFieldName>): UseFormWizardStepValidationResult {
  const [showValidation, setShowValidation] = useState(false);
  const revealOnStepRef = useRef<number | null>(null);

  useEffect(() => {
    const reveal = revealOnStepRef.current === currentStep;
    revealOnStepRef.current = null;
    setShowValidation(reveal);
  }, [currentStep]);

  const showValidationOnStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex === currentStep) {
        setShowValidation(true);
        return;
      }
      revealOnStepRef.current = stepIndex;
    },
    [currentStep]
  );

  const validateCurrentStep = useCallback(async () => {
    setShowValidation(true);

    const currentStepId = steps[currentStep]?.id;
    const fields = currentStepId ? stepFields?.[currentStepId] : undefined;

    if (!trigger || !fields || fields.length === 0) {
      return true;
    }

    return trigger([...fields], { shouldFocus: true });
  }, [currentStep, stepFields, steps, trigger]);

  const validateAll = useCallback(async () => {
    setShowValidation(true);
    return trigger ? trigger(undefined, { shouldFocus: true }) : true;
  }, [trigger]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    if (clearValidationAfterValidNext) {
      setShowValidation(false);
    }

    onValidNext();
  }, [clearValidationAfterValidNext, onValidNext, validateCurrentStep]);

  const handleBack = useCallback(() => {
    setShowValidation(false);
    onBack?.();
  }, [onBack]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      setShowValidation(false);
      onStepClick?.(stepIndex);
    },
    [onStepClick]
  );

  return {
    showValidation,
    setShowValidation,
    validateCurrentStep,
    validateAll,
    showValidationOnStep,
    handleNext,
    handleBack,
    handleStepClick,
  };
}
