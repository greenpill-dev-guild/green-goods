import { cn } from "@green-goods/shared/utils";
import { RiCheckboxCircleLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface Step {
  id: string;
  title: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  /** Called when user clicks on a completed step to navigate back */
  onStepClick?: (stepIndex: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const { formatMessage } = useIntl();
  return (
    <div
      className="sticky top-0 z-30 border-b border-stroke-soft bg-bg-white shadow-sm"
      data-testid="step-indicator"
    >
      {/* Step progress indicators */}
      <div className="relative bg-bg-weak">
        <ol className="flex">
          {steps.map((step, index) => {
            const completed = index < currentStep;
            const active = index === currentStep;
            const isLast = index === steps.length - 1;

            return (
              <li
                key={step.id}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex flex-1 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 sm:py-4",
                  active && "bg-bg-white"
                )}
              >
                {/* Progress indicator dot/check */}
                {completed && onStepClick ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(index)}
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-medium sm:h-7 sm:w-7",
                      "border-success-base bg-success-lighter text-success-dark",
                      "cursor-pointer transition hover:ring-2 hover:ring-primary-light focus:outline-none focus:ring-2 focus:ring-primary-base"
                    )}
                    aria-label={formatMessage(
                      { id: "app.hypercerts.wizard.goToStep" },
                      { step: step.title }
                    )}
                  >
                    <RiCheckboxCircleLine className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                ) : (
                  <span
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-medium sm:h-7 sm:w-7",
                      completed && "border-success-base bg-success-lighter text-success-dark",
                      active && !completed && "border-success-base bg-bg-white text-success-base",
                      !completed && !active && "border-stroke-sub bg-bg-white text-text-disabled"
                    )}
                  >
                    {completed ? (
                      <RiCheckboxCircleLine className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                )}

                {/* Step title - mobile shows only active step title */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-xs font-medium sm:text-sm",
                      active ? "text-text-strong" : "text-text-soft",
                      // On mobile, hide non-active step titles
                      !active && "hidden sm:block"
                    )}
                  >
                    {step.title}
                  </p>
                  <p
                    className={cn(
                      "hidden truncate text-xs text-text-soft sm:block",
                      !active && "sm:hidden md:block"
                    )}
                  >
                    {step.description}
                  </p>
                </div>

                {/* Connector line between steps */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2",
                      completed ? "bg-success-base" : "bg-bg-soft"
                    )}
                    style={{ zIndex: 0 }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
