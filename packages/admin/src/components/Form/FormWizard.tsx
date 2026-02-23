import { useTimeout } from "@green-goods/shared";
import { RiArrowLeftLine } from "@remixicon/react";
import { type ReactNode, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/ui/Button";
import { type Step, StepIndicator } from "./StepIndicator";

interface FormWizardProps {
  steps: Step[];
  currentStep: number;
  onNext?: () => void;
  onBack?: () => void;
  onCancel: () => void;
  onSubmit?: () => void;
  /** Called when user clicks on a completed step to navigate back */
  onStepClick?: (stepIndex: number) => void;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
  /** Validation message to show when next is disabled */
  validationMessage?: string;
  children: ReactNode;
  nextLabel?: string;
  submitLabel?: string;
}

/**
 * Immersive multi-step form wizard
 * Full-width step indicator at top, centered content, sticky footer navigation
 */
export function FormWizard({
  steps,
  currentStep,
  onNext,
  onBack,
  onCancel,
  onSubmit,
  onStepClick,
  isSubmitting = false,
  nextDisabled = false,
  validationMessage,
  children,
  nextLabel,
  submitLabel,
}: FormWizardProps) {
  const { formatMessage } = useIntl();
  const resolvedNextLabel = nextLabel ?? formatMessage({ id: "app.form.next" });
  const resolvedSubmitLabel = submitLabel ?? formatMessage({ id: "app.form.submit" });
  const contentRef = useRef<HTMLDivElement>(null);
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const showValidationMessage = nextDisabled && validationMessage && !isLastStep;

  const currentStepInfo = steps[currentStep];

  // Focus first focusable element when step changes
  const { set: scheduleTimeout } = useTimeout();
  useEffect(() => {
    scheduleTimeout(() => {
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), button:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 100);
  }, [currentStep, scheduleTimeout]);

  return (
    <div className="bg-bg-weak pb-20 sm:pb-24">
      {/* Screen reader announcement for step changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentStepInfo &&
          formatMessage(
            { id: "app.form.stepAnnouncement" },
            {
              step: currentStep + 1,
              total: steps.length,
              title: currentStepInfo.title,
            }
          )}
      </div>

      {/* Full-width sticky step indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} onStepClick={onStepClick} />

      {/* Form content - centered with max-width, optimized padding */}
      <div ref={contentRef} className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </div>

      {/* Navigation footer - respects sidebar on desktop */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stroke-soft bg-bg-white shadow-lg lg:left-64">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
          {/* Validation feedback */}
          {showValidationMessage && (
            <p className="mb-2 text-center text-xs text-warning-dark sm:mb-0 sm:mr-4 sm:text-left sm:text-sm">
              {validationMessage}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {!isFirstStep && onBack && (
              <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
                <RiArrowLeftLine className="h-4 w-4" />
                {formatMessage({ id: "app.wizard.back" })}
              </Button>
            )}

            <div className="flex gap-3 sm:ml-auto">
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial"
              >
                {formatMessage({ id: "app.wizard.cancel" })}
              </Button>

              {!isLastStep && onNext && (
                <Button
                  onClick={onNext}
                  disabled={isSubmitting || nextDisabled}
                  className="flex-1 sm:flex-initial"
                >
                  {resolvedNextLabel}
                </Button>
              )}

              {isLastStep && onSubmit && (
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  className="flex-1 sm:flex-initial"
                >
                  {isSubmitting
                    ? formatMessage({ id: "app.wizard.submitting" })
                    : resolvedSubmitLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
