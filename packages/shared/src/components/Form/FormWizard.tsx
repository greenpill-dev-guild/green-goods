import { RiArrowLeftLine } from "@remixicon/react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { useTimeout } from "../../hooks";
import { Button } from "../Button";
import { Surface } from "../Surface";
import { type Step, StepIndicator } from "./StepIndicator";

export interface FormWizardProps {
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
  const resolvedNextLabel =
    nextLabel ?? formatMessage({ id: "app.form.next", defaultMessage: "Next" });
  const resolvedSubmitLabel =
    submitLabel ?? formatMessage({ id: "app.form.submit", defaultMessage: "Submit" });
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

  const footer = (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-nav px-3 pb-2 pt-2 sm:px-6 sm:pb-4 min-[600px]:bottom-6">
      <div className="pointer-events-auto mx-auto max-w-6xl">
        <div className="rounded-[var(--radius-xl)] border border-stroke-soft-200 bg-[var(--color-material-thick)] px-4 py-3 shadow-regular-md supports-[backdrop-filter]:backdrop-blur-[var(--blur-material-thick)] sm:px-6 sm:py-4">
          {showValidationMessage && (
            <p className="mb-3 text-sm text-warning-dark sm:mb-0 sm:mr-4">{validationMessage}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {!isFirstStep && onBack && (
              <Button
                type="button"
                variant="secondary"
                onClick={onBack}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <RiArrowLeftLine className="h-4 w-4" />
                {formatMessage({ id: "app.wizard.back", defaultMessage: "Back" })}
              </Button>
            )}

            <div className="flex gap-3 sm:ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial"
              >
                {formatMessage({ id: "app.wizard.cancel", defaultMessage: "Cancel" })}
              </Button>

              {!isLastStep && onNext && (
                <Button
                  type="button"
                  onClick={onNext}
                  disabled={isSubmitting || nextDisabled}
                  className="flex-1 sm:flex-initial"
                >
                  {resolvedNextLabel}
                </Button>
              )}

              {isLastStep && onSubmit && (
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  className="flex-1 sm:flex-initial"
                >
                  {isSubmitting
                    ? formatMessage({
                        id: "app.wizard.submitting",
                        defaultMessage: "Deploying...",
                      })
                    : resolvedSubmitLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-bg-weak pb-[calc(env(safe-area-inset-bottom)+11rem)] sm:pb-40">
      {/* Screen reader announcement for step changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentStepInfo &&
          formatMessage(
            { id: "app.form.stepAnnouncement", defaultMessage: "Step {step} of {total}: {title}" },
            {
              step: currentStep + 1,
              total: steps.length,
              title: currentStepInfo.title,
            }
          )}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <Surface
          elevation="raised"
          padding="none"
          className="overflow-hidden rounded-[var(--radius-2xl)] border border-stroke-soft-200 bg-[var(--color-material-thick)] shadow-regular-md"
        >
          <StepIndicator steps={steps} currentStep={currentStep} onStepClick={onStepClick} />

          <div ref={contentRef} className="px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {children}
          </div>
        </Surface>
      </div>

      {typeof document !== "undefined" ? createPortal(footer, document.body) : null}
    </div>
  );
}
