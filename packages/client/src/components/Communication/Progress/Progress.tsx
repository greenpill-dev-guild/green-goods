import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowRightSLine, RiCheckFill } from "@remixicon/react";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

interface FormProgressProps {
  currentStep: number;
  steps: string[];
}

export const FormProgress = ({ currentStep, steps }: FormProgressProps) => {
  return (
    <div className="relative flex flex-row gap-x-2">
      {steps.map((step, index) => {
        const isCurrentStep = currentStep === index + 1;
        const isCompletedStep = currentStep > index + 1;
        return (
          <div key={step} className="flex flex-col justify-center items-center flex-1 group">
            <div className="inline-flex items-center text-xs align-middle">
              <span
                aria-current={isCurrentStep ? "step" : undefined}
                className={cn(
                  "relative grid h-6 w-6 place-items-center rounded-full border border-stroke-soft-200 text-xs font-medium transition-[color,border-color,background-color] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
                  isCompletedStep && cn(pwaStatusStyles.success.badge, "border-0"),
                  isCurrentStep && cn(pwaStatusStyles.primary.badge, "border-0 font-semibold")
                )}
              >
                {isCompletedStep ? (
                  <RiCheckFill className={cn("w-3 h-3", pwaStatusStyles.success.foreground)} />
                ) : (
                  <span className={cn(!isCurrentStep && pwaStatusStyles.neutral.foreground)}>
                    {index + 1}
                  </span>
                )}
              </span>
              <div
                className={cn(
                  currentStep > index + 1
                    ? pwaStatusStyles.success.progress
                    : pwaStatusStyles.neutral.progress,
                  "ms-2 w-full h-px flex-1 group-last:hidden"
                )}
              />
              {index < steps.length - 1 && (
                <div>
                  <RiArrowRightSLine className="w-4 text-text-soft-400" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
