import { cn } from "@green-goods/shared/utils";
import { RiArrowLeftLine, RiLoader4Line } from "@remixicon/react";
import { type ReactNode, useEffect, useRef } from "react";
import { useIntl } from "react-intl";
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
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), button:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [currentStep]);

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
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-1.5 rounded-md border border-stroke-sub bg-bg-white px-4 py-2.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RiArrowLeftLine className="h-4 w-4" />
                {formatMessage({ id: "app.wizard.back" })}
              </button>
            )}

            <div className="flex gap-3 sm:ml-auto">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-md border border-stroke-sub px-4 py-2.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
              >
                {formatMessage({ id: "app.wizard.cancel" })}
              </button>

              {!isLastStep && onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={isSubmitting || nextDisabled}
                  className="flex-1 rounded-md bg-primary-base px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
                >
                  {resolvedNextLabel}
                </button>
              )}

              {isLastStep && onSubmit && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md bg-primary-base px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial",
                    isSubmitting && "cursor-not-allowed opacity-70"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <RiLoader4Line className="h-4 w-4 animate-spin" />
                      {formatMessage({ id: "app.wizard.submitting" })}
                    </>
                  ) : (
                    resolvedSubmitLabel
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
