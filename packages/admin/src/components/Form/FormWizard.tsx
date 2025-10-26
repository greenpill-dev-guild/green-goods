import { cn } from "@green-goods/shared/utils";
import { RiArrowLeftLine, RiLoader4Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { type Step, StepIndicator } from "./StepIndicator";

interface FormWizardProps {
  steps: Step[];
  currentStep: number;
  onNext?: () => void;
  onBack?: () => void;
  onCancel: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
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
  isSubmitting = false,
  nextDisabled = false,
  children,
  nextLabel = "Continue",
  submitLabel = "Submit",
}: FormWizardProps) {
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="bg-bg-weak pb-20 sm:pb-24">
      {/* Full-width sticky step indicator */}
      <StepIndicator steps={steps} currentStep={currentStep} />

      {/* Form content - centered with max-width, optimized padding */}
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">{children}</div>

      {/* Navigation footer - respects sidebar on desktop */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stroke-soft bg-bg-white shadow-lg lg:left-64">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            {!isFirstStep && onBack && (
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-1.5 rounded-md border border-stroke-sub bg-bg-white px-4 py-2.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RiArrowLeftLine className="h-4 w-4" />
                Back
              </button>
            )}

            <div className="flex gap-3 sm:ml-auto">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-md border border-stroke-sub px-4 py-2.5 text-sm font-medium text-text-sub transition hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
              >
                Cancel
              </button>

              {!isLastStep && onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={isSubmitting || nextDisabled}
                  className="flex-1 rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
                >
                  {nextLabel}
                </button>
              )}

              {isLastStep && onSubmit && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial",
                    isSubmitting && "cursor-not-allowed opacity-70"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <RiLoader4Line className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    submitLabel
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
