import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckFill } from "@remixicon/react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

interface FormProgressProps {
  currentStep: number;
  /** Each step's name, shown under its marker. */
  steps: string[];
}

/**
 * A flow's steps in its top bar: a numbered marker per step with the step's name
 * under it, joined by lines that fill as steps complete. Submit Work, proof and
 * compose share it, so every flow names its steps (D6).
 */
export const FormProgress = ({ currentStep, steps }: FormProgressProps) => {
  const { formatMessage } = useIntl();
  return (
    <ol aria-label={formatMessage({ id: "app.form.progress.label" })} className="flex items-start">
      {steps.map((step, index) => {
        const isCurrentStep = currentStep === index + 1;
        const isCompletedStep = currentStep > index + 1;
        return (
          <li
            key={step}
            aria-current={isCurrentStep ? "step" : undefined}
            className={cn("flex items-start gap-1", index > 0 && "ms-1")}
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-3 h-px w-4 shrink-0",
                  isCompletedStep || isCurrentStep
                    ? pwaStatusStyles.success.progress
                    : pwaStatusStyles.neutral.progress
                )}
              />
            ) : null}
            <span className="flex min-w-14 flex-col items-center gap-1">
              <span
                className={cn(
                  "relative grid h-6 w-6 place-items-center rounded-full border border-stroke-soft-200 text-xs font-medium transition-[color,border-color,background-color] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  // A finished step steps back: a light marker and a tick, so the
                  // one filled marker is the step you are on.
                  isCompletedStep && cn(pwaStatusStyles.success.surface, "border-0"),
                  isCurrentStep && cn(pwaStatusStyles.primary.badge, "border-0 font-semibold")
                )}
              >
                {isCompletedStep ? (
                  <RiCheckFill
                    aria-hidden="true"
                    className={cn("w-3 h-3", pwaStatusStyles.success.text)}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(!isCurrentStep && pwaStatusStyles.neutral.foreground)}
                  >
                    {index + 1}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] leading-[14px]",
                  isCurrentStep
                    ? "font-semibold text-text-strong-950"
                    : "font-medium text-text-sub-600"
                )}
              >
                {step}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};
